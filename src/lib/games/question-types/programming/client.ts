import { BaseQuestionStrategy } from "../base"

export class ProgrammingQuestionStrategy extends BaseQuestionStrategy {
  readonly supportedModeIds = [
    "fastest-player",
    "fastest-code",
    "shortest-code",
    "fewest-characters-to-llm",
  ] as const
}
