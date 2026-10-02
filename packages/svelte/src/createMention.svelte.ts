import { MentionCore } from '@mentionly/core'
import type { MentionCoreOptions, MentionState } from '@mentionly/core'
import type { Action } from 'svelte/action'
import type { CreateMentionReturn } from './types.js'

/**
 * Svelte 5 headless adapter：把 framework-agnostic 的 {@link MentionCore} 状态镜像进
 * `$state`，并用一个 action 管理编辑器元素与订阅的生命周期。
 *
 * ```svelte
 * <script>
 *   import { createMention } from '@mentionly/svelte'
 *   const mention = createMention({ triggers: [{ char: '@', items: users }] })
 * </script>
 *
 * <div contenteditable use:mention.mention></div>
 * {#if mention.state.isOpen}
 *   <ul id={mention.ids.listbox} role="listbox">...</ul>
 * {/if}
 * ```
 *
 * 只支持 Svelte 5（runes）。构造时不访问 DOM，订阅与 viewport 监听都在 action 挂载后建立，
 * action 销毁时统一清理，组件卸载后不再更新 `$state`。
 */
export function createMention(options: MentionCoreOptions): CreateMentionReturn {
  const core = new MentionCore(options)

  // 快照镜像：core 的订阅是同步通知，Object.assign 会触发对应属性的响应式更新
  const state = $state<MentionState>({ ...core.getState() })

  let unsubscribe: (() => void) | null = null

  const mention: Action<HTMLElement> = (node) => {
    // action 可能被 Svelte 重建（node 变化时先 destroy 再重新调用），订阅保持幂等
    if (!unsubscribe) {
      unsubscribe = core.subscribe((snapshot) => {
        Object.assign(state, snapshot)
      })
      // 订阅建立前的状态变化补齐一次
      Object.assign(state, core.getState())
    }

    core.setElement(node)
    core.start({ bindHandlers: true })

    return {
      destroy() {
        core.stop()
        core.setElement(null)
        unsubscribe?.()
        unsubscribe = null
      },
    }
  }

  return {
    state,
    ids: core.ids,
    core,
    mention,
    setOptions: core.setOptions,
    select: core.select,
    insertMention: core.insertMention,
    loadMore: core.loadMore,
    close: core.close,
    getParts: core.getParts,
    getPlainText: core.getPlainText,
    clear: core.clear,
    setContent: core.setContent,
    focus: core.focus,
  }
}
