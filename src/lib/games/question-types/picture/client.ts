import { BaseQuestionStrategy } from "../base"

export class PictureQuestionStrategy extends BaseQuestionStrategy {
  readonly supportedModeIds = [
    "fastest-player",
    "shortest-code",
    "fewest-characters-to-llm",
  ] as const
}
