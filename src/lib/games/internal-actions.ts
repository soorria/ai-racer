import "server-only"

import { addSeconds } from "date-fns"
import { type Inngest } from "inngest"

import type { Doc } from "../db/types"
import { requireAuthUser } from "../auth/user"
import { cmp, db, schema, sql } from "../db"
import { streamUpdatedCode } from "../llm/generation"
import { extractCodeFromRawCompletion } from "../llm/utils"
import { captureUserEvent } from "../posthog/server"
import { LLM_PROMPTING_TIMEOUT } from "./constants"
import { getPlayerPositionsForGameMode } from "./game-modes"
import { getGameById } from "./queries"
import { chatHistoryItemTypeIs } from "./utils"

export async function advanceGameToStatus(
  gameId: string,
  status: Exclude<Doc<"gameStates">["status"], "waitingForPlayers" | "cancelled" | "finished">,
) {
  const game = await db.query.gameStates.findFirst({
    where: cmp.eq(schema.gameStates.id, gameId),
  })

  if (!game) {
    return
  }

  if (game.status === status) {
    return
  }

  await db
    .update(schema.gameStates)
    .set({
      status,
      start_time: status === "inProgress" ? new Date() : undefined,
    })
    .where(cmp.eq(schema.gameStates.id, gameId))
}

export async function cancelInngestGameWorkflow(inngest: Inngest, gameId: string) {
  await inngest.send({
    name: "game/cancelled" as const,
    data: {
      game_id: gameId,
    },
  })
}

export async function finalizeGame(gameId: string) {
  await db.transaction(async (tx) => {
    const [game, playerGameSessions] = await Promise.all([
      getGameById(tx, gameId),
      tx.query.playerGameSessions.findMany({
        where: cmp.eq(schema.playerGameSessions.game_id, gameId),
        with: {
          chatHistory: true,
          submissionState: {
            with: {
              programmingResults: true,
              pictureResult: true,
            },
          },
        },
      }),
    ])

    if (!game) {
      return
    }

    const positionResults = getPlayerPositionsForGameMode(game, playerGameSessions)

    /**
     * If we _really_ want to allow finalizing a game multiple times, we can
     * delete existing rows and insert new ones.
     */
    await tx
      .insert(schema.playerGameSessionFinalResults)
      .values(positionResults)
      .onConflictDoNothing()

    if (playerGameSessions.length > 1) {
      const winningResult = positionResults.find((r) => r.position === 0)
      if (winningResult) {
        const winningPlayerSession = playerGameSessions.find(
          (s) => s.id === winningResult.player_game_session_id,
        )

        if (winningPlayerSession) {
          await tx
            .update(schema.userProfiles)
            .set({ wins: sql`${schema.userProfiles.wins} + 1` })
            .where(cmp.eq(schema.userProfiles.id, winningPlayerSession.user_id))
        }
      }
    }

    await tx
      .update(schema.userProfiles)
      .set({ gamesPlayed: sql`${schema.userProfiles.gamesPlayed} + 1` })
      .where(
        cmp.inArray(
          schema.userProfiles.id,
          playerGameSessions.map((session) => session.user_id),
        ),
      )

    playerGameSessions.forEach((session) => {
      captureUserEvent(session.user_id, "Finished a game", {
        mode: game.mode,
      })
    })

    await tx
      .update(schema.gameStates)
      .set({
        status: "finished",
      })
      .where(cmp.eq(schema.gameStates.id, game.id))
  })
}

export async function sendMessageInGame(gameId: string, instructions: string) {
  const user = await requireAuthUser()
  const playerGameSession = await db.query.playerGameSessions.findFirst({
    where: cmp.and(
      cmp.eq(schema.playerGameSessions.user_id, user.id),
      cmp.eq(schema.playerGameSessions.game_id, gameId),
    ),
    with: {
      game: true,
    },
  })

  if (!playerGameSession) {
    throw new Error("Game not found, or you are not in this game")
  }

  const { game } = playerGameSession

  if (game.status !== "inProgress") {
    throw new Error("Game is not in progress")
  }

  const lastPromptedAt = playerGameSession.last_prompted_at
  if (lastPromptedAt) {
    const lastPromptedAtMs = lastPromptedAt.getTime()
    const now = Date.now()
    const msSinceLastPrompt = now - lastPromptedAtMs
    if (msSinceLastPrompt < LLM_PROMPTING_TIMEOUT) {
      throw new Error(
        `Need to wait ${LLM_PROMPTING_TIMEOUT - msSinceLastPrompt}ms before prompting again`,
      )
    }
  }

  const insertedItems = await db
    .insert(schema.playerGameSessionChatHistoryItems)
    .values([
      {
        player_game_session_id: playerGameSession.id,
        content: {
          type: "instructions",
          instructions,
        },
        inserted_at: new Date(),
      },
      {
        player_game_session_id: playerGameSession.id,
        content: {
          type: "ai",
          rawCompletion: "",
          parsedCompletion: {
            state: "generating",
            maybeCode: "",
          },
        },
        // TODO: figure out a better solution lol
        inserted_at: addSeconds(new Date(), 1),
      },
    ])
    .returning()

  const insertedAtMessage = insertedItems.find((item) => chatHistoryItemTypeIs(item, "ai"))

  if (!insertedAtMessage) {
    throw new Error("Failed to insert message")
  }

  await db
    .update(schema.playerGameSessions)
    .set({
      last_prompted_at: new Date(),
    })
    .where(cmp.eq(schema.playerGameSessions.id, playerGameSession.id))

  const result = await streamUpdatedCode({
    existingCode: playerGameSession.code,
    instructions,
    modelId: playerGameSession.model,
    onFinish: async (completion) => {
      const rawUpdatedCode = completion.text
      const extractedCode = extractCodeFromRawCompletion(rawUpdatedCode)

      await Promise.all([
        db
          .update(schema.playerGameSessionChatHistoryItems)
          .set({
            player_game_session_id: playerGameSession.id,
            content: extractedCode
              ? {
                  type: "ai",
                  rawCompletion: rawUpdatedCode,
                  parsedCompletion: {
                    state: "success",
                    maybeCode: extractedCode,
                  },
                }
              : {
                  type: "ai",
                  rawCompletion: rawUpdatedCode,
                  parsedCompletion: {
                    state: "error",
                    error: "Could not find code in AI completion",
                  },
                },
          })
          .where(cmp.eq(schema.playerGameSessionChatHistoryItems.id, insertedAtMessage.id)),
        extractedCode &&
          db
            .update(schema.playerGameSessions)
            .set({ code: extractedCode })
            .where(cmp.eq(schema.playerGameSessions.id, playerGameSession.id)),
      ])
    },
  })

  return result
}

/**
 * Updates `gameState.updated_at = Date.now()` to invalidate and cause refetches to
 * queries for connected clients observing the gameState table.
 */
export async function touchGameState(gameId: string): Promise<void> {
  await db
    .update(schema.gameStates)
    .set({
      updated_at: new Date(),
    })
    .where(cmp.eq(schema.gameStates.id, gameId))
}
