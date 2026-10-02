import { describe, it, expect, vi, afterEach } from 'vitest'
import { StrictMode, useState, type ReactElement } from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useMention } from '../src/useMention'
import type { UseMentionReturn } from '../src'
import type { MentionCoreOptions, MentionState, MentionTrigger } from '@mentionly/core'

/** 捕获最新一次渲染返回的 hook API（返回值是渲染快照，读取时要用 getter 拿最新对象） */
interface ApiRef {
  current: UseMentionReturn | null
}

function Harness({ options, apiRef }: { options: MentionCoreOptions; apiRef: ApiRef }) {
  const api = useMention(options)
  apiRef.current = api
  // ⚠ contenteditable 内部 DOM 完全由 core 管理：这里不能渲染任何 React 子节点
  return <div ref={api.ref} contentEditable data-testid="editor" />
}

function renderHarness(
  options: MentionCoreOptions,
  wrap?: (node: ReactElement) => ReactElement,
) {
  const apiRef: ApiRef = { current: null }
  const node = <Harness options={options} apiRef={apiRef} />
  const utils = render(wrap ? wrap(node) : node)
  return {
    apiRef,
    /** 始终取最近一次渲染的 hook 返回值 */
    get api(): UseMentionReturn {
      return apiRef.current!
    },
    ...utils,
  }
}

function getEditor(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-testid="editor"]')!
}

