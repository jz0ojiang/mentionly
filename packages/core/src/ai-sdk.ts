// ════════════════════════════════════════
//  AI SDK 兼容层（子路径 @mentionly/core/ai-sdk）
//
//  把 mentionly 的 Part[] 与 Vercel AI SDK 的 UI message parts 互相转换。
//  为了保持 @mentionly/core 零运行时依赖，官方类型在这里按结构本地重声明，
//  既不 import `ai` 的运行时代码，也不 import 它的类型。
// ════════════════════════════════════════

import type { MentionPart, Part } from './types'

/**
 * AI SDK UI message 里 text part 的结构等价定义。
 * 对应官方 `TextUIPart`（`UIMessagePart` 的 `text` 分支）。
 */
export type AISDKTextPart = {
  type: 'text'
  text: string
}

/**
 * AI SDK UI message 里单个 data part 的结构等价定义。
 * 对应官方 `DataUIPart<DATA_TYPES>` 中的 `data-${NAME}` 分支。
 *
 * @typeParam N - data part 名（不含 `data-` 前缀），决定 `type` 的模板字面量
 * @typeParam T - `data` 字段的负载类型
 */
export type AISDKDataPart<N extends string, T = unknown> = {
  type: `data-${N}`
  id?: string
  data: T
}

/**
 * mention data part 携带的负载，例如 `{ type: 'data-mention', data: payload }`。
 */
export type MentionDataPayload<T = unknown> = {
  /** 触发字符，如 `@`、`#` */
  trigger: string
  /** 被提及实体的 id */
  id: string
  /** 展示文案 */
  label: string
  /** 由 `MentionTrigger.toData` 产出的自定义数据（无数据时省略该键） */
  data?: T
}

/** {@link toUIMessageParts} 输出的 element 类型。 */
export type AISDKUIPart = AISDKTextPart | AISDKDataPart<string, MentionDataPayload>

/**
 * {@link fromUIMessageParts} 接受的宽松输入形状。
 *
 * 官方 `UIMessagePart<DATA_TYPES, TOOLS>` 的任意分支（text / file / reasoning /
 * tool / source / data …）都能赋值给它；转换时只消费 `text` 与 `data-*`。
 */
export type AISDKUIPartLike = {
  type: string
  text?: string | undefined
  id?: string | undefined
  data?: unknown
}

/** {@link toUIMessageParts} 的可选项。 */
export interface ToUIMessagePartsOptions {
  /**
   * data part 名（不含 `data-` 前缀），默认 `'mention'`，
   * 即输出 `{ type: 'data-mention', data: ... }`。
   */
  dataPartName?: string
}

/** {@link fromUIMessageParts} 的可选项。 */
export interface FromUIMessagePartsOptions {
  /**
   * 只转换该名字的 data part（不含 `data-` 前缀）。
   * 省略时接受任意 `data-*` 且负载形状符合 {@link MentionDataPayload} 的 part。
   */
  dataPartName?: string
}

/**
 * 把 mentionly 的 {@link Part} 数组转成 AI SDK 的 UI message parts。
 *
 * - `text` → `{ type: 'text', text }`
 * - `mention` → `{ type: 'data-<name>', data: { trigger, id, label, data? } }`
 *   （`data` 为 `undefined` 时不写出该键）
 *
 * 与 {@link fromUIMessageParts} 互为逆运算，满足
 * `fromUIMessageParts(toUIMessageParts(x))` 深等于 `x`。
 *
 * @example
 * ```ts
 * const uiParts = toUIMessageParts(core.getParts())
 * // [{ type: 'text', text: 'hi ' },
 * //  { type: 'data-mention', data: { trigger: '@', id: 'u1', label: 'Alice' } }]
 * ```
 *
 * ## 服务端：别忘了 `convertDataPart`
 *
 * AI SDK 的 `convertToModelMessages` **默认会丢弃 user message 里的 data part**，
 * 模型看不到 mention。需要显式传 `convertDataPart`，把 mention 转成模型能读的
 * text（或 file）part；返回 `undefined` 表示忽略该 part：
 *
 * ```ts
 * import { convertToModelMessages, type UIMessage } from 'ai'
 *
 * type MyMessage = UIMessage<unknown, { mention: MentionDataPayload }>
 *
 * const modelMessages = await convertToModelMessages<MyMessage>(messages, {
 *   convertDataPart: (part) => {
 *     if (part.type === 'data-mention') {
 *       return { type: 'text', text: `@${part.data.label}(${part.data.id})` }
 *     }
 *     return undefined
 *   },
 * })
 * ```
 */
export function toUIMessageParts<T = unknown>(
  parts: readonly Part<T>[],
  opts: ToUIMessagePartsOptions = {},
): AISDKUIPart[] {
  const dataPartName = opts.dataPartName ?? 'mention'
  const output: AISDKUIPart[] = []

  for (const part of parts) {
    if (part.type === 'text') {
      output.push({ type: 'text', text: part.text })
      continue
    }

    const data: MentionDataPayload<T> = {
      trigger: part.trigger,
      id: part.id,
      label: part.label,
    }
    if (part.data !== undefined) {
      data.data = part.data
    }
    output.push({ type: `data-${dataPartName}`, data })
  }

  return output
}

/**
 * 把 AI SDK 的 UI message parts 还原成 mentionly 的 {@link Part} 数组。
 *
 * - `{ type: 'text' }` → `TextPart`
 * - `{ type: 'data-*' }`（负载形状符合 {@link MentionDataPayload}）→ `MentionPart`
 * - 其他分支（file、reasoning、tool、source、自定义 data …）一律跳过
 *
 * @param uiParts 任意 AI SDK UI message parts（或已经过 {@link toUIMessageParts} 的结果）
 * @param opts 见 {@link FromUIMessagePartsOptions}
 */
export function fromUIMessageParts(
  uiParts: readonly AISDKUIPartLike[],
  opts: FromUIMessagePartsOptions = {},
): Part[] {
  const output: Part[] = []

  for (const uiPart of uiParts) {
    if (uiPart.type === 'text') {
      if (typeof uiPart.text === 'string') {
        output.push({ type: 'text', text: uiPart.text })
      }
      continue
    }

    if (!uiPart.type.startsWith('data-')) continue
    if (opts.dataPartName !== undefined && uiPart.type !== `data-${opts.dataPartName}`) {
      continue
    }
    if (!isMentionDataPayload(uiPart.data)) continue

    const part: MentionPart = {
      type: 'mention',
      trigger: uiPart.data.trigger,
      id: uiPart.data.id,
      label: uiPart.data.label,
    }
    if (uiPart.data.data !== undefined) {
      part.data = uiPart.data.data
    }
    output.push(part)
  }

  return output
}

/** 结构收窄：判断一个未知值是否是 {@link MentionDataPayload}。 */
function isMentionDataPayload(value: unknown): value is MentionDataPayload {
  if (typeof value !== 'object' || value === null) return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.trigger === 'string' &&
    typeof payload.id === 'string' &&
    typeof payload.label === 'string'
  )
}
