import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MentionCore } from '../src/MentionCore'
import type { MentionItem, MentionState, ContentPart, Part } from '../src/types'

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

function createMentionForTest(trigger: string, id: string, label: string) {
  const span = document.createElement('span')
  span.contentEditable = 'false'
  span.dataset.mentionId = id
  span.dataset.mentionTrigger = trigger
  span.textContent = `${trigger}${label}`
  return span
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
    expect(s.error).toBe(null)
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

  function openState(triggerChar: string, text: string, allowMidWord?: boolean) {
    const core = makeCore({ triggers: [{ char: triggerChar, items, allowMidWord }] })
    core.setElement(createEditorWithText(text))
    core.handlers.input()
    return core.getState()
  }

  it.each([
    ['a@b', '@'],
    ['foo#tag', '#'],
    ['x_@y', '@'],
    ['9@x', '@'],
  ])('does not open for %s (ASCII word char right before the trigger)', (text, char) => {
    const state = openState(char, text)
    expect(state.isOpen).toBe(false)
    expect(state.activeTrigger).toBe(null)
  })

  it.each([
    ['@b', '@'],
    ['a @b', '@'],
    ['a\u00A0@b', '@'],
    ['你好@张三', '@'],
    ['(@alice', '@'],
  ])('opens for %s (start / whitespace / NBSP / CJK / punctuation before the trigger)', (text, char) => {
    const state = openState(char, text)
    expect(state.isOpen).toBe(true)
    expect(state.activeTrigger).toBe(char)
  })

  it('opens for a mid-word trigger when allowMidWord is true', () => {
    const state = openState('@', 'a@b', true)
    expect(state.isOpen).toBe(true)
    expect(state.activeTrigger).toBe('@')
    expect(state.query).toBe('b')
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

  it('command mode still deletes the trigger text on a successful selection', () => {
    const onSelect = vi.fn()
    const core = makeCore({
      triggers: [{ char: '/', mode: 'command', items: [{ id: '1', label: 'clear' }], onSelect }],
    })
    const editor = createEditorWithText('/cl')
    core.setElement(editor)
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)

    const execCommand = vi.fn().mockReturnValue(true)
    const original = document.execCommand
    document.execCommand = execCommand

    try {
      core.select(core.getState().filteredItems[0]!)
      expect(execCommand).toHaveBeenCalledWith('delete')
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(core.getState().isOpen).toBe(false)
    } finally {
      document.execCommand = original
    }
  })

  it('command mode skips delete when the trigger selection cannot be built, but still fires onSelect', () => {
    const onSelect = vi.fn()
    const core = makeCore({
      triggers: [{ char: '/', mode: 'command', items: [{ id: '1', label: 'clear' }], onSelect }],
    })
    const editor = createEditorWithText('/cl')
    core.setElement(editor)
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)

    // 把光标移回文本开头：前缀文本里没有触发符，selectTriggerText 会失败
    const node = editor.firstChild as Text
    const range = document.createRange()
    range.setStart(node, 0)
    range.setEnd(node, 0)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)

    const execCommand = vi.fn().mockReturnValue(true)
    const original = document.execCommand
    document.execCommand = execCommand

    try {
      core.select(core.getState().filteredItems[0]!)
      expect(execCommand).not.toHaveBeenCalled()
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(core.getState().isOpen).toBe(false)
    } finally {
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
        trigger: '',
        id: 'ext-1',
        label: 'External Item',
      },
    ])
    expect(core.getDataParts()).toEqual([
      { type: 'data', dataType: 'external_ref', refId: 'ext-1', displayName: 'External Item', trigger: '' },
    ])
  })

  it('select() calls toData with the complete item and persists its result', () => {
    const item = { id: '1', label: 'Alice', uri: 'user:alice', kind: 'person' }
    const toData = vi.fn((selected: MentionItem) => ({ uri: selected.uri, kind: selected.kind }))
    const core = makeCore({ triggers: [{ char: '@', items: [item], toData }] })
    const editor = createEditorWithText('@al')
    core.setElement(editor)

    const original = document.execCommand
    document.execCommand = vi.fn((_command: string, _ui?: boolean, value?: string) => {
      editor.innerHTML = value ?? ''
      return true
    })

    try {
      core.handlers.input()
      core.select(core.getState().filteredItems[0]!)

      expect(toData).toHaveBeenCalledOnce()
      expect(toData).toHaveBeenCalledWith(item)
      expect(core.getParts()).toEqual([
        { type: 'mention', trigger: '@', id: '1', label: 'Alice', data: { uri: 'user:alice', kind: 'person' } },
      ])
    } finally {
      document.execCommand = original
    }
  })

  it('insertMention() stores the 2.0 trigger and data payload', () => {
    const core = makeCore({ triggers: [] })
    const editor = createEmptyEditor()
    core.setElement(editor)

    core.insertMention({
      id: 'doc-1',
      label: 'Guide',
      trigger: '#',
      data: { uri: 'doc:guide', nested: { rank: 1 } },
    }, { appendSpace: false })

    expect(core.getParts()).toEqual([
      { type: 'mention', trigger: '#', id: 'doc-1', label: 'Guide', data: { uri: 'doc:guide', nested: { rank: 1 } } },
    ])
  })

  it('getParts normalizes NBSP, merges text, trims edges, and drops empty text', () => {
    const core = makeCore({ triggers: [] })
    const editor = createEmptyEditor()
    editor.append('  hello\u00A0')
    editor.append(document.createTextNode('world  '))
    core.setElement(editor)

    expect(core.getParts()).toEqual([{ type: 'text', text: 'hello world' }])
  })

  it('legacy setContent input warns only once and is parsed into 2.0 parts', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const core = makeCore({ triggers: [] })
    core.setElement(createEmptyEditor())
    const legacy: ContentPart[] = [
      { type: 'text', content: 'hello ' },
      { type: 'mention', triggeredBy: '@', id: '1', label: 'Alice' },
    ]

    core.setContent(legacy)
    core.setContent(legacy)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(core.getParts()).toEqual([
      { type: 'text', text: 'hello ' },
      { type: 'mention', trigger: '@', id: '1', label: 'Alice' },
    ])
    warn.mockRestore()
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

    const content: Part[] = [
      { type: 'text', text: 'hello ' },
      { type: 'mention', trigger: '@', id: '1', label: 'Alice', data: { uri: 'user:1' } },
    ]
    core.setContent(content)

    expect(core.getState().isEmpty).toBe(false)
    expect(core.getPlainText()).toBe('hello @Alice')
    expect(core.getParts()).toEqual(content)

    core.setContent(core.getParts())
    expect(core.getParts()).toEqual(content)
  })

  it('getDataParts preserves 1.x type overrides and NBSP bytes', () => {
    const core = makeCore({
      triggers: [{
        char: '@',
        items: [],
        dataPart: () => ({ type: 'mentioned_ref', uri: 'user:alice' }),
      }],
    })
    const editor = createEmptyEditor()
    editor.append(document.createTextNode('  before\u00A0'))
    editor.appendChild(createMentionForTest('@', '1', 'Alice'))
    editor.append(document.createTextNode('\u00A0after  '))
    core.setElement(editor)

    expect(core.getDataParts()).toEqual([
      { type: 'text', text: 'before\u00A0' },
      { type: 'mentioned_ref', uri: 'user:alice' },
      { type: 'text', text: '\u00A0after' },
    ])
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

  it('stores a rejected data source error and clears it after a successful load', async () => {
    const failure = new Error('network down')
    const items = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce([{ id: '1', label: 'Alice' }])
    const core = makeCore({ triggers: [{ char: '@', items }] })
    const editor = createEditorWithText('@')
    core.setElement(editor)

    core.handlers.input()
    await flush()
    expect(core.getState().error).toBe(failure)
    expect(core.getState().loading).toBe(false)

    core.handlers.input()
    await flush()
    expect(core.getState().error).toBe(null)
    expect(core.getState().filteredItems).toEqual([{ id: '1', label: 'Alice' }])
  })

  it('close() clears a data source error', async () => {
    const core = makeCore({ triggers: [{ char: '@', items: vi.fn().mockRejectedValue(new Error('failed')) }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    await flush()
    expect(core.getState().error).toBeInstanceOf(Error)

    core.close()
    expect(core.getState().error).toBe(null)
  })

  it('setOptions discards an old trigger request that resolves', async () => {
    let resolveItems: (items: MentionItem[]) => void = () => {}
    const oldItems = vi.fn(() => new Promise<MentionItem[]>((resolve) => { resolveItems = resolve }))
    const core = makeCore({ triggers: [{ char: '@', items: oldItems }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)
    const subscriber = vi.fn()
    core.subscribe(subscriber)

    core.setOptions({ triggers: [{ char: '#', items: [] }] })
    const callsAfterClose = subscriber.mock.calls.length
    expect(core.getState().isOpen).toBe(false)
    expect(core.getState().loading).toBe(false)

    resolveItems([{ id: 'late', label: 'Late result' }])
    await flush()

    expect(core.getState().filteredItems).toEqual([])
    expect(core.getState().error).toBe(null)
    expect(subscriber).toHaveBeenCalledTimes(callsAfterClose)
  })

  it('setOptions discards an old trigger request that rejects', async () => {
    let rejectItems: (error: unknown) => void = () => {}
    const oldItems = vi.fn(() => new Promise<MentionItem[]>((_resolve, reject) => { rejectItems = reject }))
    const core = makeCore({ triggers: [{ char: '@', items: oldItems }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    const subscriber = vi.fn()
    core.subscribe(subscriber)

    core.setOptions({ triggers: [{ char: '#', items: [] }] })
    const callsAfterClose = subscriber.mock.calls.length
    const failure = new Error('late rejection')
    rejectItems(failure)
    await flush()

    expect(core.getState().isOpen).toBe(false)
    expect(core.getState().error).toBe(null)
    expect(subscriber).toHaveBeenCalledTimes(callsAfterClose)
  })

  it('stop() discards an in-flight response without notifying subscribers', async () => {
    let resolveItems: (items: MentionItem[]) => void = () => {}
    const items = vi.fn(() => new Promise<MentionItem[]>((resolve) => { resolveItems = resolve }))
    const core = makeCore({ triggers: [{ char: '@', items }] })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    const stateAtStop = core.getState()
    const subscriber = vi.fn()
    core.subscribe(subscriber)

    core.stop()
    resolveItems([{ id: 'late', label: 'Late result' }])
    await flush()

    expect(core.getState()).toBe(stateAtStop)
    expect(core.getState().filteredItems).toEqual([])
    expect(subscriber).not.toHaveBeenCalled()
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

  it('ignores Enter while the IME is composing (no select, no preventDefault)', () => {
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'a' }, { id: '2', label: 'b' }] }],
    })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'isComposing', { value: true })
    core.handlers.keydown(ev)

    expect(ev.defaultPrevented).toBe(false)
    expect(core.getState().isOpen).toBe(true)
    expect(core.getState().activeIndex).toBe(0)
  })

  it('ignores keyCode 229 (IME) keydown', () => {
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'a' }, { id: '2', label: 'b' }] }],
    })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'keyCode', { value: 229 })
    core.handlers.keydown(ev)

    expect(ev.defaultPrevented).toBe(false)
    expect(core.getState().isOpen).toBe(true)
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

