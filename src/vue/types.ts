import type { Ref, ComputedRef } from 'vue'
import type {
  MentionItem,
  PopupPosition,
  ContentPart,
  DataPart,
  InsertMentionPayload,
  InsertMentionOptions,
  MentionHandlers,
} from '../core/types'

/** useMention 返回值（Vue adapter 特有：状态以 ref / computed 暴露） */
export interface UseMentionReturn {
  /** 绑定到 contenteditable 元素的 ref */
  editorRef: Ref<HTMLElement | null>

  // ── 下拉列表状态 ──
  isOpen: Ref<boolean>
  filteredItems: Ref<MentionItem[]>
  activeIndex: Ref<number>
  query: Ref<string>
  activeTrigger: Ref<string | null>
  loading: Ref<boolean>
  popupPosition: Ref<PopupPosition>

  // ── 分页状态 ──
  /** 当前激活触发器是否还有下一页（仅分页触发器为 true） */
  hasMore: Ref<boolean>
  /** 是否正在加载下一页（区别于首屏 loading，不会清空已加载列表） */
  loadingMore: Ref<boolean>

  // ── 操作方法 ──
  select: (item: MentionItem) => void
  insertMention: (payload: InsertMentionPayload, options?: InsertMentionOptions) => boolean
  /** 加载下一页并追加到列表。无下一页 / 正在加载 / 非分页源时为空操作 */
  loadMore: () => void
  close: () => void

  // ── 内容序列化 ──
  getParts: () => ContentPart[]
  getDataParts: () => DataPart[]
  getPlainText: () => string

  // ── 编辑器操作 ──
  clear: () => void
  setContent: (parts: ContentPart[]) => void
  focus: () => void
  isEmpty: ComputedRef<boolean>

  // ── 事件处理器 ──
  handlers: MentionHandlers
}
