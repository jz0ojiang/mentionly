import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { useMention } from '../src/useMention'
import type { MentionItem, MentionTrigger } from '../src/types'

function createEditorWithText(text: string, cursorOffset = text.length) {
  const editor = document.createElement('div')
  editor.setAttribute('contenteditable', 'true')
  const node = document.createTextNode(text)
  editor.appendChild(node)
  document.body.appendChild(editor)
  editor.focus()
  const range = document.createRange()
  range.setStart(node, cursorOffset)
  range.setEnd(node, cursorOffset)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  return editor
}

function mountUseMention(options: { triggers: MentionTrigger[]; popupScrollBehavior?: 'reposition' | 'close' | 'ignore' }) {
  let api: ReturnType<typeof useMention>
  const wrapper = mount(defineComponent({
    setup() {
      api = useMention(options)
      return () => null
    },
  }))
  return { api: api!, wrapper }
}

describe('useMention', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('opens popup and sets trigger on input', () => {
    const triggers: MentionTrigger[] = [
      { char: '@', items: [{ id: '1', label: 'Alice' }] },
    ]
    const { api, wrapper } = mountUseMention({ triggers })
    const editor = createEditorWithText('@')
    api.editorRef.value = editor

    api.handlers.input()

    expect(api.isOpen.value).toBe(true)
    expect(api.activeTrigger.value).toBe('@')
    expect(api.query.value).toBe('')
    wrapper.unmount()
  })

  it('updates query when typing after trigger', () => {
    const triggers: MentionTrigger[] = [
      { char: '@', items: [{ id: '1', label: 'Alice' }] },
    ]
    const { api, wrapper } = mountUseMention({ triggers })
    const editor = createEditorWithText('@jo')
    api.editorRef.value = editor

    api.handlers.input()

    expect(api.isOpen.value).toBe(true)
    expect(api.query.value).toBe('jo')
    wrapper.unmount()
  })

  it('does not open popup when no trigger is present', () => {
    const triggers: MentionTrigger[] = [
      { char: '@', items: [{ id: '1', label: 'Alice' }] },
    ]
    const { api, wrapper } = mountUseMention({ triggers })
    const editor = createEditorWithText('hello')
    api.editorRef.value = editor

    api.handlers.input()

    expect(api.isOpen.value).toBe(false)
    expect(api.activeTrigger.value).toBe(null)
    wrapper.unmount()
  })

  it('uses debounce for async items and updates loading', async () => {
    const items = vi.fn().mockResolvedValue([
      { id: '1', label: 'John' },
    ])
    const triggers: MentionTrigger[] = [
      { char: '@', items, debounce: 200 },
    ]
    const { api, wrapper } = mountUseMention({ triggers })
    const editor = createEditorWithText('@jo')
    api.editorRef.value = editor

    api.handlers.input()
    expect(api.loading.value).toBe(true)

    vi.advanceTimersByTime(200)
    await Promise.resolve()
    await nextTick()

    expect(items).toHaveBeenCalledWith('jo')
    expect(api.filteredItems.value.length).toBe(1)
    expect(api.loading.value).toBe(false)
    wrapper.unmount()
  })

  it('selects item and closes popup', () => {
    const items: MentionItem[] = [
      { id: '1', label: 'Alice' },
    ]
    const triggers: MentionTrigger[] = [
      { char: '@', items },
    ]
    const { api, wrapper } = mountUseMention({ triggers })
    const editor = createEditorWithText('@al')
    editor.focus = vi.fn()
    api.editorRef.value = editor

    const execCommand = vi.fn().mockReturnValue(true)
    const originalExec = document.execCommand
    document.execCommand = execCommand

    api.handlers.input()
    api.select(items[0]!)

    expect(execCommand).toHaveBeenCalled()
    expect(api.isOpen.value).toBe(false)

    document.execCommand = originalExec
    wrapper.unmount()
  })

  it('supports multiple triggers and picks the last match', () => {
    const triggers: MentionTrigger[] = [
      { char: '@', items: [{ id: '1', label: 'Alice' }] },
      { char: '#', items: [{ id: '2', label: 'bug' }] },
    ]
    const { api, wrapper } = mountUseMention({ triggers })
    const editor = createEditorWithText('hello #bug')
    api.editorRef.value = editor

    api.handlers.input()

    expect(api.isOpen.value).toBe(true)
    expect(api.activeTrigger.value).toBe('#')
    expect(api.query.value).toBe('bug')
    wrapper.unmount()
  })

  it('closes popup on scroll when behavior is close', () => {
    const triggers: MentionTrigger[] = [
      { char: '@', items: [{ id: '1', label: 'Alice' }] },
    ]
    const { api, wrapper } = mountUseMention({ triggers, popupScrollBehavior: 'close' })
    const editor = createEditorWithText('@')
    api.editorRef.value = editor

    api.handlers.input()
    expect(api.isOpen.value).toBe(true)

    window.dispatchEvent(new Event('scroll'))
    expect(api.isOpen.value).toBe(false)
    wrapper.unmount()
  })
})
