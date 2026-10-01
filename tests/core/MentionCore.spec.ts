import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MentionCore } from '../../src/core/MentionCore'
import type { MentionItem, MentionState, ContentPart } from '../../src/core/types'

// ── 测试夹具 ──────────────────────────────────────────────
// 这些用例完全脱离 Vue：直接 new MentionCore，驱动 handlers/方法，
// 用 getState()/subscribe() 断言。验证 core 作为 framework-agnostic 单元可独立工作。

const cores: MentionCore[] = []
function makeCore(options: ConstructorParameters<typeof MentionCore>[0]): MentionCore {
  const core = new MentionCore(options)
  cores.push(core)
  return core
}

afterEach(() => {
  // 解绑所有 window viewport / element 监听，避免跨用例泄漏
  cores.forEach((c) => c.stop())
  cores.length = 0
  document.body.innerHTML = ''
})

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

function createEmptyEditor() {
  const editor = document.createElement('div')
  editor.setAttribute('contenteditable', 'true')
  document.body.appendChild(editor)
  editor.focus()
  return editor
}

// 刷新若干层微任务，等待 resolveItems 的 await 链结算（无定时器时足够）
async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function makePagedItems(total: number) {
  return vi.fn((_q: string, page?: { offset: number; limit: number }) => {
    const offset = page?.offset ?? 0
    const limit = page?.limit ?? total
    const all = Array.from({ length: total }, (_, i) => ({ id: String(i), label: `item${i}` }))
    return Promise.resolve(all.slice(offset, offset + limit))
  })
}

// ── 生命周期 & 状态契约 ───────────────────────────────────
describe('MentionCore — state & subscription contract', () => {
  it('starts with a sane initial snapshot', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [] }] })
    const s = core.getState()
    expect(s.isOpen).toBe(false)
    expect(s.filteredItems).toEqual([])
    expect(s.activeTrigger).toBe(null)
    expect(s.isEmpty).toBe(true)
  })

  it('getState returns the same reference across reads, a new one after a real change', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const before = core.getState()
    expect(core.getState()).toBe(before)

    const editor = createEditorWithText('@')
    core.setElement(editor)
    core.handlers.input()
    expect(core.getState()).not.toBe(before)
    expect(core.getState().isOpen).toBe(true)
  })

  it('notifies subscribers synchronously and stops after unsubscribe', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEditorWithText('@')
    core.setElement(editor)

    const states: MentionState[] = []
    const unsub = core.subscribe((s) => states.push(s))

    core.handlers.input()
    // 同步可见，无需 await
    expect(states.length).toBeGreaterThan(0)
    expect(core.getState().isOpen).toBe(true)

    const count = states.length
    unsub()
    core.close()
    expect(states.length).toBe(count) // 退订后不再收到通知
  })

  it('skips no-op scalar updates (Object.is) — no new ref, no notification', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEditorWithText('@')
    core.setElement(editor)
    core.handlers.input() // 单条结果，activeIndex = 0

    const sOpen = core.getState()
    const spy = vi.fn()
    core.subscribe(spy)

    // 单条列表里 ArrowDown：(0 + 1) % 1 = 0，activeIndex 不变 → 应被 Object.is 短路
    core.handlers.keydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(spy).not.toHaveBeenCalled()
    expect(core.getState()).toBe(sOpen)
  })

  it('guard-returning actions (loadMore while closed) do not mutate or notify', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const s1 = core.getState()
    const spy = vi.fn()
    core.subscribe(spy)
    core.loadMore() // isOpen=false → early return
    expect(spy).not.toHaveBeenCalled()
    expect(core.getState()).toBe(s1)
  })
})

// ── 触发检测 ──────────────────────────────────────────────
describe('MentionCore — trigger detection', () => {
  it('opens and sets trigger/query on input', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEditorWithText('@jo')
    core.setElement(editor)
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)
    expect(core.getState().activeTrigger).toBe('@')
    expect(core.getState().query).toBe('jo')
  })

  it('stays closed when no trigger is present', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEditorWithText('hello')
    core.setElement(editor)
    core.handlers.input()
    expect(core.getState().isOpen).toBe(false)
    expect(core.getState().activeTrigger).toBe(null)
  })

  it('picks the last match across multiple triggers', () => {
    const core = makeCore({
      triggers: [
        { char: '@', items: [{ id: '1', label: 'Alice' }] },
        { char: '#', items: [{ id: '2', label: 'bug' }] },
      ],
    })
    const editor = createEditorWithText('hello #bug')
    core.setElement(editor)
    core.handlers.input()
    expect(core.getState().activeTrigger).toBe('#')
    expect(core.getState().query).toBe('bug')
  })

  it('filters a static array source synchronously', () => {
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }, { id: '2', label: 'Bob' }] }],
    })
    const editor = createEditorWithText('@al')
    core.setElement(editor)
    core.handlers.input()
    expect(core.getState().filteredItems.map((i) => i.label)).toEqual(['Alice'])
  })
})

