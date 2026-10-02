// ════════════════════════════════════════
//  数据类型（framework-agnostic）
// ════════════════════════════════════════

/** 可被 mention 的数据项 */
export interface MentionItem {
  id: string
  label: string
  [key: string]: any
}

/** 触发器模式 */
export type TriggerMode = 'inline' | 'command'

/**
 * 分页请求信息。仅当触发器配置了 `pagination` 时，作为第二参数传给函数型数据源。
 * - offset: 本次请求应从第几条开始（= 已加载条数）
 * - limit: 每页条数（= pagination.pageSize）
 * 既可用于 offset-based 后端（?offset=&limit=），也可反推 page（offset / limit）。
 */
export interface MentionPageInfo {
  offset: number
  limit: number
}

/**
 * 函数型数据源的返回形态：
 * - 裸数组：按 `length >= limit` 推断是否还有下一页
 * - `{ items, hasMore }`：由后端显式告知是否还有下一页（hasMore 省略时回退到推断）
 */
export type MentionItemsResult =
  | MentionItem[]
  | { items: MentionItem[]; hasMore?: boolean }

/** 触发器配置 */
export interface MentionTrigger {
  /** 触发字符，如 '@', '#', '/' */
  char: string

  /** 触发器模式，默认 'inline' */
  mode?: TriggerMode

  /**
   * 是否允许触发符紧跟在 ASCII 单词字符之后。默认 false：当触发符前一个字符匹配
   * /\w/（ASCII 字母、数字、下划线）时不触发，避免 `a@b.com` 这类邮箱 / 网址误触发
   * 列表；文本节点开头及空白、NBSP、中文等非 ASCII 字符、标点之后照常触发。
   * 设为 true 时恢复旧行为（任何位置都触发，不做边界检查）。
   */
  allowMidWord?: boolean

  /**
   * 数据源。支持：
   * - 静态数组
   * - 同步过滤函数
   * - 异步函数（返回 Promise，用于远程搜索）
   *
   * 当触发器配置了 `pagination` 时，函数会收到第二参数 {@link MentionPageInfo}，
   * 并可返回 `{ items, hasMore }` 以支持后端分页 / 滚动加载更多。
   */
  items:
    | MentionItem[]
    | ((query: string, page?: MentionPageInfo) => MentionItemsResult | Promise<MentionItemsResult>)

  /**
   * 后端分页配置。配置后该触发器启用分页：数据源被逐页调用，用户滚动到列表底部
   * 或键盘导航接近末尾时自动加载下一批，结果追加到列表。仅对函数型数据源生效
   * （静态数组维持一次性全量行为）。
   */
  pagination?: {
    /** 每页条数 */
    pageSize: number
  }

  /** 异步数据源的防抖时间（ms），默认 0（无防抖） */
  debounce?: number

  /** 选中时从完整数据项提取并持久化到 mention 的自定义数据 */
  toData?: (item: MentionItem) => unknown

  /**
   * 自定义此触发器产生的 DataPart 结构（方式一：transformer 函数）
   * @deprecated 将在 3.0 移除，请改用 `toData` 与 `getParts()`。
   * @example
   * dataPart: (item) => ({ type: 'mentioned_ref', projectId: item.id, name: item.label })
   */
  dataPart?: (item: MentionItem) => Record<string, any>

  /**
   * 声明式 schema 映射（方式二：简单场景的语法糖）
   * 如果同时提供了 dataPart 函数，dataPart 函数优先
   * @deprecated 将在 3.0 移除，请改用 `toData` 与 `getParts()`。
   * @example
   * schema: { type: 'mentioned_ref', mapping: { projectId: 'id', name: 'label' } }
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

export interface TextPart {
  type: 'text'
  text: string
}

export interface MentionPart<T = unknown> {
  type: 'mention'
  trigger: string
  id: string
  label: string
  data?: T
}

export type Part<T = unknown> = TextPart | MentionPart<T>

/**
 * 1.x 编辑器内容的结构化片段。
 * @deprecated 将在 3.0 移除，请改用 {@link Part}。
 */
export type ContentPart =
  | { type: 'text'; content: string }
  | {
    type: 'mention'
    triggeredBy: string
    id: string
    label: string
    dataPart?: Record<string, any>
  }

/** 编程式插入 mention 的参数 */
export interface InsertMentionPayload<T = unknown> {
  id: string
  label: string
  trigger?: string
  data?: T

  /** @deprecated 将在 3.0 移除，请改用 `trigger`。 */
  triggeredBy?: string

  /** @deprecated 将在 3.0 移除，请改用 `data`。 */
  dataPart?:
    | Record<string, any>
    | ((item: MentionItem & { triggeredBy: string }) => Record<string, any>)
}

/** 编程式插入 mention 的可选项 */
export interface InsertMentionOptions {
  appendSpace?: boolean
  focus?: boolean
}

/**
 * 1.x 输出给后端的最终序列化结果。
 * @deprecated 将在 3.0 移除，请改用 {@link Part}。
 */
export type DataPart =
  | { type: 'text'; text: string }
  | ({ type: string } & Record<string, any>)

// ════════════════════════════════════════
//  配置与状态
// ════════════════════════════════════════

/** 弹出列表定位模式 */
export type PopupMode = 'fixed' | 'cursor'

/** 滚动时弹窗行为 */
export type PopupScrollBehavior = 'reposition' | 'close' | 'ignore'

/** 光标坐标 */
export interface PopupPosition {
  top: number
  left: number
  width?: number
}

/** MentionCore / useMention 配置选项（framework-agnostic） */
export interface MentionCoreOptions {
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

  /**
   * 滚动时弹窗行为
   * - 'reposition': 重新计算位置（默认）
   * - 'close': 关闭弹窗
   * - 'ignore': 不处理
   */
  popupScrollBehavior?: PopupScrollBehavior
}

/**
 * useMention 配置选项（与 {@link MentionCoreOptions} 同构，对外保留历史命名）。
 * 保持 interface 形态以兼容用户的 declaration merging / module augmentation。
 */
export interface UseMentionOptions extends MentionCoreOptions {}

/** core 为各框架 adapter 提供的无障碍元素 id。 */
export interface MentionCoreIds {
  listbox: string
  option(index: number): string
}

/** core 对外暴露的纯快照状态（供任意框架 adapter 镜像） */
export interface MentionState {
  isOpen: boolean
  filteredItems: MentionItem[]
  activeIndex: number
  query: string
  activeTrigger: string | null
  loading: boolean
  error: unknown | null
  loadingMore: boolean
  hasMore: boolean
  popupPosition: PopupPosition
  isEmpty: boolean
}

/** core 事件处理器集合（DOM 事件名 → handler） */
export interface MentionHandlers {
  input: () => void
  keydown: (e: KeyboardEvent) => void
  beforeinput: (e: InputEvent) => void
  compositionstart: () => void
  compositionend: () => void
  paste: (e: ClipboardEvent) => void
  focus: () => void
  blur: () => void
}

/** core 启动选项 */
export interface AttachOptions {
  /**
   * 是否让 core 自动把输入相关 handlers 绑到元素上。
   * vanilla / React = true（开箱即用）；Vue 组件 = false（自己包装 handlers）。默认 true。
   */
  bindHandlers?: boolean
}
