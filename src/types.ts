import type { Ref, ComputedRef } from 'vue'

// ════════════════════════════════════════
//  数据类型
// ════════════════════════════════════════

/** 可被 mention 的数据项 */
export interface MentionItem {
  id: string
  label: string
  [key: string]: any
}

/** 触发器模式 */
export type TriggerMode = 'inline' | 'command'

/** 触发器配置 */
export interface MentionTrigger {
  /** 触发字符，如 '@', '#', '/' */
  char: string

  /** 触发器模式，默认 'inline' */
  mode?: TriggerMode

  /**
   * 数据源。支持：
   * - 静态数组
   * - 同步过滤函数
   * - 异步函数（返回 Promise，用于远程搜索）
   */
  items:
    | MentionItem[]
    | ((query: string) => MentionItem[] | Promise<MentionItem[]>)

  /** 异步数据源的防抖时间（ms），默认 0（无防抖） */
  debounce?: number

  /**
   * 自定义此触发器产生的 DataPart 结构（方式一：transformer 函数）
   * @example
   * dataPart: (item) => ({ type: 'project_ref', projectId: item.id, name: item.label })
   */
  dataPart?: (item: MentionItem) => Record<string, any>

  /**
   * 声明式 schema 映射（方式二：简单场景的语法糖）
   * 如果同时提供了 dataPart 函数，dataPart 函数优先
   * @example
   * schema: { type: 'project_ref', mapping: { projectId: 'id', name: 'label' } }
   */
  schema?: {
    type: string
    mapping: Record<string, string>
  }

  /** command 模式下选中后的回调（仅 mode='command' 时使用） */
  onSelect?: (item: MentionItem) => void
}

// ════════════════════════════════════════
//  内容模型
// ════════════════════════════════════════

/** 内部中间表示：编辑器内容的结构化片段 */
export type ContentPart =
  | { type: 'text'; content: string }
  | { type: 'mention'; triggeredBy: string; id: string; label: string }

/** 输出给后端的 DataPart（最终序列化结果） */
export type DataPart =
  | { type: 'text'; text: string }
  | ({ type: 'data' } & Record<string, any>)

// ════════════════════════════════════════
//  composable 配置与返回值
// ════════════════════════════════════════

/** 弹出列表定位模式 */
export type PopupMode = 'fixed' | 'cursor'

/** 光标坐标 */
export interface PopupPosition {
  top: number
  left: number
  width?: number
}

/** useMention 配置选项 */
export interface UseMentionOptions {
  /** 触发器配置，支持多个 */
  triggers: MentionTrigger[]

  /** 是否在 mention 后自动插入空格，默认 true */
  insertSpaceAfter?: boolean

  /**
   * 弹出列表定位模式
   * - 'fixed': 默认，固定在编辑器上方/下方
   * - 'cursor': 跟随光标位置弹出
   */
  popupMode?: PopupMode
}

/** useMention 返回值 */
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

  // ── 操作方法 ──
  select: (item: MentionItem) => void
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
  handlers: {
    input: () => void
    keydown: (e: KeyboardEvent) => void
    beforeinput: (e: InputEvent) => void
    compositionstart: () => void
    compositionend: () => void
    paste: (e: ClipboardEvent) => void
    focus: () => void
    blur: () => void
  }
}
