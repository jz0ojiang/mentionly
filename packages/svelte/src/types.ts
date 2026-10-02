import type { Action } from 'svelte/action'
import type {
  InsertMentionOptions,
  InsertMentionPayload,
  MentionCore,
  MentionCoreIds,
  MentionCoreOptions,
  MentionItem,
  MentionState,
  Part,
} from '@mentionly/core'

/**
 * `createMention()` 的返回值。状态用 Svelte 5 runes（`$state`）镜像，其余方法直接
 * 代理到内部的 {@link MentionCore} 实例，因此行为与框架无关的 core 完全一致。
 */
export interface CreateMentionReturn {
  /** core 状态的响应式镜像（`$state`），读取即可建立依赖 */
  readonly state: MentionState

  /** core 分配的无障碍元素 id，渲染列表时必须使用 */
  readonly ids: MentionCoreIds

  /** 底层实例，escape hatch */
  readonly core: MentionCore

  /** 绑定 contenteditable 编辑器元素：`<div contenteditable use:mention.mention></div>` */
  mention: Action<HTMLElement>

  /** 合并更新选项（triggers 引用变化时会关闭列表并作废在途请求） */
  setOptions(partial: Partial<MentionCoreOptions>): void

  select(item: MentionItem): void
  insertMention(payload: InsertMentionPayload, options?: InsertMentionOptions): boolean
  loadMore(): void
  close(): void
  getParts(): Part[]
  getPlainText(): string
  clear(): void
  setContent(parts: Part[]): void
  focus(): void
}
