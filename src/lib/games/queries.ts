import "server-only"

import type { SQL } from "drizzle-orm"

import { requireAuthUser } from "../auth/user"
import { cmp, orderBy, schema } from "../db"
import { type DBOrTransaction, type Doc } from "../db/types"
import {
  type InGameState,
  type NotWaitingForPlayersGameState,
  type WaitingForPlayersGameState,
} from "./types"
import { getQuestionTestCasesOrderBy } from "./utils"

export async function getUserGameHistory(
  tx: DBOrTransaction,
  {
    userId,
    limit = 10,
    cursor,
  }: {
    userId: string
    limit?: number
    cursor?: string
  },
) {
  const userFilter = cmp.eq(schema.playerGameSessions.user_id, userId)

  let filter: SQL | undefined = userFilter

  if (cursor) {
    filter = cmp.and(userFilter, cmp.lt(schema.gameStates.inserted_at, new Date(cursor)))
  }

  const results = await tx
    .select({
      game: {
        id: schema.gameStates.id,
        status: schema.gameStates.status,
        mode: schema.gameStates.mode,
        inserted_at: schema.gameStates.inserted_at,
      },
      finalResult: {
        position: schema.playerGameSessionFinalResults.position,
        score: schema.playerGameSessionFinalResults.score,
      },
      question: {
        difficulty: schema.questions.difficulty,
      },
    })
    .from(schema.playerGameSessions)
    .where(filter)
    .innerJoin(schema.gameStates, cmp.eq(schema.playerGameSessions.game_id, schema.gameStates.id))
    .leftJoin(
      schema.playerGameSessionFinalResults,
      cmp.eq(
        schema.playerGameSessions.id,
        schema.playerGameSessionFinalResults.player_game_session_id,
      ),
    )
    .leftJoin(schema.questions, cmp.eq(schema.gameStates.question_id, schema.questions.id))
    .orderBy(orderBy.desc(schema.gameStates.inserted_at))
    .limit(limit)

  return {
    items: results.map((item) => {
      return {
        ...item.game,
        difficulty: item.question?.difficulty,
        finalResult: item.finalResult,
      }
    }),
    nextCursor: results.at(-1)?.game.inserted_at.toISOString(),
  }
}

export async function getLatestActiveGameForUser(tx: DBOrTransaction, userId: string) {
  const [result] = await tx
    .select({
      session: schema.playerGameSessions,
      game: schema.gameStates,
    })
    .from(schema.playerGameSessions)
    .innerJoin(schema.gameStates, cmp.eq(schema.playerGameSessions.game_id, schema.gameStates.id))
    .where(
      cmp.and(
        cmp.eq(schema.playerGameSessions.user_id, userId),
        cmp.notInArray(schema.gameStates.status, ["cancelled", "finished"]),
      ),
    )
    .orderBy(orderBy.desc(schema.gameStates.start_time))
    .limit(10)

  return result ?? null
}

export async function getLatestActiveGameForCurrentUser(tx: DBOrTransaction) {
  const user = await requireAuthUser()
  return getLatestActiveGameForUser(tx, user.id)
}

export async function getGamesWithStatus<Status extends Doc<"gameStates">["status"]>(
  tx: DBOrTransaction,
  status: Status,
) {
  const results = await tx.query.gameStates.findMany({
    where: cmp.eq(schema.gameStates.status, status),
    with: {
      question: {
        columns: {
          difficulty: true,
        },
        with: {
          pictureQuestion: true,
          programmingQuestion: {
            columns: {
              starterCode: true,
            },
          },
        },
      },
    },
  })

  return results
}

export async function getSubmissionMetrics(tx: DBOrTransaction, submission_state_id: string) {
  const submissionStateResults =
    await tx.query.playerProgrammingGameSubmissionStateResults.findMany({
      where: cmp.eq(
        schema.playerProgrammingGameSubmissionStateResults.player_game_submission_state_id,
        submission_state_id,
      ),
    })
  return {
    numPassingSubmissionsTestCases: submissionStateResults.filter((result) => result.is_correct)
      .length,
    numTestCases: submissionStateResults.length,
  }
}

