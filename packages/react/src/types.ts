import type { MentionCore } from '@mentionly/core'
import type {
  InsertMentionOptions,
  InsertMentionPayload,
  MentionCoreIds,
  MentionItem,
  MentionState,
  Part,
} from '@mentionly/core'

/** useMention 返回值（React adapter：状态是 core 的不可变快照，配合 useSyncExternalStore） */
export interface UseMentionReturn {
  /**
   * 绑定到 contenteditable 元素的 callback ref。
   * 挂载时 `setElement(el)` + `start({ bindHandlers: true })`，卸载（或元素置 null）时
   * `stop()` + `setElement(null)`；start/stop 成对且幂等，React StrictMode 下安全。
   */
  ref: (el: HTMLElement | null) => void

  /** core 的不可变状态快照；每次 core 通知后都是新引用 */
  state: MentionState

  /** core 生成的无障碍 id（`listbox` / `option(i)`），渲染候选列表时必须使用 */
  ids: MentionCoreIds

  /** 底层 core 实例（组件实例内只创建一次） */
  core: MentionCore

  // ── 操作方法 ──
  select: (item: MentionItem) => void
  insertMention: (payload: InsertMentionPayload, options?: InsertMentionOptions) => boolean
  /** 加载下一页并追加到列表。无下一页 / 正在加载 / 非分页源时为空操作 */
  loadMore: () => void
  close: () => void

  // ── 内容序列化 ──
  getParts: () => Part[]
  getPlainText: () => string

  // ── 编辑器操作 ──
  clear: () => void
  setContent: (parts: Part[]) => void
  focus: () => void
}
