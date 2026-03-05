import { ref, computed, onMounted, onBeforeUnmount, watch, type Ref } from 'vue'
import type {
  UseMentionOptions,
  UseMentionReturn,
  MentionItem,
  MentionTrigger,
  ContentPart,
  DataPart,
  PopupPosition,
} from './types'
import {
  createMentionSpan,
  parseDOMToParts,
  contentPartsToDataParts,
  restoreContent,
  setCursorToEnd,
  getTextBeforeCursor,
  getPlainTextFromParts,
} from './utils'

export function useMention(options: UseMentionOptions): UseMentionReturn {
  const editorRef: Ref<HTMLElement | null> = ref(null)

  // ── 下拉列表状态 ──
  const isOpen = ref(false)
  const filteredItems: Ref<MentionItem[]> = ref([])
  const activeIndex = ref(0)
  const query = ref('')
  const activeTrigger: Ref<string | null> = ref(null)
  const loading = ref(false)
  const popupPosition: Ref<PopupPosition> = ref({ top: 0, left: 0 })

  // ── 内部状态 ──
  let isComposing = false
  let isPasting = false
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let asyncVersion = 0
  // 用于驱动 isEmpty computed 重新计算
  const contentVersion = ref(0)
  function bumpVersion() { contentVersion.value++ }

  // 读取最新 triggers（保持对 reactive props 的响应性）
  function getTriggers() { return options.triggers }
  // ── 触发检测（用 lastIndexOf 替代正则，更简洁健壮） ──
  function detectTrigger() {
    if (isComposing || isPasting) return

    const info = getTextBeforeCursor()
    if (!info) { close(); return }

    const { text } = info
    const triggers = getTriggers()
    let bestMatch: { trigger: MentionTrigger; matchQuery: string; index: number } | null = null

    for (const trigger of triggers) {
      const idx = text.lastIndexOf(trigger.char)
      if (idx === -1) continue
      const afterTrigger = text.slice(idx + trigger.char.length)
      if (/\s/.test(afterTrigger)) continue
      if (!bestMatch || idx > bestMatch.index) {
        bestMatch = { trigger, matchQuery: afterTrigger, index: idx }
      }
    }

    if (bestMatch) {
      activeTrigger.value = bestMatch.trigger.char
      query.value = bestMatch.matchQuery
      activeIndex.value = 0
      isOpen.value = true
      updateCursorPosition()
      loadItems(bestMatch.trigger, bestMatch.matchQuery)
    } else {
      close()
    }
  }

  // ── 加载候选项（统一 Promise.resolve 包装，不再双重调用） ──
  function loadItems(trigger: MentionTrigger, q: string) {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }

    const { items } = trigger

    if (Array.isArray(items)) {
      const lowerQ = q.toLowerCase()
      filteredItems.value = items.filter((item) => item.label.toLowerCase().includes(lowerQ))
      loading.value = false
      return
    }

    const debounceMs = trigger.debounce ?? 0
    const version = ++asyncVersion

    if (debounceMs > 0) {
      loading.value = true
      debounceTimer = setTimeout(() => resolveItems(items, q, version), debounceMs)
    } else {
      loading.value = true
      resolveItems(items, q, version)
    }
  }

  async function resolveItems(
    items: (q: string) => MentionItem[] | Promise<MentionItem[]>,
    q: string,
    version: number,
  ) {
    try {
      const data = await Promise.resolve(items(q))
      if (version === asyncVersion) {
        filteredItems.value = data
        loading.value = false
      }
    } catch {
      if (version === asyncVersion) {
        filteredItems.value = []
        loading.value = false
      }
    }
  }
  // ── 选中候选项 ──
  function select(item: MentionItem) {
    const editor = editorRef.value
    if (!editor) return

    const triggers = getTriggers()
    const trigger = triggers.find((t) => t.char === activeTrigger.value)
    if (!trigger) return

    if (trigger.mode === 'command') {
      selectTriggerText(trigger.char)
      document.execCommand('delete')
      trigger.onSelect?.(item)
      close()
      bumpVersion()
      return
    }

    // 选中触发文本，用 execCommand('insertHTML') 替换为 mention span
    // 这样整个操作进入浏览器 undo 栈，Ctrl+Z 可撤销
    if (!selectTriggerText(trigger.char)) return
    const span = createMentionSpan(trigger.char, item)
    const suffix = options.insertSpaceAfter !== false ? '\u00A0' : ''
    document.execCommand('insertHTML', false, span.outerHTML + suffix)

    close()
    bumpVersion()
    editor.focus()
  }

  /** 选中触发文本（不删除），返回是否成功 */
  function selectTriggerText(triggerChar: string): boolean {
    const info = getTextBeforeCursor()
    if (!info) return false

    const { text, node, offset } = info
    const idx = text.lastIndexOf(triggerChar)
    if (idx === -1) return false

    const sel = window.getSelection()
    if (!sel) return false
    const range = document.createRange()
    range.setStart(node, idx)
    range.setEnd(node, offset)
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  }

  function updateCursorPosition() {
    const editor = editorRef.value
    if (!editor) return

    const popupMode = options.popupMode ?? 'fixed'

    if (popupMode === 'fixed') {
      const editorRect = editor.getBoundingClientRect()
      popupPosition.value = {
        top: editorRect.top,
        left: editorRect.left,
        width: editorRect.width,
      }
    } else {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0).cloneRange()
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      popupPosition.value = {
        top: rect.top,
        left: rect.left,
      }
    }
  }

  let rafId: number | null = null
  function schedulePopupPositionUpdate() {
    if (!isOpen.value) return
    if (rafId !== null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      updateCursorPosition()
    })
  }

  function handleViewportChange() {
    if (!isOpen.value) return
    const behavior = options.popupScrollBehavior ?? 'reposition'
    if (behavior === 'ignore') return
    if (behavior === 'close') {
      close()
      return
    }
    schedulePopupPositionUpdate()
  }

  function close() {
    isOpen.value = false
    activeTrigger.value = null
    query.value = ''
    filteredItems.value = []
    activeIndex.value = 0
    loading.value = false
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  }
  // ── 事件处理器 ──
  function onInput() {
    bumpVersion()
    detectTrigger()
  }

  function onKeydown(e: KeyboardEvent) {
    if (!isOpen.value) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (filteredItems.value.length > 0) {
          activeIndex.value = (activeIndex.value + 1) % filteredItems.value.length
        }
        return
      case 'ArrowUp':
        e.preventDefault()
        if (filteredItems.value.length > 0) {
          activeIndex.value = (activeIndex.value - 1 + filteredItems.value.length) % filteredItems.value.length
        }
        return
      case 'Enter':
      case 'Tab':
        if (filteredItems.value.length > 0) {
          e.preventDefault()
          select(filteredItems.value[activeIndex.value]!)
        }
        // 列表为空时不 preventDefault，让事件继续冒泡
        return
      case 'Escape':
        e.preventDefault()
        close()
        return
    }
  }

  function onBeforeinput(e: InputEvent) {
    if (e.inputType !== 'deleteContentBackward') return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!range.collapsed) return

    const node = range.startContainer
    const offset = range.startOffset
    let mentionToRemove: Node | null = null

    if (node.nodeType === Node.ELEMENT_NODE) {
      const prev = (node as HTMLElement).childNodes[offset - 1]
      if (prev?.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset?.mentionId) {
        mentionToRemove = prev
      }
    } else if (node.nodeType === Node.TEXT_NODE && offset === 0) {
      const prev = node.previousSibling
      if (prev?.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset?.mentionId) {
        mentionToRemove = prev
      }
    }

    if (mentionToRemove) {
      e.preventDefault()
      mentionToRemove.parentNode?.removeChild(mentionToRemove)
      bumpVersion()
    }
  }

  function onCompositionstart() { isComposing = true }
  function onCompositionend() { isComposing = false; detectTrigger() }

  function onPaste(e: ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text) return
    isPasting = true
    document.execCommand('insertText', false, text)
    isPasting = false
  }

  let blurTimer: ReturnType<typeof setTimeout> | null = null
  function onFocus() {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null }
  }
  function onBlur() {
    blurTimer = setTimeout(() => close(), 150)
  }
  // ── 内容序列化 ──
  function getParts(): ContentPart[] {
    const editor = editorRef.value
    if (!editor) return []
    return parseDOMToParts(editor)
  }

  function getDataParts(): DataPart[] {
    return contentPartsToDataParts(getParts(), getTriggers())
  }

  function getPlainText(): string {
    return getPlainTextFromParts(getParts())
  }

  // ── 编辑器操作 ──
  function clear() {
    const editor = editorRef.value
    if (!editor) return
    editor.innerHTML = ''
    bumpVersion()
    close()
  }

  function setContent(parts: ContentPart[]) {
    const editor = editorRef.value
    if (!editor) return
    restoreContent(editor, parts)
    bumpVersion()
  }

  function focus() {
    const editor = editorRef.value
    if (!editor) return
    editor.focus()
    setCursorToEnd(editor)
  }

  const isEmpty = computed(() => {
    // contentVersion 作为响应式依赖，驱动重新计算
    void contentVersion.value
    const editor = editorRef.value
    if (!editor) return true
    const text = editor.textContent ?? ''
    return text.trim().length === 0 && !editor.querySelector('[data-mention-id]')
  })

  let listenersAttached = false
  function syncViewportListeners() {
    const behavior = options.popupScrollBehavior ?? 'reposition'
    if (behavior === 'ignore') {
      if (listenersAttached) {
        window.removeEventListener('scroll', handleViewportChange, true)
        window.removeEventListener('resize', handleViewportChange)
        listenersAttached = false
      }
      return
    }
    if (!listenersAttached) {
      window.addEventListener('scroll', handleViewportChange, true)
      window.addEventListener('resize', handleViewportChange)
      listenersAttached = true
    }
  }

  onMounted(() => {
    syncViewportListeners()
  })

  watch(() => options.popupScrollBehavior, () => {
    syncViewportListeners()
  })

  onBeforeUnmount(() => {
    if (listenersAttached) {
      window.removeEventListener('scroll', handleViewportChange, true)
      window.removeEventListener('resize', handleViewportChange)
      listenersAttached = false
    }
    if (rafId !== null) window.cancelAnimationFrame(rafId)
    if (debounceTimer) clearTimeout(debounceTimer)
    if (blurTimer) clearTimeout(blurTimer)
  })

  return {
    editorRef,
    isOpen,
    filteredItems,
    activeIndex,
    query,
    activeTrigger,
    loading,
    popupPosition,
    select,
    close,
    getParts,
    getDataParts,
    getPlainText,
    clear,
    setContent,
    focus,
    isEmpty,
    handlers: {
      input: onInput,
      keydown: onKeydown,
      beforeinput: onBeforeinput,
      compositionstart: onCompositionstart,
      compositionend: onCompositionend,
      paste: onPaste,
      focus: onFocus,
      blur: onBlur,
    },
  }
}