// ── 触发符边界 ────────────────────────────────────────────
describe('MentionCore — trigger word boundary', () => {
  const items = [{ id: '1', label: 'Alice' }]

  it('does not open for a mid-word trigger (a@b)', () => {
    const core = makeCore({ triggers: [{ char: '@', items }] })
    core.setElement(createEditorWithText('a@b'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(false)
    expect(core.getState().activeTrigger).toBe(null)
  })

  it('opens when the trigger follows whitespace (a @b)', () => {
    const core = makeCore({ triggers: [{ char: '@', items }] })
    core.setElement(createEditorWithText('a @b'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)
    expect(core.getState().activeTrigger).toBe('@')
    expect(core.getState().query).toBe('b')
  })

  it('opens when the trigger starts the line (@b)', () => {
    const core = makeCore({ triggers: [{ char: '@', items }] })
    core.setElement(createEditorWithText('@b'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)
    expect(core.getState().activeTrigger).toBe('@')
    expect(core.getState().query).toBe('b')
  })

  it('treats NBSP as a boundary (a\u00A0@b)', () => {
    const core = makeCore({ triggers: [{ char: '@', items }] })
    core.setElement(createEditorWithText('a\u00A0@b'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)
    expect(core.getState().activeTrigger).toBe('@')
  })

  it('opens for a mid-word trigger when allowMidWord is true', () => {
    const core = makeCore({ triggers: [{ char: '@', items, allowMidWord: true }] })
    core.setElement(createEditorWithText('a@b'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)
    expect(core.getState().activeTrigger).toBe('@')
    expect(core.getState().query).toBe('b')
  })
})

// ── 选中 & 序列化 ─────────────────────────────────────────
describe('MentionCore — selection & serialization', () => {
  it('select() inserts via execCommand and closes', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEditorWithText('@al')
    editor.focus = vi.fn()
    core.setElement(editor)

    const execCommand = vi.fn().mockReturnValue(true)
    const original = document.execCommand
    document.execCommand = execCommand

    try {
      core.handlers.input()
      core.select(core.getState().filteredItems[0]!)

      expect(execCommand).toHaveBeenCalled()
      expect(core.getState().isOpen).toBe(false)
    } finally {
      // 即使断言失败也恢复，避免泄漏到后续用例
      document.execCommand = original
    }
  })

  it('insertMention() appends a mention with a custom dataPart (no registered trigger)', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEmptyEditor()
    core.setElement(editor)

    const ok = core.insertMention({
      id: 'ext-1',
      label: 'External Item',
      dataPart: (item) => ({
        dataType: 'external_ref',
        refId: item.id,
        displayName: item.label,
        trigger: item.triggeredBy,
      }),
    })

    expect(ok).toBe(true)
    expect(core.getParts()).toEqual([
      {
        type: 'mention',
        triggeredBy: '',
        id: 'ext-1',
        label: 'External Item',
        dataPart: { dataType: 'external_ref', refId: 'ext-1', displayName: 'External Item', trigger: '' },
      },
      { type: 'text', content: '\u00A0' },
    ])
    expect(core.getDataParts()).toEqual([
      { type: 'data', dataType: 'external_ref', refId: 'ext-1', displayName: 'External Item', trigger: '' },
    ])
  })

  it('insertMention() can omit the trailing space', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEmptyEditor()
    core.setElement(editor)

    core.insertMention({ id: 'sel-1', label: 'Selection Context' }, { appendSpace: false })

    const parts = core.getParts()
    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({ type: 'mention', id: 'sel-1', label: 'Selection Context' })
  })

  it('setContent() / getParts() / getPlainText() round-trip and update isEmpty', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEmptyEditor()
    core.setElement(editor)
    expect(core.getState().isEmpty).toBe(true)

    const content: ContentPart[] = [
      { type: 'text', content: 'hello ' },
      { type: 'mention', triggeredBy: '@', id: '1', label: 'Alice' },
    ]
    core.setContent(content)

    expect(core.getState().isEmpty).toBe(false)
    expect(core.getPlainText()).toBe('hello @Alice')
    const parts = core.getParts()
    expect(parts[0]).toEqual({ type: 'text', content: 'hello ' })
    expect(parts[1]).toMatchObject({ type: 'mention', id: '1', label: 'Alice', triggeredBy: '@' })
  })

  it('clear() empties the editor and closes', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEditorWithText('@')
    core.setElement(editor)
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)

    core.clear()
    expect(editor.innerHTML).toBe('')
    expect(core.getState().isOpen).toBe(false)
    expect(core.getState().isEmpty).toBe(true)
  })
})

