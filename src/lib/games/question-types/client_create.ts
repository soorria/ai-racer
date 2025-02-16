import type { QuestionType } from "../constants"
import type { ClientQuestionStrategy } from "./base"
import { PictureQuestionStrategy } from "./picture/client"
import { ProgrammingQuestionStrategy } from "./programming/client"

export function createClientQuestionStrategy(type: QuestionType): ClientQuestionStrategy {
  switch (type) {
    case "programming":
      return new ProgrammingQuestionStrategy()
    case "picture":
      return new PictureQuestionStrategy()
    default:
      throw new Error(`Unknown question type`)
  }
}
