import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, within } from '@testing-library/svelte'
import { tick } from 'svelte'
import type { MentionCoreOptions, MentionItem, MentionTrigger, Part } from '@mentionly/core'
import type { CreateMentionReturn } from '../src/index.js'
import { version } from '../src/index.js'
import pkg from '../package.json'
import Fixture from './Fixture.svelte'

// ── helpers ──────────────────────────────────────────────

/** 在 contenteditable 里写入文本并把光标放到末尾，然后派发 input 事件。 */
function typeInto(editor: HTMLElement, text: string): void {
  editor.textContent = text
  const node = editor.firstChild as Text
  const range = document.createRange()
  range.setStart(node, text.length)
  range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  fireEvent.input(editor)
}

/**
 * jsdom 没有 execCommand。这里用最小实现把 insertHTML 真正插入到当前选区，
 * 这样 `select()` 之后编辑器 DOM 与真实浏览器一致，`getParts()` 才能读到内容。
 */
function mockExecCommand(): () => void {
  const original = document.execCommand
  document.execCommand = ((command: string, _showUI?: boolean, value?: string) => {
    if (command === 'insertHTML' && typeof value === 'string') {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const template = document.createElement('template')
        template.innerHTML = value
        range.insertNode(template.content.cloneNode(true) as DocumentFragment)
      }
      return true
    }
    return false
  }) as typeof document.execCommand
  return () => {
    document.execCommand = original
  }
}

interface MountedFixture {
  api: CreateMentionReturn
  editor: HTMLElement
  unmount: () => void
}

function mountFixture(options: MentionCoreOptions): MountedFixture {
  let api: CreateMentionReturn | undefined
  const { container, unmount } = render(Fixture, {
    options,
    oncreate: (created: CreateMentionReturn) => {
      api = created
    },
  })
  return {
    api: api!,
    editor: within(container).getByTestId('editor'),
    unmount,
  }
}

const users: MentionItem[] = [
  { id: '1', label: 'Alice' },
  { id: '2', label: 'Bob' },
]

function staticTriggers(): MentionTrigger[] {
  return [{ char: '@', items: users }]
}

afterEach(() => {
  document.body.innerHTML = ''
})

// ── tests ────────────────────────────────────────────────

