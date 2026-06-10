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

describe('useMention pagination', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); document.body.innerHTML = '' })

  // 刷新若干层微任务，等待 resolveItems 的 await 链结算
  async function flush() {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()
  }

  // 基于 offset/limit 的分页数据源，共 total 条
  function makePagedItems(total: number) {
    return vi.fn((_q: string, page?: { offset: number; limit: number }) => {
      const offset = page?.offset ?? 0
      const limit = page?.limit ?? total
      const all = Array.from({ length: total }, (_, i) => ({ id: String(i), label: `item${i}` }))
      return Promise.resolve(all.slice(offset, offset + limit))
    })
  }

  function open(api: ReturnType<typeof useMention>, text = '@') {
    const editor = createEditorWithText(text)
    api.editorRef.value = editor
    api.handlers.input()
  }

  it('loads the first page with offset/limit and infers hasMore', async () => {
    const items = makePagedItems(7)
    const triggers: MentionTrigger[] = [{ char: '@', items, pagination: { pageSize: 3 } }]
    const { api, wrapper } = mountUseMention({ triggers })

    open(api)
    await flush()

    expect(items).toHaveBeenCalledWith('', { offset: 0, limit: 3 })
    expect(api.filteredItems.value.length).toBe(3)
    expect(api.hasMore.value).toBe(true)
    wrapper.unmount()
  })

  it('loadMore appends the next page and clears hasMore on the short last page', async () => {
    const items = makePagedItems(7)
    const triggers: MentionTrigger[] = [{ char: '@', items, pagination: { pageSize: 3 } }]
    const { api, wrapper } = mountUseMention({ triggers })

    open(api)
    await flush()

    api.loadMore()
    await flush()
    expect(items).toHaveBeenLastCalledWith('', { offset: 3, limit: 3 })
    expect(api.filteredItems.value.length).toBe(6)
    expect(api.hasMore.value).toBe(true)

    api.loadMore()
    await flush()
    expect(api.filteredItems.value.length).toBe(7)
    expect(api.hasMore.value).toBe(false)

    // 没有下一页后 loadMore 为空操作
    api.loadMore()
    await flush()
    expect(items).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('honors explicit hasMore from { items, hasMore } over inference', async () => {
    const items = vi.fn().mockResolvedValue({
      items: [{ id: '1', label: 'a' }, { id: '2', label: 'b' }, { id: '3', label: 'c' }],
      hasMore: false,
    })
    const triggers: MentionTrigger[] = [{ char: '@', items, pagination: { pageSize: 3 } }]
    const { api, wrapper } = mountUseMention({ triggers })

    open(api)
    await flush()

    // 满页本会推断 hasMore=true，但显式 false 优先
    expect(api.filteredItems.value.length).toBe(3)
    expect(api.hasMore.value).toBe(false)
    wrapper.unmount()
  })

  it('close() resets pagination state and discards in-flight loadMore', async () => {
    let resolveSecond: (v: MentionItem[]) => void = () => {}
    const items = vi.fn()
      .mockResolvedValueOnce([
        { id: '0', label: 'i0' }, { id: '1', label: 'i1' }, { id: '2', label: 'i2' },
      ])
      .mockImplementationOnce(() => new Promise<MentionItem[]>((r) => { resolveSecond = r }))
    const triggers: MentionTrigger[] = [{ char: '@', items, pagination: { pageSize: 3 } }]
    const { api, wrapper } = mountUseMention({ triggers })

    open(api)
    await flush()
    expect(api.hasMore.value).toBe(true)

    api.loadMore()
    expect(api.loadingMore.value).toBe(true)

    api.close()
    expect(api.hasMore.value).toBe(false)
    expect(api.loadingMore.value).toBe(false)
    expect(api.filteredItems.value.length).toBe(0)

    // 关闭后在途响应回来必须被丢弃，不污染列表
    resolveSecond([{ id: '9', label: 'late' }])
    await flush()
    expect(api.filteredItems.value.length).toBe(0)
    wrapper.unmount()
  })

  it('keyboard navigation near the end prefetches the next page', async () => {
    const items = makePagedItems(7)
    const triggers: MentionTrigger[] = [{ char: '@', items, pagination: { pageSize: 3 } }]
    const { api, wrapper } = mountUseMention({ triggers })

    open(api)
    await flush()
    expect(api.filteredItems.value.length).toBe(3)

    api.handlers.keydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await flush()

    expect(items).toHaveBeenLastCalledWith('', { offset: 3, limit: 3 })
    expect(api.filteredItems.value.length).toBe(6)
    wrapper.unmount()
  })

  it('switching query resets the offset back to the first page', async () => {
    const items = makePagedItems(7)
    const triggers: MentionTrigger[] = [{ char: '@', items, pagination: { pageSize: 3 } }]
    const { api, wrapper } = mountUseMention({ triggers })

    open(api)
    await flush()
    api.loadMore()
    await flush()
    expect(api.filteredItems.value.length).toBe(6)

    // 新一轮输入（query 变化）应重置分页，从 offset 0 重新加载
    open(api, '@jo')
    await flush()
    expect(items).toHaveBeenLastCalledWith('jo', { offset: 0, limit: 3 })
    expect(api.filteredItems.value.length).toBe(3)
    wrapper.unmount()
  })

  it('loadMore is a no-op for non-paginated sources', async () => {
    const triggers: MentionTrigger[] = [
      { char: '@', items: [{ id: '1', label: 'Alice' }] },
    ]
    const { api, wrapper } = mountUseMention({ triggers })

    open(api)
    await flush()
    expect(api.hasMore.value).toBe(false)

    api.loadMore()
    await flush()
    expect(api.filteredItems.value.length).toBe(1)
    wrapper.unmount()
  })
})
