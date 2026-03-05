import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import MentionInput from '../src/MentionInput.vue'
import type { MentionTrigger } from '../src/types'

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
    expect(typeof vm.focus).toBe('function')
  })
})
