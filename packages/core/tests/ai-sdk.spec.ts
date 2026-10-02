import { describe, it, expect, expectTypeOf } from 'vitest'
import type {
  DataUIPart,
  TextUIPart,
  UIDataTypes,
  UIMessage,
  UIMessagePart,
  UITools,
  convertToModelMessages,
} from 'ai'
import {
  toUIMessageParts,
  fromUIMessageParts,
  type AISDKDataPart,
  type AISDKTextPart,
  type AISDKUIPart,
  type MentionDataPayload,
} from '../src/ai-sdk'
import type { Part } from '../src/types'

// ════════════════════════════════════════
//  类型契约：本地结构类型必须可赋值给官方 AI SDK 类型
//  （官方类型名取自 node_modules/ai/dist/index.d.ts）
// ════════════════════════════════════════

type MentionDataTypes = { mention: MentionDataPayload }

describe('ai-sdk type parity', () => {
  it('local text part matches official TextUIPart', () => {
    expectTypeOf<AISDKTextPart>().toMatchTypeOf<TextUIPart>()
    // 官方 TextUIPart 的必需字段也应被本地类型覆盖
    expectTypeOf<TextUIPart['type']>().toEqualTypeOf<'text'>()
    expectTypeOf<AISDKTextPart['text']>().toEqualTypeOf<string>()
  })

  it('local data part matches official DataUIPart branch', () => {
    expectTypeOf<AISDKDataPart<'mention', MentionDataPayload>>().toMatchTypeOf<
      DataUIPart<MentionDataTypes>
    >()
    expectTypeOf<AISDKDataPart<'mention', MentionDataPayload>['type']>().toEqualTypeOf<'data-mention'>()
    expectTypeOf<AISDKDataPart<'mention', MentionDataPayload>['id']>().toEqualTypeOf<
      string | undefined
    >()
  })

  it('whole conversion output matches official UIMessagePart union', () => {
    expectTypeOf<AISDKUIPart>().toMatchTypeOf<UIMessagePart<UIDataTypes, UITools>>()
    expectTypeOf<
      AISDKTextPart | AISDKDataPart<'mention', MentionDataPayload>
    >().toMatchTypeOf<UIMessagePart<MentionDataTypes, UITools>>()
  })

  it('convertToModelMessages accepts a convertDataPart callback over our data part', () => {
    type MyMessage = UIMessage<unknown, MentionDataTypes>
    type ConvertDataPart = NonNullable<
      NonNullable<Parameters<typeof convertToModelMessages<MyMessage>>[1]>['convertDataPart']
    >

    const convertDataPart: ConvertDataPart = (part) => {
      if (part.type === 'data-mention') {
        return { type: 'text', text: `@${part.data.label}(${part.data.id})` }
      }
      return undefined
    }

    expectTypeOf(convertDataPart).toBeFunction()
    expect(typeof convertDataPart).toBe('function')
  })
})

// ════════════════════════════════════════
//  运行时行为
// ════════════════════════════════════════

describe('toUIMessageParts', () => {
  it('returns an empty array for empty input', () => {
    expect(toUIMessageParts([])).toEqual([])
  })

  it('converts text parts as-is', () => {
    expect(toUIMessageParts([{ type: 'text', text: 'hello' }])).toEqual([
      { type: 'text', text: 'hello' },
    ])
  })

  it('converts a mention without data and omits the data key', () => {
    const [part] = toUIMessageParts([
      { type: 'mention', trigger: '@', id: 'u1', label: 'Alice' },
    ])

    expect(part).toEqual({
      type: 'data-mention',
      data: { trigger: '@', id: 'u1', label: 'Alice' },
    })
    expect('data' in (part as { data: MentionDataPayload }).data).toBe(false)
  })

  it('converts a mention carrying custom data', () => {
    const parts: Part<{ uri: string }>[] = [
      { type: 'mention', trigger: '#', id: 'f1', label: 'index.ts', data: { uri: 'file:///index.ts' } },
    ]

    expect(toUIMessageParts(parts)).toEqual([
      {
        type: 'data-mention',
        data: { trigger: '#', id: 'f1', label: 'index.ts', data: { uri: 'file:///index.ts' } },
      },
    ])
  })

  it('honours a custom dataPartName', () => {
    expect(
      toUIMessageParts([{ type: 'mention', trigger: '@', id: 'u1', label: 'Alice' }], {
        dataPartName: 'ref',
      }),
    ).toEqual([
      { type: 'data-ref', data: { trigger: '@', id: 'u1', label: 'Alice' } },
    ])
  })

  it('keeps adjacent mentions separate', () => {
    expect(
      toUIMessageParts([
        { type: 'mention', trigger: '@', id: 'a', label: 'A' },
        { type: 'mention', trigger: '@', id: 'b', label: 'B' },
      ]),
    ).toEqual([
      { type: 'data-mention', data: { trigger: '@', id: 'a', label: 'A' } },
      { type: 'data-mention', data: { trigger: '@', id: 'b', label: 'B' } },
    ])
  })
})

