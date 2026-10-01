import type { Ref, ComputedRef } from 'vue'
import type {
  MentionItem,
  PopupPosition,
  ContentPart,
  DataPart,
  Part,
  MentionCoreIds,
  InsertMentionPayload,
  InsertMentionOptions,
  MentionHandlers,
} from '@mentionly/core'

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
  /** 数据源最近一次失败的错误对象；下次成功 / close() 后回到 null */
  error: Ref<unknown | null>
  popupPosition: Ref<PopupPosition>

  /** core 生成的无障碍元素 id：列表根元素 + 每个选项 */
  ids: MentionCoreIds

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
  /** 2.0 输出格式：`TextPart | MentionPart` */
  getParts: () => Part[]
  /** @deprecated 将在 3.0 移除，请改用 `getParts()`。 */
  getDataParts: () => DataPart[]
  getPlainText: () => string

  // ── 编辑器操作 ──
  clear: () => void
  /** 接受 2.0 的 Part[]，也兼容 1.x 的 ContentPart[] */
  setContent: (parts: Part[] | ContentPart[]) => void
  focus: () => void
  isEmpty: ComputedRef<boolean>

  // ── 事件处理器 ──
  handlers: MentionHandlers
}
