import type { Doc } from "../db/types"
import type { ChatHistoryItemContentType, ChatHistoryItemContentWithType } from "./schemas"
import { orderBy, schema } from "../db"

export function chatHistoryItemTypeIs<Type extends ChatHistoryItemContentType>(
  item: Doc<"playerGameSessionChatHistoryItems">,
  type: Type,
): item is Doc<"playerGameSessionChatHistoryItems"> & {
  content: ChatHistoryItemContentWithType<Type>
} {
  return item.content.type === type
}

export function getQuestionTestCasesOrderBy() {
  return orderBy.asc(schema.programmingQuestionTestCases.id)
}
