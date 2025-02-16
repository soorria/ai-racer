import { invariant } from "@epic-web/invariant"

import { type Doc } from "~/lib/db/types"
import { INTEGER_RANGE } from "../db/constants"
import { type GameMode } from "./constants"

export type PlayerGameSessionToSort = Doc<"playerGameSessions"> & {
  chatHistory: Doc<"playerGameSessionChatHistoryItems">[]
  submissionState:
    | (Doc<"playerGameSubmissionStates"> & {
        programmingResults: Doc<"playerProgrammingGameSubmissionStateResults">[]
        pictureResult: Doc<"playerPictureGameSubmissionStateResults"> | null
      })
    | null
}

type SortablePlayerGameSession = PlayerGameSessionToSort & {
  submissionState: NonNullable<PlayerGameSessionToSort["submissionState"]>
}

export type PlayerPositionsMap = Record<
  string,
  {
    position: number
    score: number
  }
>

const compareSortOrderMap = {
  asc: (a: number, b: number) => a - b,
  desc: (a: number, b: number) => b - a,
}

type GameModeFinalizationConfig = {
  getScore: (session: SortablePlayerGameSession, gameState: Doc<"gameStates">) => number
  compareScore: (a: number, b: number) => number
  worstScore: number
}

const getPlayerPositions = (
  gameState: Doc<"gameStates">,
  sessions: PlayerGameSessionToSort[],
  config: GameModeFinalizationConfig,
): PlayerPositionsMap => {
  const sorted = sessions
    .filter(
      (session): session is SortablePlayerGameSession =>
        session.submissionState !== null && session.submissionState?.status === "complete",
    )
    .map((session) => {
      const passing = session.submissionState.programmingResults.filter(
        (r) => r.status === "success",
      )
      const numPassing = passing.length
      return {
        ...session,
        numPassing: numPassing,
        score:
          numPassing === 0
            ? config.worstScore
            : config.getScore(
                {
                  ...session,
                  submissionState: {
                    ...session.submissionState,
                    programmingResults: passing,
                  },
                },
                gameState,
              ),
      }
    })
    .sort((a, b) => {
      const diffPassing = b.numPassing - a.numPassing

      if (diffPassing !== 0) {
        return diffPassing
      }

      return config.compareScore(a.score, b.score)
    })

  const playerPositionsMap = Object.fromEntries(
    sorted.map((session, i) => [session.user_id, { position: i, score: session.score }] as const),
  )

  return playerPositionsMap
}

const getTotalRuntime = (session: SortablePlayerGameSession) => {
  return session.submissionState.programmingResults
    .filter((r) => r.status === "success" && r.run_duration_ms)
    .reduce((acc, r) => acc + r.run_duration_ms, 0)
}
const getTotalCharactersUsed = (session: PlayerGameSessionToSort) => {
  return session.chatHistory
    .map((m) => (m.content.type === "instructions" ? m.content.instructions.length : 0))
    .reduce((acc, v) => acc + v, 0)
}

type GameModeFinalizationConfigMap = Record<GameMode, GameModeFinalizationConfig>

const gameModeFinalizationConfigMap: GameModeFinalizationConfigMap = {
  "fastest-player": {
    /**
     * time since start of game stored in ms. lower is better
     */
    getScore: (session, gameState) =>
      session.submissionState.last_submitted_at.getTime() - (gameState.start_time?.getTime() ?? 0),
    compareScore: compareSortOrderMap.asc,
    worstScore: INTEGER_RANGE.max,
  },
  "fastest-code": {
    /**
     * total runtime for passing code. lower is better
     */
    getScore: getTotalRuntime,
    compareScore: compareSortOrderMap.asc,
    worstScore: INTEGER_RANGE.max,
  },
  "shortest-code": {
    /**
     * returns code length. lower is better
     */
    getScore: (session) => session.code.length,
    compareScore: compareSortOrderMap.asc,
    worstScore: INTEGER_RANGE.max,
  },
  "fewest-characters-to-llm": {
    /**
     * returns number of characters sent to LLM. lower is better
     */
    getScore: getTotalCharactersUsed,
    compareScore: compareSortOrderMap.asc,
    worstScore: INTEGER_RANGE.max,
  },
}

export function getWorseScoreForGameMode(gameMode: GameMode) {
  return gameModeFinalizationConfigMap[gameMode].worstScore
}

export const getPlayerPositionsForGameMode = (
  game: Doc<"gameStates">,
  playerGameSessions: PlayerGameSessionToSort[],
) => {
  const finalizationConfig = gameModeFinalizationConfigMap[game.mode]

  invariant(finalizationConfig, `Unknown game mode: ${game.mode}`)

  const positions: PlayerPositionsMap = getPlayerPositions(
    game,
    playerGameSessions,
    finalizationConfig,
  )

  return playerGameSessions.map((session) => ({
    player_game_session_id: session.id,
    position: positions[session.user_id]?.position ?? playerGameSessions.length + 2,
    score: positions[session.user_id]?.score ?? 0,
  }))
}