export async function getQuestionById(tx: DBOrTransaction, questionId: string) {
  const question = await tx.query.questions.findFirst({
    where: cmp.eq(schema.questions.id, questionId),
    with: {
      programmingQuestion: true,
      pictureQuestion: true,
    },
  })

  return question
}

export async function getGameById(tx: DBOrTransaction, gameId: string) {
  const game = await tx.query.gameStates.findFirst({
    where: cmp.eq(schema.gameStates.id, gameId),
  })

  return game
}

export async function getInGameState(
  tx: DBOrTransaction,
  gameId: string,
): Promise<InGameState | undefined> {
  const gameState = await tx.query.gameStates.findFirst({
    where: cmp.eq(schema.gameStates.id, gameId),
    columns: {
      question_id: false,
    },
    with: {
      question: {
        with: {
          programmingQuestion: {
            with: {
              testCases: {
                where: cmp.eq(schema.programmingQuestionTestCases.type, "public"),
                orderBy: getQuestionTestCasesOrderBy(),
              },
            },
          },
        },
      },
      players: {
        with: {
          user: true,
        },
        columns: {},
      },
    },
  })

  if (gameState?.status === "waitingForPlayers") {
    return {
      ...gameState,
      question: null,
    } as WaitingForPlayersGameState
  }

  return gameState as NotWaitingForPlayersGameState | undefined
}

/**
 * Separated out to allow for caching
 */
export async function getGameResultsData(tx: DBOrTransaction, gameId: string) {
  const game = await getGameById(tx, gameId)

  if (!game) {
    return null
  }

  const playerGameSessions = await tx.query.playerGameSessions.findMany({
    where: cmp.eq(schema.playerGameSessions.game_id, gameId),
    with: {
      finalResult: true,
      user: true,
      chatHistory: {
        orderBy: orderBy.asc(schema.playerGameSessionChatHistoryItems.inserted_at),
      },
    },
  })

  const question = await tx.query.questions.findFirst({
    where: cmp.eq(schema.questions.id, game.question_id),
  })

  return {
    players: playerGameSessions,
    game,
    question,
  }
}

/**
 * This function gets only the required data to render the OG image. It is intended to be
 * as lightweight and performant as possible since the time to create the OG image is
 * critical for certain websites to render the image.
 */
export async function getTop3Players(tx: DBOrTransaction, gameId: string) {
  const results = await tx.query.playerGameSessions.findMany({
    where: cmp.eq(schema.playerGameSessions.game_id, gameId),
    with: {
      user: true,
      finalResult: true,
    },
  })
  const gameDifficulty = await tx.query.gameStates.findFirst({
    where: cmp.eq(schema.gameStates.id, gameId),
    columns: {
      question_id: true,
    },
    with: {
      question: {
        columns: {
          difficulty: true,
        },
      },
    },
  })

  return {
    players: results
      .sort((a, b) => (a.finalResult?.position ?? 0) - (b.finalResult?.position ?? 0))
      .slice(0, 3),
    gameMode: gameDifficulty?.question.difficulty,
  }
}

export async function getSessionInfoForPlayer(tx: DBOrTransaction, userId: string, gameId: string) {
  return await tx.query.playerGameSessions.findFirst({
    where: cmp.and(
      cmp.eq(schema.playerGameSessions.user_id, userId),
      cmp.eq(schema.playerGameSessions.game_id, gameId),
    ),
    with: {
      submissionState: {
        with: {
          programmingResults: {
            columns: {
              is_correct: true,
            },
          },
        },
      },
      testState: {
        with: {
          programmingResults: true,
        },
      },
      chatHistory: {
        orderBy: orderBy.asc(schema.playerGameSessionChatHistoryItems.inserted_at),
      },
      finalResult: true,
    },
  })
}
