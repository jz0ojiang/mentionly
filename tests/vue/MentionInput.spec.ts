import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import MentionInput from '../../src/vue/MentionInput.vue'
import type { MentionTrigger } from '../../src/core/types'

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
    expect(vm.getParts()).toEqual([
      {
        type: 'mention',
        triggeredBy: '',
        id: 'ext-1',
        label: 'External Item',
        dataPart: {
          dataType: 'external_ref',
          refId: 'ext-1',
          displayName: 'External Item',
          trigger: '',
        },
      },
      { type: 'text', content: '\u00A0' },
    ])

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
      dataPart: (item: { id: string; label: string }) => ({
        dataType: 'selection_ref',
        sourceId: item.id,
        title: item.label,
      }),
    }, { appendSpace: false })

    const parts = vm.getParts()
    expect(parts).toHaveLength(1)
    expect(parts[0]).toEqual({
      type: 'mention',
      triggeredBy: '',
      id: 'sel-1',
      label: 'Selection Context',
      dataPart: {
        dataType: 'selection_ref',
        sourceId: 'sel-1',
        title: 'Selection Context',
      },
    })
    expect(vm.getDataParts()).toEqual([
      {
        type: 'data',
        dataType: 'selection_ref',
        sourceId: 'sel-1',
        title: 'Selection Context',
      },
    ])
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
})
