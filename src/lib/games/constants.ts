import type { LucideIcon } from "lucide-react"
import { Gauge, MessageCircle, Minimize2, Timer } from "lucide-react"
import ms from "ms"

import type { gameStatusEnum, questionDifficultyEnum } from "../db/schema"
import type { Doc } from "../db/types"
import { entries } from "../utils/object"

export const DEFAULT_GAME_DURATIONS = {
  waitingForPlayers: ms("30s"),
  inProgress: ms("5m"),
}

export type QuestionType = (typeof QUESTION_TYPES)[number]
export const QUESTION_TYPES = ["programming", "picture"] as const

export type GameMode = (typeof GAME_MODES)[number]
export const GAME_MODES = [
  "fastest-player",
  "fastest-code",
  "shortest-code",
  "fewest-characters-to-llm",
] as const

export type QuestionDifficultyLevels = (typeof questionDifficultyEnum)["enumValues"][number]
// this isnt a strict satisfies need to think how to do it strictly
export const QUESTION_DIFFICULTY_LEVELS = [
  "easy",
  "medium",
  "hard",
] as const satisfies QuestionDifficultyLevels[]

export type GameStatus = (typeof gameStatusEnum)["enumValues"][number]
export const GAME_STATUS = [
  "waitingForPlayers",
  "inProgress",
  "finished",
] as const satisfies GameStatus[]

export const LLM_PROMPTING_TIMEOUT = ms("10s")
export const CODE_SUBMISSION_TIMEOUT = ms("10s")
export const FINALIZING_SUBMISSION_BUFFER_TIME = ms("2s")

export type GameModeIds = Doc<"gameStates">["mode"]
export type GameModeDetailsItem = {
  title: string
  description: string
  unitLong: string
  unitShort: string
  toDisplayValue: (value: number) => number
  icon: LucideIcon
  color: string
}
export const GAME_MODE_DETAILS: Record<GameModeIds, GameModeDetailsItem> = {
  "fastest-player": {
    title: "Speed Demon",
    description: "Race against others to solve the challenge first. Fast thinking wins!",
    unitLong: "minutes",
    unitShort: "min",
    toDisplayValue: (ms: number) => parseFloat((ms / 1000 / 60).toFixed(2)),
    icon: Timer,
    color: "#fdba74",
  },
  "fastest-code": {
    title: "Turbo Code",
    description: "Your code needs speed! Create the fastest executing solution.",
    unitLong: "milliseconds",
    unitShort: "ms",
    toDisplayValue: (ms: number) => ms,
    icon: Gauge,
    color: "#86efac",
  },
  "shortest-code": {
    title: "Minimalist",
    description: "Less is more. Write working code with the fewest characters possible.",
    unitLong: "characters",
    unitShort: "ch",
    toDisplayValue: (v) => v,
    icon: Minimize2,
    color: "#d8b4fe",
  },
  "fewest-characters-to-llm": {
    title: "AI Whisperer",
    description: "Master of brevity. Craft the shortest prompt that gets the job done.",
    unitLong: "characters",
    unitShort: "ch",
    toDisplayValue: (v) => v,
    icon: MessageCircle,
    color: "#93c5fd",
  },
}
export const GAME_MODE_DETAILS_LIST = entries(GAME_MODE_DETAILS).map(([id, details]) => ({
  id: id,
  ...details,
}))

export const MAX_SEND_MESSAGE_CHARACTER_LIMIT = 80
