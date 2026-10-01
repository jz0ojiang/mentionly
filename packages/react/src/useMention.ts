import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { MentionCore } from '@mentionly/core'
import type { MentionCoreOptions, MentionState, MentionTrigger } from '@mentionly/core'
import type { UseMentionReturn } from './types'

// 浏览器环境没有 Node 的 process；Vite / 打包器会把 process.env.NODE_ENV 静态替换成字面量。
declare const process: { env: { NODE_ENV?: string } }

/** 连续多少次渲染都换了 triggers 引用时给出开发警告 */
const TRIGGERS_WARN_STREAK = 3

/** 渲染间参与比较的 options 字段（只有它们变化时才回写 core） */
interface OptionsSnapshot {
  triggers: MentionTrigger[]
  insertSpaceAfter: MentionCoreOptions['insertSpaceAfter']
  popupMode: MentionCoreOptions['popupMode']
  popupScrollBehavior: MentionCoreOptions['popupScrollBehavior']
}

function isDev(): boolean {
  // `typeof` 兜底：即使打包器没替换 process.env.NODE_ENV，浏览器里也不会 ReferenceError
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'
}

/**
 * 判断两个 core 快照是否「语义相同」。
 *
 * core 的 `getState()` 承诺「没有实际变化时返回同一引用」，但 `close()` 在列表已经关闭时
 * 仍会用新的空数组重新生成快照（`filteredItems: []`），于是订阅者会被无意义地通知一次。
 * React 的 `useSyncExternalStore` 对快照做 `Object.is` 比较，重复通知会触发无限重渲染
 * （用户在 JSX 里内联 triggers 数组时尤其明显：每次渲染 → setOptions → close() → 通知 → 重渲染）。
 * adapter 在这里按 React 的快照缓存契约做一次归一化，语义相同的快照继续复用旧引用。
 */
function sameSnapshot(a: MentionState, b: MentionState): boolean {
  if (a === b) return true
  if (
    a.isOpen !== b.isOpen
    || a.activeIndex !== b.activeIndex
    || a.query !== b.query
    || a.activeTrigger !== b.activeTrigger
    || a.loading !== b.loading
    || a.error !== b.error
    || a.loadingMore !== b.loadingMore
    || a.hasMore !== b.hasMore
    || a.isEmpty !== b.isEmpty
  ) {
    return false
  }
  if (a.filteredItems.length !== b.filteredItems.length) return false
  for (let i = 0; i < a.filteredItems.length; i++) {
    if (a.filteredItems[i] !== b.filteredItems[i]) return false
  }
  return a.popupPosition.top === b.popupPosition.top
    && a.popupPosition.left === b.popupPosition.left
    && a.popupPosition.width === b.popupPosition.width
}

/**
 * React adapter（薄壳）：把 framework-agnostic 的 {@link MentionCore} 接到 React 上。
 * 状态用 `useSyncExternalStore` 读取 core 的不可变快照，DOM 事件由 core 自己绑定
 * （`start({ bindHandlers: true })`），因此返回的 callback ref 挂上元素即可开箱即用。
 *
 * @param options 触发器与行为配置。`triggers` 必须是稳定引用（模块级常量或 `useMemo`），
 *   否则每次渲染的新数组都会触发 `setOptions`，进而关闭列表并作废在途请求；
 *   开发模式检测到连续 3 次渲染引用变化时会 `console.warn` 一次。
 *
 * ⚠ 编辑器元素内部的 DOM **完全由 core 管理**：不要把 React 子节点渲染进绑定了 ref 的
 *   `contenteditable` 元素（React 的重渲染会与 core 的直接 DOM 操作互相覆盖）。placeholder
 *   之类的内容请用属性 / CSS（例如 `data-placeholder` + `:empty::before`）实现。
 */
export function useMention(options: MentionCoreOptions): UseMentionReturn {
  // 惰性 useRef 初始化：每个组件实例只构造一次 core，且构造发生在 render 期、不碰 DOM（SSR 安全）
  const coreRef = useRef<MentionCore | null>(null)
  if (coreRef.current === null) coreRef.current = new MentionCore(options)
  const core = coreRef.current

  // 归一化快照：语义相同就复用旧引用（见 sameSnapshot 注释）
  const snapshotRef = useRef<MentionState>(core.getState())
  const getSnapshot = useCallback((): MentionState => {
    const next = core.getState()
    if (next !== snapshotRef.current && !sameSnapshot(snapshotRef.current, next)) {
      snapshotRef.current = next
    }
    return snapshotRef.current
  }, [core])
  const state = useSyncExternalStore(core.subscribe, getSnapshot, getSnapshot)

  // callback ref：挂上元素即 setElement + start；置 null（React 卸载时会先回调一次 null）即 stop + setElement
  const ref = useCallback((el: HTMLElement | null) => {
    if (el) {
      core.setElement(el)
      core.start({ bindHandlers: true })
    } else {
      core.stop()
      core.setElement(null)
    }
  }, [core])

  // 卸载兜底：即使元素从未挂上（ref 未被调用），也要停掉 viewport 监听与定时器
  useEffect(() => () => {
    core.stop()
    core.setElement(null)
  }, [core])

  // ── options 同步：逐字段比较引用，只在真的变化时回写 core ──
  const prevOptionsRef = useRef<OptionsSnapshot>({
    triggers: options.triggers,
    insertSpaceAfter: options.insertSpaceAfter,
    popupMode: options.popupMode,
    popupScrollBehavior: options.popupScrollBehavior,
  })
  const triggerStreakRef = useRef(0)
  const warnedRef = useRef(false)

  useEffect(() => {
    const prev = prevOptionsRef.current
    const next: OptionsSnapshot = {
      triggers: options.triggers,
      insertSpaceAfter: options.insertSpaceAfter,
      popupMode: options.popupMode,
      popupScrollBehavior: options.popupScrollBehavior,
    }

    const triggersChanged = prev.triggers !== next.triggers
    if (!triggersChanged) {
      triggerStreakRef.current = 0
    } else if (isDev()) {
      // 用户常在 JSX 里内联 triggers 数组（每次渲染都是新引用）→ 提示用 useMemo / 模块级常量
      triggerStreakRef.current += 1
      if (triggerStreakRef.current >= TRIGGERS_WARN_STREAK && !warnedRef.current) {
        warnedRef.current = true
        console.warn(
          '[mentionly/react] `triggers` changed on every render. ' +
          'This closes the popup and aborts in-flight requests. ' +
          'Pass a stable reference: a module-level constant or useMemo().',
        )
      }
    }

    if (
      triggersChanged
      || prev.insertSpaceAfter !== next.insertSpaceAfter
      || prev.popupMode !== next.popupMode
      || prev.popupScrollBehavior !== next.popupScrollBehavior
    ) {
      core.setOptions(next)
    }
    prevOptionsRef.current = next
  })

  return useMemo<UseMentionReturn>(() => ({
    ref,
    state,
    ids: core.ids,
    core,
    select: core.select,
    insertMention: core.insertMention,
    loadMore: core.loadMore,
    close: core.close,
    getParts: core.getParts,
    getDataParts: core.getDataParts,
    getPlainText: core.getPlainText,
    clear: core.clear,
    setContent: core.setContent,
    focus: core.focus,
  }), [ref, state, core])
}