/** 往编辑器里写入文本并把折叠光标放到末尾 */
function setEditorText(editor: HTMLElement, text: string, cursorOffset = text.length) {
  const node = document.createTextNode(text)
  editor.textContent = ''
  editor.appendChild(node)
  editor.focus()
  const range = document.createRange()
  range.setStart(node, cursorOffset)
  range.setEnd(node, cursorOffset)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

/** jsdom 没有 execCommand：mock 成真的替换 innerHTML，便于断言 select 后的序列化结果 */
function mockExecCommand(editor: HTMLElement) {
  const original = document.execCommand
  document.execCommand = vi.fn((_command: string, _ui?: boolean, value?: string) => {
    editor.innerHTML = value ?? ''
    return true
  })
  // 断言失败也要恢复，避免泄漏到后续用例
  return () => { document.execCommand = original }
}

/** React 的「Maximum update depth exceeded」可能走 console.error，也可能直接抛出 */
function maxUpdateDepthErrors(spy: { mock: { calls: unknown[][] } }): unknown[][] {
  return spy.mock.calls.filter((call) => String(call[0]).includes('Maximum update depth'))
}

const alice = { id: '1', label: 'Alice' }
const bob = { id: '2', label: 'Bob' }

function staticTriggers(): MentionTrigger[] {
  return [{ char: '@', items: [alice, bob] }]
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useMention (React adapter)', () => {
  it('opens the list on trigger input and exposes core state', () => {
    const h = renderHarness({ triggers: staticTriggers() })
    const editor = getEditor()

    setEditorText(editor, '@al')
    fireEvent.input(editor)

    expect(h.api.state.isOpen).toBe(true)
    expect(h.api.state.activeTrigger).toBe('@')
    expect(h.api.state.query).toBe('al')
    expect(h.api.state.filteredItems).toEqual([alice])
    expect(h.api.ids.listbox).toBeTruthy()
    expect(h.api.ids.option(0)).toBeTruthy()
  })

  it('navigates with the keyboard and inserts the selected mention', () => {
    const h = renderHarness({ triggers: staticTriggers() })
    const editor = getEditor()

    setEditorText(editor, '@')
    fireEvent.input(editor)
    expect(h.api.state.activeIndex).toBe(0)

    fireEvent.keyDown(editor, { key: 'ArrowDown' })
    expect(h.api.state.activeIndex).toBe(1)

    const restoreExec = mockExecCommand(editor)
    try {
      fireEvent.keyDown(editor, { key: 'Enter' })
      expect(h.api.state.isOpen).toBe(false)
      expect(h.api.getParts()).toEqual([
        { type: 'mention', trigger: '@', id: '2', label: 'Bob' },
      ])
    } finally {
      restoreExec()
    }
  })

  it('getParts() returns Part[] and persists toData() output', () => {
    const toData = vi.fn((item: { id: string }) => ({ uri: `user:${item.id}` }))
    const h = renderHarness({
      triggers: [{ char: '@', items: [alice], toData }],
    })
    const editor = getEditor()

    setEditorText(editor, '@al')
    fireEvent.input(editor)

    const restoreExec = mockExecCommand(editor)
    try {
      fireEvent.keyDown(editor, { key: 'Enter' })
      expect(toData).toHaveBeenCalledWith(alice)
      expect(h.api.getParts()).toEqual([
        { type: 'mention', trigger: '@', id: '1', label: 'Alice', data: { uri: 'user:1' } },
      ])
      expect(h.api.getPlainText()).toBe('@Alice')
    } finally {
      restoreExec()
    }
  })

  it('stops core and stops notifying once unmounted', () => {
    const h = renderHarness({ triggers: staticTriggers() })
    const editor = getEditor()
    const core = h.api.core

    setEditorText(editor, '@')
    fireEvent.input(editor)
    expect(h.api.state.isOpen).toBe(true)

    const stopSpy = vi.spyOn(core, 'stop')
    const seen: MentionState[] = []
    core.subscribe((s) => seen.push(s))

    h.unmount()

    expect(stopSpy).toHaveBeenCalled()
    expect(core.getState().isOpen).toBe(true) // 状态冻结在最后一次快照，不再变化

    // 元素已解绑 handlers：再派发 input 不会再触发任何通知
    seen.length = 0
    editor.textContent = '@bob'
    fireEvent.input(editor)
    expect(seen).toHaveLength(0)
    expect(core.getState().isOpen).toBe(true)
  })

  it('mounts and works under StrictMode', () => {
    const h = renderHarness({ triggers: staticTriggers() }, (node) => (
      <StrictMode>{node}</StrictMode>
    ))
    const editor = getEditor()

    setEditorText(editor, '@b')
    fireEvent.input(editor)

    expect(h.api.state.isOpen).toBe(true)
    expect(h.api.state.filteredItems).toEqual([bob])

    const restoreExec = mockExecCommand(editor)
    try {
      fireEvent.keyDown(editor, { key: 'Enter' })
      expect(h.api.getParts()).toEqual([
        { type: 'mention', trigger: '@', id: '2', label: 'Bob' },
      ])
    } finally {
      restoreExec()
    }

    h.unmount()
  })

  it('does not call setOptions when option references are unchanged', () => {
    const options: MentionCoreOptions = { triggers: staticTriggers() }
    const h = renderHarness(options)
    const setOptionsSpy = vi.spyOn(h.api.core, 'setOptions')

    h.rerender(<Harness options={options} apiRef={h.apiRef} />)
    h.rerender(<Harness options={options} apiRef={h.apiRef} />)

    expect(setOptionsSpy).not.toHaveBeenCalled()
  })

  it('calls setOptions when a compared option reference changes', () => {
    const options: MentionCoreOptions = { triggers: staticTriggers() }
    const h = renderHarness(options)
    const setOptionsSpy = vi.spyOn(h.api.core, 'setOptions')

    const nextTriggers: MentionTrigger[] = [{ char: '#', items: [alice] }]
    h.rerender(
      <Harness options={{ ...options, triggers: nextTriggers, insertSpaceAfter: false }} apiRef={h.apiRef} />,
    )

    expect(setOptionsSpy).toHaveBeenCalledTimes(1)
    expect(setOptionsSpy).toHaveBeenCalledWith(expect.objectContaining({
      triggers: nextTriggers,
      insertSpaceAfter: false,
    }))
  })

  it('warns once and does not loop when triggers is a fresh array on every render', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let renders = 0

    function InlineTriggers() {
      renders += 1
      const [, setTick] = useState(0)
      const api = useMention({ triggers: [{ char: '@', items: [alice] }] })
      return (
        <>
          <div ref={api.ref} contentEditable data-testid="editor" />
          <button type="button" onClick={() => setTick((n) => n + 1)}>bump</button>
        </>
      )
    }

    const { getByRole } = render(<InlineTriggers />)
    const bump = getByRole('button')

    fireEvent.click(bump)
    fireEvent.click(bump)
    expect(warnSpy).not.toHaveBeenCalled()

    fireEvent.click(bump)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]![0]).toContain('triggers')

    // 只警告一次
    fireEvent.click(bump)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    // 反复 setOptions + close() 不会陷入无限重渲染
    expect(renders).toBeLessThan(20)
    expect(maxUpdateDepthErrors(errorSpy)).toHaveLength(0)
  })

  it('closes the list instead of looping when inline triggers re-render it', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const apiRef: ApiRef = { current: null }

    function InlineTriggers() {
      const [, setTick] = useState(0)
      const api = useMention({ triggers: [{ char: '@', items: [alice, bob] }] })
      apiRef.current = api
      return (
        <>
          <div ref={api.ref} contentEditable data-testid="editor" />
          <button type="button" onClick={() => setTick((n) => n + 1)}>bump</button>
        </>
      )
    }

    const { getByRole } = render(<InlineTriggers />)
    const editor = getEditor()

    setEditorText(editor, '@')
    fireEvent.input(editor)

    // 已知限制：内联 triggers 下，列表打开引发的重渲染就会带上新引用，core 因此 close() 掉列表。
    // 这是设计上的取舍（靠 dev 警告提醒用户用 useMemo/模块级常量），关键是它不会无限重渲染。
    expect(apiRef.current!.state.isOpen).toBe(false)
    expect(maxUpdateDepthErrors(errorSpy)).toHaveLength(0)

    // 之后仍然可用：再触发一次会重新打开列表（直到下一次重渲染再被关闭）
    setEditorText(editor, '@b')
    fireEvent.input(editor)
    expect(apiRef.current!.state.isOpen).toBe(false)
    expect(maxUpdateDepthErrors(errorSpy)).toHaveLength(0)

    // 每次「打开 → 重渲染 → setOptions 关列表」都会累加一次引用变化，连续 3 次后给出警告
    expect(warnSpy.mock.calls.some((call) => String(call[0]).includes('triggers'))).toBe(true)
  })

  it('renders on the server (no DOM access on import / construction)', () => {
    function SsrHarness() {
      const api = useMention({ triggers: staticTriggers() })
      return <div ref={api.ref} contentEditable data-open={String(api.state.isOpen)} />
    }

    expect(renderToString(<SsrHarness />)).toContain('data-open="false"')
  })
})
