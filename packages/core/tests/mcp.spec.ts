import { describe, it, expect, expectTypeOf } from 'vitest'
import type { ContentBlock, ResourceLink, TextContent } from '@modelcontextprotocol/sdk/types'
import {
  toMCPContent,
  type MCPContent,
  type MCPResourceLink,
  type MCPTextContent,
} from '../src/mcp'
import type { MentionPart, Part } from '../src/types'

// ════════════════════════════════════════
//  类型契约：本地结构类型必须可赋值给官方 MCP SDK 类型
//  （官方类型名取自 @modelcontextprotocol/sdk/dist/esm/types.d.ts，
//   即 TextContentSchema / ResourceLinkSchema / ContentBlockSchema 的推导结果）
// ════════════════════════════════════════

describe('mcp type parity', () => {
  it('local text content matches official TextContent', () => {
    expectTypeOf<MCPTextContent>().toMatchTypeOf<TextContent>()
    // 反向：官方 TextContent 的必需字段与本地一致（漂移检测）
    expectTypeOf<TextContent>().toMatchTypeOf<MCPTextContent>()
    expectTypeOf<TextContent['type']>().toEqualTypeOf<'text'>()
  })

  it('local resource link matches official ResourceLink', () => {
    expectTypeOf<MCPResourceLink>().toMatchTypeOf<ResourceLink>()
    expectTypeOf<ResourceLink>().toMatchTypeOf<MCPResourceLink>()
    expectTypeOf<ResourceLink['type']>().toEqualTypeOf<'resource_link'>()
    expectTypeOf<ResourceLink['uri']>().toEqualTypeOf<string>()
    expectTypeOf<ResourceLink['name']>().toEqualTypeOf<string>()
  })

  it('conversion output matches official ContentBlock union', () => {
    expectTypeOf<MCPContent>().toMatchTypeOf<ContentBlock>()
  })
})

// ════════════════════════════════════════
//  运行时行为
// ════════════════════════════════════════

describe('toMCPContent', () => {
  it('returns an empty array for empty input', () => {
    expect(toMCPContent([])).toEqual([])
  })

  it('converts a single text part', () => {
    expect(toMCPContent([{ type: 'text', text: 'hello' }])).toEqual([
      { type: 'text', text: 'hello' },
    ])
  })

  it('merges adjacent text parts', () => {
    expect(
      toMCPContent([
        { type: 'text', text: 'a' },
        { type: 'text', text: 'b' },
        { type: 'text', text: 'c' },
      ]),
    ).toEqual([{ type: 'text', text: 'abc' }])
  })

  it('does not merge text parts separated by a resource link', () => {
    const parts: Part<{ uri: string }>[] = [
      { type: 'text', text: 'see ' },
      { type: 'mention', trigger: '#', id: 'f1', label: 'a.ts', data: { uri: 'file:///a.ts' } },
      { type: 'text', text: ' now' },
    ]

    expect(toMCPContent(parts)).toEqual([
      { type: 'text', text: 'see ' },
      { type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' },
      { type: 'text', text: ' now' },
    ])
  })

  it('emits a resource_link for a mention whose data.uri is a string (default getUri)', () => {
    const parts: Part[] = [
      { type: 'mention', trigger: '#', id: 'f1', label: 'a.ts', data: { uri: 'file:///a.ts' } },
    ]

    const blocks = toMCPContent(parts)
    expect(blocks).toEqual([{ type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' }])
    expect('mimeType' in (blocks[0] as MCPResourceLink)).toBe(false)
  })

  it('falls back to text (trigger + label) when the mention has no uri', () => {
    const parts: Part[] = [
      { type: 'mention', trigger: '@', id: 'u1', label: 'Alice' },
    ]

    expect(toMCPContent(parts)).toEqual([{ type: 'text', text: '@Alice' }])
  })

  it('merges a no-uri mention into adjacent text', () => {
    const parts: Part[] = [
      { type: 'text', text: 'hi ' },
      { type: 'mention', trigger: '@', id: 'u1', label: 'Alice' },
      { type: 'text', text: '!' },
    ]

    expect(toMCPContent(parts)).toEqual([{ type: 'text', text: 'hi @Alice!' }])
  })

  it('narrows unknown data shapes without throwing', () => {
    const cases: Part[] = [
      { type: 'mention', trigger: '@', id: 'a', label: 'A', data: 'string' },
      { type: 'mention', trigger: '@', id: 'b', label: 'B', data: null },
      { type: 'mention', trigger: '@', id: 'c', label: 'C', data: {} },
      { type: 'mention', trigger: '@', id: 'd', label: 'D', data: { uri: 42 } },
      { type: 'mention', trigger: '@', id: 'e', label: 'E', data: undefined },
    ]

    expect(toMCPContent(cases)).toEqual([{ type: 'text', text: '@A@B@C@D@E' }])
  })

  it('supports custom getUri and getMimeType', () => {
    const parts: Part[] = [
      { type: 'mention', trigger: '#', id: 'f1', label: 'a.ts', data: { path: '/a.ts' } },
    ]

    expect(
      toMCPContent(parts, {
        getUri: (p: MentionPart) => `file://${(p.data as { path: string }).path}`,
        getMimeType: () => 'text/typescript',
      }),
    ).toEqual([
      { type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts', mimeType: 'text/typescript' },
    ])
  })

  it('treats a custom getUri returning undefined as text', () => {
    const parts: Part[] = [
      { type: 'mention', trigger: '#', id: 'f1', label: 'a.ts', data: { uri: 'file:///a.ts' } },
    ]

    expect(toMCPContent(parts, { getUri: () => undefined })).toEqual([
      { type: 'text', text: '#a.ts' },
    ])
  })

  it('omits mimeType when getMimeType returns undefined', () => {
    const parts: Part[] = [
      { type: 'mention', trigger: '#', id: 'f1', label: 'a.ts', data: { uri: 'file:///a.ts' } },
    ]

    const [block] = toMCPContent(parts, { getMimeType: () => undefined })
    expect(block).toEqual({ type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' })
    expect('mimeType' in (block as MCPResourceLink)).toBe(false)
  })
})
