export { MentionCore } from './MentionCore'
export {
  createMentionSpan,
  parseDOMToParts,
  contentPartsToDataParts,
  restoreContent,
  setCursorToEnd,
  getTextBeforeCursor,
  getPlainTextFromParts,
} from './utils'
export type {
  MentionItem,
  MentionTrigger,
  MentionPageInfo,
  MentionItemsResult,
  TriggerMode,
  PopupMode,
  PopupScrollBehavior,
  PopupPosition,
  ContentPart,
  DataPart,
  InsertMentionPayload,
  InsertMentionOptions,
  MentionCoreOptions,
  UseMentionOptions,
  MentionState,
  MentionHandlers,
  AttachOptions,
} from './types'