describe('fromUIMessageParts', () => {
  it('round-trips mixed content exactly', () => {
    const parts: Part<{ n: number }>[] = [
      { type: 'text', text: 'hi ' },
      { type: 'mention', trigger: '@', id: 'u1', label: 'Alice' },
      { type: 'text', text: ' and ' },
      { type: 'mention', trigger: '#', id: 'f1', label: 'index.ts', data: { n: 1 } },
      { type: 'text', text: '!' },
    ]

    expect(fromUIMessageParts(toUIMessageParts(parts))).toEqual(parts)
  })

  it('round-trips with a custom dataPartName when the same name is passed back', () => {
    const parts: Part[] = [
      { type: 'text', text: 'hi ' },
      { type: 'mention', trigger: '@', id: 'u1', label: 'Alice' },
    ]

    const uiParts = toUIMessageParts(parts, { dataPartName: 'ref' })
    expect(fromUIMessageParts(uiParts, { dataPartName: 'ref' })).toEqual(parts)
  })

  it('round-trips a custom dataPartName without opts (payload shape detection)', () => {
    const parts: Part[] = [{ type: 'mention', trigger: '@', id: 'u1', label: 'Alice' }]
    expect(fromUIMessageParts(toUIMessageParts(parts, { dataPartName: 'ref' }))).toEqual(parts)
  })

  it('skips non-text, non-mention UI parts', () => {
    const uiParts = [
      { type: 'text', text: 'a' },
      { type: 'file', mediaType: 'image/png', url: 'data:...' },
      { type: 'reasoning', text: 'thinking' },
      { type: 'tool-call', toolCallId: 't1' },
      { type: 'step-start' },
      { type: 'source-url', sourceId: 's1', url: 'https://example.com' },
      { type: 'text', text: 'b' },
    ] as unknown as Parameters<typeof fromUIMessageParts>[0]

    expect(fromUIMessageParts(uiParts)).toEqual([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ])
  })

  it('skips malformed data parts', () => {
    const uiParts = [
      { type: 'data-mention', data: { trigger: '@', id: 'u1' } }, // 缺 label
      { type: 'data-mention', data: null },
      { type: 'data-other', data: { foo: 1 } },
      { type: 'data-mention', data: 'nope' },
    ] as unknown as Parameters<typeof fromUIMessageParts>[0]

    expect(fromUIMessageParts(uiParts)).toEqual([])
  })

  it('filters by dataPartName when provided', () => {
    const uiParts = [
      { type: 'data-mention', data: { trigger: '@', id: 'u1', label: 'Alice' } },
      { type: 'data-ref', data: { trigger: '#', id: 'f1', label: 'index.ts' } },
    ] as unknown as Parameters<typeof fromUIMessageParts>[0]

    expect(fromUIMessageParts(uiParts, { dataPartName: 'ref' })).toEqual([
      { type: 'mention', trigger: '#', id: 'f1', label: 'index.ts' },
    ])
  })

  it('ignores text parts whose text is not a string', () => {
    const uiParts = [{ type: 'text' }] as unknown as Parameters<typeof fromUIMessageParts>[0]
    expect(fromUIMessageParts(uiParts)).toEqual([])
  })
})
