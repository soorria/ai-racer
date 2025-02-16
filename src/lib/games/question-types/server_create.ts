import type { QuestionType } from "../constants"
import type { ServerQuestionStrategy } from "./base"
import { ServerPictureStrategy } from "./picture/server"
import { ServerProgrammingStrategy } from "./programming/server"

export function createServerQuestionStrategy(type: QuestionType): ServerQuestionStrategy {
  switch (type) {
    case "programming":
      return new ServerProgrammingStrategy()
    case "picture":
      return new ServerPictureStrategy()
    default:
      throw new Error(`Unknown question type`)
  }
}
