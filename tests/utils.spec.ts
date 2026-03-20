import { describe, it, expect } from 'vitest'
import { createMentionSpan, parseDOMToParts, contentPartsToDataParts, restoreContent } from '../src/utils'
import type { ContentPart, MentionTrigger } from '../src/types'

describe('utils', () => {
  it('parses DOM to parts with mentions and newlines', () => {
    const editor = document.createElement('div')
    editor.appendChild(document.createTextNode('Hello '))
    editor.appendChild(createMentionSpan('@', { id: '1', label: 'Alice' }))
    editor.appendChild(document.createTextNode(' there'))
    editor.appendChild(document.createElement('br'))
    editor.appendChild(document.createTextNode('Next'))

    const parts = parseDOMToParts(editor)

    expect(parts).toEqual([
      { type: 'text', content: 'Hello ' },
      { type: 'mention', triggeredBy: '@', id: '1', label: 'Alice' },
      { type: 'text', content: ' there' },
      { type: 'text', content: '\n' },
      { type: 'text', content: 'Next' },
    ])
  })

  it('converts content parts to data parts using dataPart', () => {
    const parts: ContentPart[] = [
      { type: 'text', content: 'Hi ' },
      { type: 'mention', triggeredBy: '@', id: '1', label: 'Alice' },
    ]
    const triggers: MentionTrigger[] = [
      { char: '@', items: [], dataPart: (item) => ({ dataType: 'mentioned_ref', id: item.id, name: item.label }) },
    ]

    const data = contentPartsToDataParts(parts, triggers)

    expect(data).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'data', dataType: 'mentioned_ref', id: '1', name: 'Alice' },
    ])
  })

  it('converts content parts to data parts using schema', () => {
    const parts: ContentPart[] = [
      { type: 'mention', triggeredBy: '#', id: 't1', label: 'bug' },
    ]
    const triggers: MentionTrigger[] = [
      { char: '#', items: [], schema: { type: 'tag_ref', mapping: { tagId: 'id', tagName: 'label' } } },
    ]

    const data = contentPartsToDataParts(parts, triggers)

    expect(data).toEqual([
      { type: 'tag_ref', tagId: 't1', tagName: 'bug' },
    ])
  })

  it('prioritizes mention-level dataPart over trigger mapping', () => {
    const parts: ContentPart[] = [
      {
        type: 'mention',
        triggeredBy: '@',
        id: 'u1',
        label: 'Alice',
        dataPart: { dataType: 'custom_ref', refId: 'external-u1' },
      },
    ]
    const triggerWithMapper: MentionTrigger[] = [
      {
        char: '@',
        items: [],
        dataPart: (item) => ({ dataType: 'mentioned_ref', projectId: item.id }),
      },
    ]

    const data = contentPartsToDataParts(parts, triggerWithMapper)

    expect(data).toEqual([
      { type: 'data', dataType: 'custom_ref', refId: 'external-u1' },
    ])
  })

  it('restores content with mentions and newlines', () => {
    const editor = document.createElement('div')
    const parts: ContentPart[] = [
      { type: 'text', content: 'Hello' },
      { type: 'text', content: '\n' },
      { type: 'mention', triggeredBy: '@', id: '1', label: 'Alice' },
    ]

    restoreContent(editor, parts)

    const mention = editor.querySelector('[data-mention-id="1"]') as HTMLElement
    expect(mention).toBeTruthy()
    expect(mention.textContent).toBe('@Alice')
    expect(editor.innerHTML).toContain('<br')
  })

  it('restores and parses custom mention dataPart from DOM dataset', () => {
    const editor = document.createElement('div')
    const parts: ContentPart[] = [
      {
        type: 'mention',
        triggeredBy: '',
        id: 'ctx-1',
        label: 'Context #1',
        dataPart: {
          dataType: 'context_ref',
          contextId: 'ctx-1',
          content: 'long selected content',
        },
      },
    ]

    restoreContent(editor, parts)
    const parsed = parseDOMToParts(editor)

    expect(parsed).toEqual(parts)
  })
})
