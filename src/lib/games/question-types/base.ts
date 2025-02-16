import { invariant } from "@epic-web/invariant"

import type { GameMode, GameModeDetailsItem, QuestionDifficultyLevels } from "../constants"
import type { DBOrTransaction, Doc } from "~/lib/db/types"
import { entries } from "~/lib/utils/object"
import { randomElement } from "~/lib/utils/random"
import { GAME_MODE_DETAILS } from "../constants"

export interface ClientQuestionStrategy {
  readonly supportedGameModes: ({ id: GameMode } & GameModeDetailsItem)[]
  readonly getRandomGameMode: () => GameMode
}

export interface ServerQuestionStrategy extends ClientQuestionStrategy {
  getOrGenerateQuestion(
    tx: DBOrTransaction,
    options: {
      difficulty?: QuestionDifficultyLevels
    },
  ): Promise<
    Doc<"questions"> & {
      programmingQuestion: Doc<"programmingQuestions"> | null
      pictureQuestion: Doc<"pictureQuestions"> | null
    }
  >

  isCompatibleQuestion(question: {
    programmingQuestion: object | null
    pictureQuestion: object | null
  }): boolean
}

export abstract class BaseQuestionStrategy implements ClientQuestionStrategy {
  protected abstract readonly supportedModeIds: readonly GameMode[]

  get supportedGameModes() {
    return entries(GAME_MODE_DETAILS)
      .filter(([id]) => this.supportedModeIds.includes(id))
      .map(([id, details]) => ({ id, ...details }))
  }

  getRandomGameMode() {
    invariant(this.supportedModeIds.length > 0, "No supported game modes")
    return randomElement(this.supportedModeIds)!
  }
}
