// ════════════════════════════════════════
//  MCP 兼容层（子路径 @mentionly/core/mcp）
//
//  把 mentionly 的 Part[] 转成 MCP 的 content blocks。
//  为了保持 @mentionly/core 零运行时依赖，官方类型在这里按结构本地重声明，
//  既不 import MCP SDK 的运行时代码，也不 import 它的类型。
// ════════════════════════════════════════

import type { MentionPart, Part } from './types'

/**
 * MCP 的文本 content block。
 * 对应官方 `TextContent`（由 `TextContentSchema` 推导）。
 */
export type MCPTextContent = {
  type: 'text'
  text: string
}

/**
 * MCP 的资源链接 content block。
 * 对应官方 `ResourceLink`（由 `ResourceLinkSchema` 推导）。
 */
export type MCPResourceLink = {
  type: 'resource_link'
  uri: string
  name: string
  mimeType?: string
  description?: string
}

/** {@link toMCPContent} 输出的 content block 联合类型。 */
export type MCPContent = MCPTextContent | MCPResourceLink

/** {@link toMCPContent} 的可选项。 */
export interface ToMCPContentOptions {
  /**
   * 从 mention 中取出资源 uri。返回 `undefined` / 非字符串时该 mention 退化为文本。
   * 默认读取 `part.data?.uri`（仅在 `data` 确实是对象且 `uri` 是字符串时命中）。
   */
  getUri?: (part: MentionPart) => string | undefined

  /**
   * 从 mention 中取出资源 MIME 类型。返回 `undefined` 时不写出 `mimeType` 键。
   */
  getMimeType?: (part: MentionPart) => string | undefined
}

/**
 * 把 mentionly 的 {@link Part} 数组转成 MCP content blocks。
 *
 * - `text` → `{ type: 'text', text }`
 * - 带 uri 的 `mention` → `{ type: 'resource_link', uri, name: label, mimeType? }`
 * - 不带 uri 的 `mention` → 文本 `trigger + label`
 *
 * 相邻的文本 block（包括由无 uri mention 退化而来的文本）会合并成一个。
 *
 * @example
 * ```ts
 * toMCPContent(core.getParts())
 * // [{ type: 'text', text: 'see ' },
 * //  { type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' }]
 * ```
 */
export function toMCPContent<T = unknown>(
  parts: readonly Part<T>[],
  opts: ToMCPContentOptions = {},
): MCPContent[] {
  const getUri = opts.getUri ?? defaultGetUri
  const getMimeType = opts.getMimeType
  const output: MCPContent[] = []

  const pushText = (text: string): void => {
    const last = output[output.length - 1]
    if (last !== undefined && last.type === 'text') {
      last.text += text
      return
    }
    output.push({ type: 'text', text })
  }

  for (const part of parts) {
    if (part.type === 'text') {
      pushText(part.text)
      continue
    }

    const uri = getUri(part)
    if (typeof uri === 'string') {
      const block: MCPResourceLink = {
        type: 'resource_link',
        uri,
        name: part.label,
      }
      const mimeType = getMimeType?.(part)
      if (mimeType !== undefined) {
        block.mimeType = mimeType
      }
      output.push(block)
      continue
    }

    pushText(part.trigger + part.label)
  }

  return output
}

/** 默认 uri 提取器：`part.data?.uri`，并对未知的 data 形状做类型收窄。 */
function defaultGetUri(part: MentionPart): string | undefined {
  const data = part.data
  if (typeof data !== 'object' || data === null) return undefined
  const uri = (data as { uri?: unknown }).uri
  return typeof uri === 'string' ? uri : undefined
}