// ── accessibility ─────────────────────────────────────────
describe('MentionCore — accessibility', () => {
  it('generates unique ids without requiring a DOM element', () => {
    const first = makeCore({ triggers: [] })
    const second = makeCore({ triggers: [] })

    expect(first.ids.listbox).not.toBe(second.ids.listbox)
    expect(first.ids.option(2)).not.toBe(second.ids.option(2))
    expect(first.ids.option(2)).toContain('option-2')
  })

  it('syncs combobox attributes with popup state and active item', () => {
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }, { id: '2', label: 'Bob' }] }],
    })
    const editor = createEditorWithText('@')
    core.setElement(editor)

    expect(editor.getAttribute('role')).toBe('combobox')
    expect(editor.getAttribute('aria-autocomplete')).toBe('list')
    expect(editor.getAttribute('aria-expanded')).toBe('false')
    expect(editor.getAttribute('aria-controls')).toBe(core.ids.listbox)
    expect(editor.hasAttribute('aria-activedescendant')).toBe(false)

    core.handlers.input()
    expect(editor.getAttribute('aria-expanded')).toBe('true')
    expect(editor.getAttribute('aria-activedescendant')).toBe(core.ids.option(0))

    core.handlers.keydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(editor.getAttribute('aria-activedescendant')).toBe(core.ids.option(1))

    core.close()
    expect(editor.getAttribute('aria-expanded')).toBe('false')
    expect(editor.hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('preserves an existing role and restores managed attributes when changing elements', () => {
    const core = makeCore({ triggers: [] })
    const first = createEmptyEditor()
    first.setAttribute('role', 'textbox')
    first.setAttribute('aria-expanded', 'mixed')
    const second = createEmptyEditor()

    core.setElement(first)
    expect(first.getAttribute('role')).toBe('textbox')
    expect(first.getAttribute('aria-expanded')).toBe('false')

    core.setElement(second)
    expect(first.getAttribute('role')).toBe('textbox')
    expect(first.getAttribute('aria-expanded')).toBe('mixed')
    expect(first.hasAttribute('aria-controls')).toBe(false)
    expect(second.getAttribute('role')).toBe('combobox')

    core.setElement(null)
    expect(second.hasAttribute('role')).toBe(false)
    expect(second.hasAttribute('aria-autocomplete')).toBe(false)
    expect(second.hasAttribute('aria-expanded')).toBe(false)
    expect(second.hasAttribute('aria-controls')).toBe(false)
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

  it('setOptions applies trigger and insertion options immediately', () => {
    const original = document.execCommand
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }],
      insertSpaceAfter: true,
    })
    core.setElement(createEditorWithText('#'))

    try {
      core.setOptions({
        triggers: [{ char: '#', items: [{ id: '2', label: 'Issue' }] }],
        insertSpaceAfter: false,
      })
      core.handlers.input()
      core.select(core.getState().filteredItems[0]!)

      expect(core.getState().activeTrigger).toBe(null)
      expect(execCommand).toHaveBeenCalledWith(
        'insertHTML',
        false,
        expect.not.stringContaining('\u00A0'),
      )
    } finally {
      document.execCommand = original
    }
  })

  it('setOptions keeps an open list for non-trigger option changes', () => {
    const core = makeCore({
      triggers: [{ char: '@', items: [{ id: '1', label: 'Alice' }] }],
      insertSpaceAfter: true,
      popupMode: 'fixed',
      popupScrollBehavior: 'reposition',
    })
    core.setElement(createEditorWithText('@'))
    core.handlers.input()
    expect(core.getState().isOpen).toBe(true)

    core.setOptions({
      insertSpaceAfter: false,
      popupMode: 'cursor',
      popupScrollBehavior: 'ignore',
    })

    expect(core.getState().isOpen).toBe(true)
    expect(core.getState().filteredItems).toEqual([{ id: '1', label: 'Alice' }])
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

describe('MentionCore — redundant close keeps the snapshot stable', () => {
  it('does not notify or replace the state when close() is called on a closed list', () => {
    const core = makeCore({ triggers: [{ char: '@', items: [{ id: '1', label: 'alice' }] }] })
    const before = core.getState()
    const listener = vi.fn()
    const unsubscribe = core.subscribe(listener)
    core.close()
    core.close()
    expect(listener).not.toHaveBeenCalled()
    expect(core.getState()).toBe(before)
    unsubscribe()
  })
})