// ── 异步 & 分页 & 竞态 ────────────────────────────────────
describe('MentionCore — async pagination & races', () => {
  it('loads the first page with offset/limit and infers hasMore', async () => {
    const items = makePagedItems(7)
    const core = makeCore({ triggers: [{ char: '@', items, pagination: { pageSize: 3 } }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    await flush()

    expect(items).toHaveBeenCalledWith('', { offset: 0, limit: 3 })
    expect(core.getState().filteredItems.length).toBe(3)
    expect(core.getState().hasMore).toBe(true)
  })

  it('loadMore appends the next page and clears hasMore on the short last page', async () => {
    const items = makePagedItems(7)
    const core = makeCore({ triggers: [{ char: '@', items, pagination: { pageSize: 3 } }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    await flush()

    core.loadMore()
    await flush()
    expect(items).toHaveBeenLastCalledWith('', { offset: 3, limit: 3 })
    expect(core.getState().filteredItems.length).toBe(6)
    expect(core.getState().hasMore).toBe(true)

    core.loadMore()
    await flush()
    expect(core.getState().filteredItems.length).toBe(7)
    expect(core.getState().hasMore).toBe(false)

    core.loadMore() // 无下一页 → 空操作
    await flush()
    expect(items).toHaveBeenCalledTimes(3)
  })

  it('honors explicit hasMore from { items, hasMore } over inference', async () => {
    const items = vi.fn().mockResolvedValue({
      items: [{ id: '1', label: 'a' }, { id: '2', label: 'b' }, { id: '3', label: 'c' }],
      hasMore: false,
    })
    const core = makeCore({ triggers: [{ char: '@', items, pagination: { pageSize: 3 } }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    await flush()

    expect(core.getState().filteredItems.length).toBe(3)
    expect(core.getState().hasMore).toBe(false)
  })

  it('close() discards an in-flight loadMore response', async () => {
    let resolveSecond: (v: MentionItem[]) => void = () => {}
    const items = vi.fn()
      .mockResolvedValueOnce([{ id: '0', label: 'i0' }, { id: '1', label: 'i1' }, { id: '2', label: 'i2' }])
      .mockImplementationOnce(() => new Promise<MentionItem[]>((r) => { resolveSecond = r }))
    const core = makeCore({ triggers: [{ char: '@', items, pagination: { pageSize: 3 } }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    await flush()
    expect(core.getState().hasMore).toBe(true)

    core.loadMore()
    expect(core.getState().loadingMore).toBe(true) // 同步置位

    core.close()
    expect(core.getState().hasMore).toBe(false)
    expect(core.getState().loadingMore).toBe(false)
    expect(core.getState().filteredItems.length).toBe(0)

    resolveSecond([{ id: '9', label: 'late' }]) // 迟到响应必须被丢弃
    await flush()
    expect(core.getState().filteredItems.length).toBe(0)
  })

  it('switching query resets the offset back to the first page', async () => {
    const items = makePagedItems(7)
    const core = makeCore({ triggers: [{ char: '@', items, pagination: { pageSize: 3 } }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    await flush()
    core.loadMore()
    await flush()
    expect(core.getState().filteredItems.length).toBe(6)

    // 新一轮输入（query 变化）应重置分页，从 offset 0 重新加载
    core.setElement(createEditorWithText('@jo'))
    core.handlers.input()
    await flush()
    expect(items).toHaveBeenLastCalledWith('jo', { offset: 0, limit: 3 })
    expect(core.getState().filteredItems.length).toBe(3)
  })
})

describe('MentionCore — async debounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sets loading synchronously and resolves after the debounce window', async () => {
    const items = vi.fn().mockResolvedValue([{ id: '1', label: 'John' }])
    const core = makeCore({ triggers: [{ char: '@', items, debounce: 200 }] })
    core.setElement(createEditorWithText('@jo'))

    core.handlers.input()
    expect(core.getState().loading).toBe(true) // 同步

    vi.advanceTimersByTime(200)
    await Promise.resolve()
    await Promise.resolve()

    expect(items).toHaveBeenCalledWith('jo')
    expect(core.getState().filteredItems.length).toBe(1)
    expect(core.getState().loading).toBe(false)
  })
})

// ── 键盘导航 ──────────────────────────────────────────────
describe('MentionCore — keyboard navigation', () => {
  it('ArrowDown / ArrowUp cycle through items', () => {
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'a' }, { id: '2', label: 'b' }, { id: '3', label: 'c' }] }],
    })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    expect(core.getState().activeIndex).toBe(0)

    core.handlers.keydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(core.getState().activeIndex).toBe(1)
    core.handlers.keydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    expect(core.getState().activeIndex).toBe(0)
    core.handlers.keydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    expect(core.getState().activeIndex).toBe(2) // wrap around
  })

  it('Escape closes the popup', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'a' }] }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)
    core.handlers.keydown(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(core.getState().isOpen).toBe(false)
  })

  it('prefetches the next page when navigating near the end', async () => {
    const items = makePagedItems(7)
    const core = makeCore({ triggers: [{ char: '@', items, pagination: { pageSize: 3 } }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    await flush()
    expect(core.getState().filteredItems.length).toBe(3)

    core.handlers.keydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await flush()
    expect(items).toHaveBeenLastCalledWith('', { offset: 3, limit: 3 })
    expect(core.getState().filteredItems.length).toBe(6)
  })
})

// ── vanilla 路径：bindHandlers:true（Vue 测试覆盖不到的开箱即用路径）──
describe('MentionCore — vanilla bindHandlers path', () => {
  it('auto-binds DOM event listeners to the element and detaches on stop()', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEditorWithText('@')

    core.attach(editor, { bindHandlers: true })
    editor.dispatchEvent(new Event('input'))
    expect(core.getState().isOpen).toBe(true)
    expect(core.getState().activeTrigger).toBe('@')

    core.close()
    core.stop() // 解绑元素 handlers + viewport
    editor.dispatchEvent(new Event('input'))
    expect(core.getState().isOpen).toBe(false) // 已解绑，不再响应
  })

  it('start() re-bind with bindHandlers:false detaches previously bound handlers', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editor = createEditorWithText('@')

    core.attach(editor, { bindHandlers: true })
    core.start({ bindHandlers: false }) // 翻转 → 应卸掉旧 handlers
    editor.dispatchEvent(new Event('input'))
    expect(core.getState().isOpen).toBe(false)
  })

  it('setElement rebinds handlers from the old element to the new one', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }] })
    const editorA = createEditorWithText('@')
    const editorB = createEditorWithText('@')

    core.attach(editorA, { bindHandlers: true })
    core.setElement(editorB) // 解绑 A、绑定 B

    editorA.dispatchEvent(new Event('input'))
    expect(core.getState().isOpen).toBe(false) // 旧元素不再响应

    editorB.dispatchEvent(new Event('input'))
    expect(core.getState().isOpen).toBe(true) // 新元素已绑定
  })
})

// ── viewport 监听 ─────────────────────────────────────────
describe('MentionCore — viewport listeners', () => {
  it('closes on window scroll when popupScrollBehavior is "close"', () => {
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }],
      popupScrollBehavior: 'close',
    })
    core.setElement(createEditorWithText('@'))
    core.start({ bindHandlers: false })
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)

    window.dispatchEvent(new Event('scroll'))
    expect(core.getState().isOpen).toBe(false)
  })

  it('setOptions dynamically switches scroll behavior (detach / reattach listeners)', () => {
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }],
      popupScrollBehavior: 'reposition',
    })
    core.setElement(createEditorWithText('@'))
    core.start({ bindHandlers: false })
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)

    // reposition → ignore：监听器应被解绑，scroll 不再关闭
    core.setOptions({ popupScrollBehavior: 'ignore' })
    window.dispatchEvent(new Event('scroll'))
    expect(core.getState().isOpen).toBe(true)

    // ignore → close：监听器应重新挂上，scroll 关闭
    core.setOptions({ popupScrollBehavior: 'close' })
    window.dispatchEvent(new Event('scroll'))
    expect(core.getState().isOpen).toBe(false)
  })
})