describe('createMention', () => {
  it('opens the list and mirrors core state into $state', async () => {
    const { api, editor, unmount } = mountFixture({ triggers: staticTriggers() })

    expect(api.state.isOpen).toBe(false)

    typeInto(editor, '@')
    await tick()

    expect(api.state.isOpen).toBe(true)
    expect(api.state.activeTrigger).toBe('@')
    expect(api.state.query).toBe('')
    expect(api.state.filteredItems).toHaveLength(2)

    unmount()
  })

  it('renders the listbox with the ids provided by core', async () => {
    const { api, editor, unmount } = mountFixture({ triggers: staticTriggers() })

    typeInto(editor, '@a')
    await tick()

    const listbox = document.getElementById(api.ids.listbox)
    expect(listbox).not.toBeNull()
    expect(listbox?.getAttribute('role')).toBe('listbox')

    const option = document.getElementById(api.ids.option(0))
    expect(option?.textContent?.trim()).toBe('Alice')
    expect(option?.getAttribute('role')).toBe('option')
    expect(option?.getAttribute('aria-selected')).toBe('true')

    // core 自动在编辑器上维护 combobox ARIA
    expect(editor.getAttribute('role')).toBe('combobox')
    expect(editor.getAttribute('aria-controls')).toBe(api.ids.listbox)
    expect(editor.getAttribute('aria-activedescendant')).toBe(api.ids.option(0))

    unmount()
  })

  it('clicking a rendered option inserts a mention and exposes data via getParts()/toData', async () => {
    const restore = mockExecCommand()
    try {
      const triggers: MentionTrigger[] = [
        {
          char: '@',
          items: users,
          toData: (item) => ({ kind: 'user', userId: item.id }),
        },
      ]
      const { api, editor, unmount } = mountFixture({
        triggers,
        insertSpaceAfter: false,
      })

      typeInto(editor, '@ali')
      await tick()
      expect(api.state.filteredItems.map((item) => item.id)).toEqual(['1'])

      const option = document.getElementById(api.ids.option(0))
      expect(option).not.toBeNull()
      fireEvent.click(option!)
      await tick()

      expect(api.core.getState().isOpen).toBe(false)
      const parts = api.getParts()
      expect(parts).toEqual<Part[]>([
        {
          type: 'mention',
          trigger: '@',
          id: '1',
          label: 'Alice',
          data: { kind: 'user', userId: '1' },
        },
      ])
      expect(api.getPlainText()).toBe('@Alice')

      unmount()
    } finally {
      restore()
    }
  })

  it('getParts() returns Part[] for text and mentions round-tripped through setContent()', async () => {
    const { api, unmount } = mountFixture({ triggers: staticTriggers() })

    const content: Part[] = [
      { type: 'text', text: 'hello ' },
      { type: 'mention', trigger: '@', id: '2', label: 'Bob', data: { role: 'admin' } },
      { type: 'text', text: ' world' },
    ]
    api.setContent(content)

    expect(api.getParts()).toEqual<Part[]>(content)
    expect(api.getPlainText()).toBe('hello @Bob world')
    expect(api.state.isEmpty).toBe(false)

    api.clear()
    expect(api.getParts()).toEqual([])
    expect(api.state.isEmpty).toBe(true)

    unmount()
  })

  it('async + paginated sources update state and loadMore() appends', async () => {
    const page = vi.fn(async (_query: string, info?: { offset: number; limit: number }) => {
      const all = Array.from({ length: 5 }, (_, i) => ({ id: String(i), label: `item${i}` }))
      const offset = info?.offset ?? 0
      const limit = info?.limit ?? all.length
      return all.slice(offset, offset + limit)
    })
    const triggers: MentionTrigger[] = [{ char: '#', items: page, pagination: { pageSize: 2 } }]
    const { api, editor, unmount } = mountFixture({ triggers })

    typeInto(editor, '#')
    expect(api.state.loading).toBe(true)

    await vi.waitFor(() => expect(api.state.loading).toBe(false))
    expect(api.state.filteredItems).toHaveLength(2)
    expect(api.state.hasMore).toBe(true)

    api.loadMore()
    await vi.waitFor(() => expect(api.state.filteredItems).toHaveLength(4))
    expect(api.state.hasMore).toBe(true)

    api.loadMore()
    await vi.waitFor(() => expect(api.state.filteredItems).toHaveLength(5))
    expect(api.state.hasMore).toBe(false)

    unmount()
  })

  it('setOptions() with new triggers closes the list', async () => {
    const { api, editor, unmount } = mountFixture({ triggers: staticTriggers() })

    typeInto(editor, '@')
    expect(api.state.isOpen).toBe(true)

    api.setOptions({ triggers: [{ char: '#', items: [] }] })
    expect(api.state.isOpen).toBe(false)

    unmount()
  })

  it('stops mirroring state after the component is destroyed', async () => {
    const { api, editor, unmount } = mountFixture({ triggers: staticTriggers() })

    typeInto(editor, '@')
    expect(api.state.isOpen).toBe(true)

    unmount()

    // core 仍然可用，但销毁后不应再推送到 $state
    api.close()
    expect(api.state.isOpen).toBe(true)
    expect(api.state.filteredItems).toHaveLength(2)
  })

  it('gives every instance its own ids', () => {
    const first = mountFixture({ triggers: staticTriggers() })
    const second = mountFixture({ triggers: staticTriggers() })

    expect(first.api.ids.listbox).not.toBe(second.api.ids.listbox)
    expect(first.api.ids.option(0)).not.toBe(second.api.ids.option(0))
    expect(first.api.ids.listbox).not.toBe(first.api.ids.option(0))

    first.unmount()
    second.unmount()
  })

  it('exposes the package version', () => {
    expect(version).toBe(pkg.version)
  })
})
