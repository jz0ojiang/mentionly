import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import MentionInput from '../src/MentionInput.vue'
import type { MentionItem, MentionTrigger } from '@mentionly/core'

const triggers: MentionTrigger[] = [
  { char: '@', items: [{ id: '1', label: 'Alice' }] },
]

describe('MentionInput', () => {
  it('mounts and renders contenteditable with placeholder', () => {
    const wrapper = mount(MentionInput, {
      props: {
        triggers,
        placeholder: 'Type here',
      },
    })

    const editor = wrapper.find('.mentionly-editor')
    expect(editor.exists()).toBe(true)
    expect(editor.attributes('contenteditable')).toBe('true')
    expect(editor.attributes('data-placeholder')).toBe('Type here')
    expect(editor.attributes('aria-placeholder')).toBe('Type here')
  })

  it('respects disabled prop', () => {
    const wrapper = mount(MentionInput, {
      props: {
        triggers,
        disabled: true,
      },
    })

    const editor = wrapper.find('.mentionly-editor')
    expect(editor.attributes('contenteditable')).toBe('false')
    expect(wrapper.find('.mentionly-wrapper--disabled').exists()).toBe(true)
  })

  it('exposes instance methods', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const inputRef = ref<InstanceType<typeof MentionInput> | null>(null)
        return { inputRef, triggers }
      },
      template: `<MentionInput ref="inputRef" :triggers="triggers" />`,
      components: { MentionInput },
    }))

    await nextTick()
    const vm = (wrapper.vm as any).inputRef

    expect(typeof vm.getParts).toBe('function')
    expect(typeof vm.getDataParts).toBe('function')
    expect(typeof vm.getPlainText).toBe('function')
    expect(typeof vm.clear).toBe('function')
    expect(typeof vm.setContent).toBe('function')
    expect(typeof vm.insertMention).toBe('function')
    expect(typeof vm.focus).toBe('function')
  })

  it('inserts custom mention without registered trigger and keeps custom dataPart', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const inputRef = ref<InstanceType<typeof MentionInput> | null>(null)
        return { inputRef, triggers }
      },
      template: `<MentionInput ref="inputRef" :triggers="triggers" />`,
      components: { MentionInput },
    }))

    await nextTick()
    const vm = (wrapper.vm as any).inputRef

    const inserted = vm.insertMention({
      id: 'ext-1',
      label: 'External Item',
      dataPart: (item: { id: string; label: string; triggeredBy: string }) => ({
        dataType: 'external_ref',
        refId: item.id,
        displayName: item.label,
        trigger: item.triggeredBy,
      }),
    })

    expect(inserted).toBe(true)
    // 2.0 输出：自定义 dataPart 不在 Part 里（它只进 mention span 的 dataset），
    // 且默认追加的 NBSP 会被首尾 trim 去掉
    expect(vm.getParts()).toEqual([
      {
        type: 'mention',
        trigger: '',
        id: 'ext-1',
        label: 'External Item',
      },
    ])

    // getDataParts() 保留 1.x 的 dataPart 输出
    expect(vm.getDataParts()).toEqual([
      {
        type: 'data',
        dataType: 'external_ref',
        refId: 'ext-1',
        displayName: 'External Item',
        trigger: '',
      },
    ])
  })

  it('supports insertMention without trailing space', async () => {
    const wrapper = mount(defineComponent({
      setup() {
        const inputRef = ref<InstanceType<typeof MentionInput> | null>(null)
        return { inputRef, triggers }
      },
      template: `<MentionInput ref="inputRef" :triggers="triggers" />`,
      components: { MentionInput },
    }))

    await nextTick()
    const vm = (wrapper.vm as any).inputRef

    vm.insertMention({
      id: 'sel-1',
      label: 'Selection Context',
      trigger: '@',
      data: { dataType: 'selection_ref', sourceId: 'sel-1', title: 'Selection Context' },
    }, { appendSpace: false })

    const parts = vm.getParts()
    expect(parts).toHaveLength(1)
    expect(parts[0]).toEqual({
      type: 'mention',
      trigger: '@',
      id: 'sel-1',
      label: 'Selection Context',
      data: { dataType: 'selection_ref', sourceId: 'sel-1', title: 'Selection Context' },
    })
  })

  // 把光标移到编辑器文本末尾（contenteditable 的选区在 jsdom 里需要手动设置）
  function setEditorText(editor: HTMLElement, text: string) {
    editor.textContent = text
    const node = editor.firstChild as Text
    const range = document.createRange()
    range.setStart(node, text.length)
    range.setEnd(node, text.length)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  it('submits on Enter when not composing', async () => {
    const wrapper = mount(MentionInput, { props: { triggers } })
    const editor = wrapper.find('.mentionly-editor')
    setEditorText(editor.element as HTMLElement, 'hello')
    await editor.trigger('input')

    editor.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await nextTick()

    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('does not submit on Enter while the IME is composing', async () => {
    const wrapper = mount(MentionInput, { props: { triggers } })
    const editor = wrapper.find('.mentionly-editor')
    setEditorText(editor.element as HTMLElement, 'hello')
    await editor.trigger('input')

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'isComposing', { value: true })
    editor.element.dispatchEvent(ev)
    await nextTick()

    expect(ev.defaultPrevented).toBe(false)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('does not handle Enter with keyCode 229 (IME) — no onEnter, no submit, no preventDefault', async () => {
    const onEnter = vi.fn()
    const wrapper = mount(MentionInput, { props: { triggers, onEnter } })
    const editor = wrapper.find('.mentionly-editor')
    setEditorText(editor.element as HTMLElement, 'hello')
    await editor.trigger('input')

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'isComposing', { value: false })
    Object.defineProperty(ev, 'keyCode', { value: 229 })
    editor.element.dispatchEvent(ev)
    await nextTick()

    expect(onEnter).not.toHaveBeenCalled()
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(ev.defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('does not select a list item on Enter while the IME is composing', async () => {
    const wrapper = mount(MentionInput, {
      props: { triggers, teleport: false },
      attachTo: document.body,
    })
    const editor = wrapper.find('.mentionly-editor')
    setEditorText(editor.element as HTMLElement, '@a')
    await editor.trigger('input')
    expect(wrapper.find('.mentionly-dropdown').exists()).toBe(true)

    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    Object.defineProperty(ev, 'isComposing', { value: true })
    editor.element.dispatchEvent(ev)
    await nextTick()

    expect(ev.defaultPrevented).toBe(false)
    expect(wrapper.find('.mentionly-dropdown').exists()).toBe(true)
    expect(wrapper.emitted('submit')).toBeUndefined()
    wrapper.unmount()
  })

  it('emits Part[] payloads on change and submit', async () => {
    const wrapper = mount(MentionInput, { props: { triggers }, attachTo: document.body })
    const editor = wrapper.find('.mentionly-editor')
    setEditorText(editor.element as HTMLElement, 'hello')
    await editor.trigger('input')

    expect(wrapper.emitted('change')?.at(-1)).toEqual([[{ type: 'text', text: 'hello' }]])

    editor.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await nextTick()

    expect(wrapper.emitted('submit')?.at(-1)).toEqual([[{ type: 'text', text: 'hello' }]])
    wrapper.unmount()
  })

  it('persists a trigger toData in the component output', async () => {
    const toData = vi.fn((item: MentionItem) => ({ uri: item.uri, kind: item.kind }))
    const toDataTriggers: MentionTrigger[] = [
      { char: '@', items: [{ id: '1', label: 'Alice', uri: 'user:alice', kind: 'person' }], toData },
    ]
    const wrapper = mount(MentionInput, {
      props: { triggers: toDataTriggers, teleport: false },
      attachTo: document.body,
    })
    const editor = wrapper.find('.mentionly-editor')
    setEditorText(editor.element as HTMLElement, '@al')
    await editor.trigger('input')
    await nextTick()

    // jsdom 没有 execCommand：mock 成直接写入 innerHTML，与 core 测试同一做法
    const editorEl = editor.element as HTMLElement
    const originalExec = document.execCommand
    document.execCommand = vi.fn((_command: string, _ui?: boolean, value?: string) => {
      editorEl.innerHTML = value ?? ''
      return true
    }) as unknown as typeof document.execCommand

    try {
      await wrapper.find('.mentionly-list-item').trigger('mousedown')

      expect(toData).toHaveBeenCalledOnce()
      expect((wrapper.vm as any).getParts()).toEqual([
        { type: 'mention', trigger: '@', id: '1', label: 'Alice', data: { uri: 'user:alice', kind: 'person' } },
      ])
    } finally {
      document.execCommand = originalExec
      wrapper.unmount()
    }
  })

  it('renders a default error message and honors a custom #error slot', async () => {
    const failing: MentionTrigger[] = [
      { char: '@', items: () => Promise.reject(new Error('boom')) },
    ]
    const flushAsync = async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
      await nextTick()
    }

    const wrapper = mount(MentionInput, {
      props: { triggers: failing, teleport: false },
      attachTo: document.body,
    })
    const editor = wrapper.find('.mentionly-editor')
    setEditorText(editor.element as HTMLElement, '@')
    await editor.trigger('input')
    await flushAsync()

    const errorBox = wrapper.find('.mentionly-error')
    expect(errorBox.exists()).toBe(true)
    expect(errorBox.attributes('role')).toBe('alert')
    expect(errorBox.text()).toContain('Failed to load suggestions.')
    wrapper.unmount()

    const custom = mount(MentionInput, {
      props: { triggers: failing, teleport: false },
      attachTo: document.body,
      slots: { error: '<span class="custom-error">custom failure</span>' },
    })
    const customEditor = custom.find('.mentionly-editor')
    setEditorText(customEditor.element as HTMLElement, '@')
    await customEditor.trigger('input')
    await flushAsync()

    expect(custom.find('.mentionly-error .custom-error').text()).toBe('custom failure')
    custom.unmount()
  })

  it('wires aria-controls / aria-activedescendant to the rendered listbox', async () => {
    const twoTriggers: MentionTrigger[] = [
      { char: '@', items: [{ id: '1', label: 'Alice' }, { id: '2', label: 'Bob' }] },
    ]
    const wrapper = mount(MentionInput, {
      props: { triggers: twoTriggers, teleport: false },
      attachTo: document.body,
    })
    const editor = wrapper.find('.mentionly-editor')
    setEditorText(editor.element as HTMLElement, '@')
    await editor.trigger('input')
    await nextTick()

    const controls = editor.attributes('aria-controls')
    const listbox = wrapper.find('.mentionly-list')
    expect(controls).toBeTruthy()
    expect(listbox.attributes('id')).toBe(controls)
    expect(listbox.attributes('role')).toBe('listbox')

    const activeDescendant = editor.attributes('aria-activedescendant')
    const activeOption = wrapper.find('.mentionly-list-item--active')
    expect(activeOption.exists()).toBe(true)
    expect(activeOption.attributes('id')).toBe(activeDescendant)
    expect(activeOption.attributes('role')).toBe('option')
    expect(activeOption.attributes('aria-selected')).toBe('true')
    // aria-activedescendant 指向的元素必须真实存在于文档里
    expect(document.getElementById(activeDescendant!)).toBe(activeOption.element)
    wrapper.unmount()
  })

  it('gives two MentionInput instances distinct a11y ids', async () => {
    const a = mount(MentionInput, { props: { triggers, teleport: false }, attachTo: document.body })
    const b = mount(MentionInput, { props: { triggers, teleport: false }, attachTo: document.body })

    const aEditor = a.find('.mentionly-editor')
    const bEditor = b.find('.mentionly-editor')
    setEditorText(aEditor.element as HTMLElement, '@')
    await aEditor.trigger('input')
    setEditorText(bEditor.element as HTMLElement, '@')
    await bEditor.trigger('input')
    await nextTick()

    const aControls = aEditor.attributes('aria-controls')
    const bControls = bEditor.attributes('aria-controls')
    expect(aControls).toBeTruthy()
    expect(bControls).toBeTruthy()
    expect(aControls).not.toBe(bControls)
    expect(a.find('.mentionly-list').attributes('id')).toBe(aControls)
    expect(b.find('.mentionly-list').attributes('id')).toBe(bControls)

    a.unmount()
    b.unmount()
  })
})
