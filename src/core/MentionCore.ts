import type {
  MentionCoreOptions,
  MentionState,
  MentionHandlers,
  AttachOptions,
  MentionItem,
  MentionTrigger,
  MentionPageInfo,
  MentionItemsResult,
  ContentPart,
  DataPart,
  InsertMentionPayload,
  InsertMentionOptions,
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

// 键盘导航接近末尾多少项时预取下一页
const PREFETCH_THRESHOLD = 3

function createInitialState(): MentionState {
  return {
    isOpen: false,
    filteredItems: [],
    activeIndex: 0,
    query: '',
    activeTrigger: null,
    loading: false,
    loadingMore: false,
    hasMore: false,
    popupPosition: { top: 0, left: 0 },
    isEmpty: true,
  }
}

/**
 * Framework-agnostic DOM core。封装 mention 输入的全部逻辑（触发检测、异步分页加载、
 * 内容序列化、键鼠/IME 事件处理），通过 plain snapshot + subscribe 把状态同步推给任意框架
 * adapter（Vue ref 镜像 / React useSyncExternalStore / Svelte store）。
 *
 * ⚠ 依赖浏览器 DOM（HTMLElement / document / window / Selection / Range / execCommand）。
 *   SSR 安全的边界是「import / 构造时不碰 DOM」——构造函数内不访问 window/document。
 */
export class MentionCore {
  private options: MentionCoreOptions
  private element: HTMLElement | null = null

  // ── 状态快照 ──
  private state: MentionState = createInitialState()
  private subscribers = new Set<(s: MentionState) => void>()
  private dirty = false
  private batchDepth = 0

  // ── 内部状态机（原 useMention 闭包变量，原样保留语义） ──
  private loadedOffset = 0
  private isComposing = false
  private isPasting = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private asyncVersion = 0
  private rafId: number | null = null
  private blurTimer: ReturnType<typeof setTimeout> | null = null

  // ── 生命周期标志 ──
  private started = false
  private autoBindHandlers = false
  private handlersBound = false
  private listenersAttached = false

  // ⚠ 构造函数内禁止访问 window/document（SSR 安全）
  constructor(options: MentionCoreOptions) {
    // 存普通快照，后续靠 setOptions 更新；不持有外部响应式对象引用
    this.options = { ...options }
  }

  // ════════════════════════════════════════
  //  状态：plain snapshot + 同步通知
  // ════════════════════════════════════════

  getState = (): MentionState => this.state

  subscribe = (fn: (s: MentionState) => void): (() => void) => {
    this.subscribers.add(fn)
    return () => { this.subscribers.delete(fn) }
  }

  /** 合并状态字段、生成新引用、同步通知。无字段实际变化时直接返回，getState 保持同一引用。 */
  private setState(partial: Partial<MentionState>): void {
    let changed = false
    for (const key of Object.keys(partial) as (keyof MentionState)[]) {
      if (!Object.is(this.state[key], partial[key])) { changed = true; break }
    }
    if (!changed) return

    this.state = { ...this.state, ...partial }
    this.dirty = true
    if (this.batchDepth === 0) this.flush()
  }

  private flush(): void {
    if (!this.dirty) return
    this.dirty = false
    const s = this.state
    for (const fn of this.subscribers) fn(s)
  }

  /** 把多次 setState 合并为一次同步通知（深度计数，不进 microtask）。 */
  private batch<T>(fn: () => T): T {
    this.batchDepth++
    try {
      return fn()
    } finally {
      this.batchDepth--
      if (this.batchDepth === 0) this.flush()
    }
  }

  // ════════════════════════════════════════
  //  生命周期
  // ════════════════════════════════════════

  /** 绑定 / 解绑编辑器元素。可被多次调用、可置 null（跟随 Vue 的 watch(editorRef)）。幂等。 */
  setElement = (el: HTMLElement | null): void => {
    if (el === this.element) return
    if (this.handlersBound && this.element) this.unbindElementHandlers(this.element)
    this.element = el
    if (this.autoBindHandlers && this.started && el) this.bindElementHandlers(el)
    // 新元素可能自带内容，重算 isEmpty
    this.bumpVersion()
  }

  /** 挂一次 window viewport 监听（+ 可选把 handlers 绑到元素上）。取代 onMounted。可重复调用。 */
  start = (opts?: AttachOptions): void => {
    const nextAutoBind = opts?.bindHandlers ?? true
    // 重复 start 且 bindHandlers 由 true → false 时，先卸掉已绑的 handlers
    if (this.handlersBound && !nextAutoBind && this.element) {
      this.unbindElementHandlers(this.element)
    }
    this.autoBindHandlers = nextAutoBind
    this.started = true
    this.syncViewportListeners()
    if (this.autoBindHandlers && this.element) this.bindElementHandlers(this.element)
  }

  /** 便捷封装：setElement(el) + start(opts)，给 vanilla / React 开箱即用。 */
  attach = (el: HTMLElement | null, opts?: AttachOptions): void => {
    this.setElement(el)
    this.start(opts)
  }

  /** 解绑 viewport + 清所有 timer/RAF（+ 解绑元素 handlers）。取代 onBeforeUnmount。 */
  stop = (): void => {
    this.started = false
    if (this.handlersBound && this.element) this.unbindElementHandlers(this.element)
    this.teardownViewportListeners()
    if (this.rafId !== null) { window.cancelAnimationFrame(this.rafId); this.rafId = null }
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null }
    if (this.blurTimer) { clearTimeout(this.blurTimer); this.blurTimer = null }
  }

  /** Vue reactive props 变化时调；必须覆盖全部字段（含 insertSpaceAfter，select 会用到）。 */
  setOptions = (partial: Partial<MentionCoreOptions>): void => {
    this.options = { ...this.options, ...partial }
    this.syncViewportListeners()
  }

  private bindElementHandlers(el: HTMLElement): void {
    if (this.handlersBound) return
    for (const [event, handler] of Object.entries(this.handlers)) {
      el.addEventListener(event, handler as EventListener)
    }
    this.handlersBound = true
  }

  private unbindElementHandlers(el: HTMLElement): void {
    if (!this.handlersBound) return
    for (const [event, handler] of Object.entries(this.handlers)) {
      el.removeEventListener(event, handler as EventListener)
    }
    this.handlersBound = false
  }

  // ════════════════════════════════════════
  //  触发检测
  // ════════════════════════════════════════

  private getTriggers(): MentionTrigger[] { return this.options.triggers }

  // 用 lastIndexOf 替代正则
  private detectTrigger(): void {
    if (this.isComposing || this.isPasting) return

    const info = getTextBeforeCursor()
    if (!info) { this.close(); return }

    const { text } = info
    const triggers = this.getTriggers()
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
      this.setState({
        activeTrigger: bestMatch.trigger.char,
        query: bestMatch.matchQuery,
        activeIndex: 0,
        isOpen: true,
      })
      this.updateCursorPosition()
      this.loadItems(bestMatch.trigger, bestMatch.matchQuery)
    } else {
      this.close()
    }
  }

  // 读取触发器的分页页大小；未配置或非法则返回 null（= 不分页）
  private getPageSize(trigger: MentionTrigger): number | null {
    const ps = trigger.pagination?.pageSize
    return typeof ps === 'number' && ps > 0 ? ps : null
  }

  // 归一化函数型数据源的返回值
  private normalizeResult(
    raw: MentionItemsResult,
    pageSize: number | null,
  ): { list: MentionItem[]; more: boolean } {
    if (Array.isArray(raw)) {
      return { list: raw, more: pageSize != null && raw.length >= pageSize }
    }
    const list = raw?.items ?? []
    const more = raw?.hasMore ?? (pageSize != null && list.length >= pageSize)
    return { list, more }
  }

  // ── 加载候选项（首屏：替换列表并无条件重置分页状态） ──
  private loadItems(trigger: MentionTrigger, q: string): void {
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null }

    // 无条件重置分页状态，覆盖 query 变化与多 trigger 切换
    this.loadedOffset = 0
    this.setState({ hasMore: false, loadingMore: false })

    const { items } = trigger

    if (Array.isArray(items)) {
      const lowerQ = q.toLowerCase()
      this.setState({
        filteredItems: items.filter((item) => item.label.toLowerCase().includes(lowerQ)),
        loading: false,
      })
      return
    }

    const debounceMs = trigger.debounce ?? 0
    const version = ++this.asyncVersion
    this.setState({ loading: true })

    const run = () => this.resolveItems(trigger, q, version, 0, 'replace')
    if (debounceMs > 0) {
      this.debounceTimer = setTimeout(run, debounceMs)
    } else {
      run()
    }
  }

  // 加载下一页并追加。无下一页 / 正在加载 / 非分页源时为空操作。
  loadMore = (): void => {
    if (!this.state.isOpen || this.state.loading || this.state.loadingMore || !this.state.hasMore) return

    const trigger = this.getTriggers().find((t) => t.char === this.state.activeTrigger)
    if (!trigger || Array.isArray(trigger.items)) return
    if (this.getPageSize(trigger) == null) return

    // 同步置位作为并发锁；沿用当前 asyncVersion（新 query 会 bump 使其失效）
    this.setState({ loadingMore: true })
    this.resolveItems(trigger, this.state.query, this.asyncVersion, this.loadedOffset, 'append')
  }

  private resolveItems = async (
    trigger: MentionTrigger,
    q: string,
    version: number,
    offset: number,
    mode: 'replace' | 'append',
  ): Promise<void> => {
    const items = trigger.items as (
      query: string,
      page?: MentionPageInfo,
    ) => MentionItemsResult | Promise<MentionItemsResult>
    const pageSize = this.getPageSize(trigger)
    const pageArg: MentionPageInfo | undefined =
      pageSize != null ? { offset, limit: pageSize } : undefined

    try {
      // 非分页源保持原有的一元调用，避免传入多余的第二参数
      const raw = await Promise.resolve(pageArg ? items(q, pageArg) : items(q))
      // 过期请求（query 变化 / close）直接丢弃，不触碰任何状态
      if (version !== this.asyncVersion) return

      this.batch(() => {
        const { list, more } = this.normalizeResult(raw, pageSize)
        const newItems = mode === 'append' ? this.state.filteredItems.concat(list) : list
        this.setState({ filteredItems: newItems })

        // 防止 activeIndex 越界（append 与新 query replace 竞态时尤为重要）
        if (this.state.activeIndex > newItems.length - 1) {
          this.setState({ activeIndex: Math.max(0, newItems.length - 1) })
        }

        this.loadedOffset = newItems.length
        this.setState({
          hasMore: pageSize != null && more,
          loading: false,
          loadingMore: false,
        })
      })
    } catch {
      if (version !== this.asyncVersion) return
      this.batch(() => {
        // 首屏失败清空；追加失败保留已加载项与 hasMore 以便重试，且不推进 offset
        if (mode === 'replace') {
          this.setState({ filteredItems: [], hasMore: false })
        }
        this.setState({ loading: false, loadingMore: false })
      })
    }
  }

  // ════════════════════════════════════════
  //  选中 / 插入
  // ════════════════════════════════════════

  select = (item: MentionItem): void => {
    this.batch(() => {
      const editor = this.element
      if (!editor) return

      const triggers = this.getTriggers()
      const trigger = triggers.find((t) => t.char === this.state.activeTrigger)
      if (!trigger) return

      if (trigger.mode === 'command') {
        this.selectTriggerText(trigger.char)
        document.execCommand('delete')
        trigger.onSelect?.(item)
        this.close()
        this.bumpVersion()
        return
      }

      // 选中触发文本，用 execCommand('insertHTML') 替换为 mention span
      // 这样整个操作进入浏览器 undo 栈，Ctrl+Z 可撤销
      if (!this.selectTriggerText(trigger.char)) return
      const span = createMentionSpan(trigger.char, item)
      const suffix = this.options.insertSpaceAfter !== false ? '\u00A0' : ''
      document.execCommand('insertHTML', false, span.outerHTML + suffix)

      this.close()
      this.bumpVersion()
      editor.focus()
    })
  }

  insertMention = (payload: InsertMentionPayload, insertOptions: InsertMentionOptions = {}): boolean => {
    return this.batch(() => {
      const editor = this.element
      if (!editor) return false

      const trigger = payload.triggeredBy ?? ''
      const mentionId = payload.id
      const dataPart = typeof payload.dataPart === 'function'
        ? payload.dataPart({ id: mentionId, label: payload.label, triggeredBy: trigger })
        : payload.dataPart

      if (insertOptions.focus !== false) {
        editor.focus()
      }

      const selection = window.getSelection()
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null
      const inEditor = range ? editor.contains(range.startContainer) : false
      if (!inEditor) {
        setCursorToEnd(editor)
      }

      const span = createMentionSpan(trigger, { id: mentionId, label: payload.label }, dataPart)
      const shouldAppendSpace = insertOptions.appendSpace ?? true
      const suffix = shouldAppendSpace ? '\u00A0' : ''
      if (typeof document.execCommand === 'function') {
        document.execCommand('insertHTML', false, span.outerHTML + suffix)
      } else {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) {
          editor.appendChild(span)
          if (suffix) editor.appendChild(document.createTextNode(suffix))
          setCursorToEnd(editor)
        } else {
          const range = sel.getRangeAt(0)
          range.deleteContents()
          const trailing = suffix ? document.createTextNode(suffix) : null
          const fragment = document.createDocumentFragment()
          fragment.appendChild(span)
          if (trailing) fragment.appendChild(trailing)
          range.insertNode(fragment)

          const cursorTarget = trailing ?? span
          range.setStartAfter(cursorTarget)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }

      this.close()
      this.bumpVersion()
      return true
    })
  }

  /** 选中触发文本（不删除），返回是否成功 */
  private selectTriggerText(triggerChar: string): boolean {
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

  // ════════════════════════════════════════
  //  弹窗定位
  // ════════════════════════════════════════

  private updateCursorPosition(): void {
    const editor = this.element
    if (!editor) return

    const popupMode = this.options.popupMode ?? 'fixed'

    if (popupMode === 'fixed') {
      const editorRect = editor.getBoundingClientRect()
      this.setState({
        popupPosition: {
          top: editorRect.top,
          left: editorRect.left,
          width: editorRect.width,
        },
      })
    } else {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0).cloneRange()
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      this.setState({
        popupPosition: {
          top: rect.top,
          left: rect.left,
        },
      })
    }
  }

  private schedulePopupPositionUpdate(): void {
    if (!this.state.isOpen) return
    if (this.rafId !== null) return
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null
      this.batch(() => this.updateCursorPosition())
    })
  }

  private handleViewportChange = (): void => {
    if (!this.state.isOpen) return
    const behavior = this.options.popupScrollBehavior ?? 'reposition'
    if (behavior === 'ignore') return
    if (behavior === 'close') {
      this.close()
      return
    }
    this.schedulePopupPositionUpdate()
  }

  close = (): void => {
    this.batch(() => {
      this.setState({
        isOpen: false,
        activeTrigger: null,
        query: '',
        filteredItems: [],
        activeIndex: 0,
        loading: false,
        loadingMore: false,
        hasMore: false,
      })
      this.loadedOffset = 0
      // 作废所有在途请求，避免响应回来污染已关闭的列表
      this.asyncVersion++
      if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null }
    })
  }

  // 键盘向下接近末尾时静默预取下一页（不改变循环导航语义）
  private maybePrefetch(): void {
    if (!this.state.hasMore) return
    if (this.state.activeIndex >= this.state.filteredItems.length - PREFETCH_THRESHOLD) {
      this.loadMore()
    }
  }

  // ════════════════════════════════════════
  //  事件处理器（箭头字段：绑定/解构都不丢 this）
  // ════════════════════════════════════════

  private onInput = (): void => {
    this.batch(() => {
      this.bumpVersion()
      this.detectTrigger()
    })
  }

  private onKeydown = (e: KeyboardEvent): void => {
    if (!this.state.isOpen) return

    this.batch(() => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (this.state.filteredItems.length > 0) {
            this.setState({ activeIndex: (this.state.activeIndex + 1) % this.state.filteredItems.length })
            this.maybePrefetch()
          }
          return
        case 'ArrowUp':
          e.preventDefault()
          if (this.state.filteredItems.length > 0) {
            const len = this.state.filteredItems.length
            this.setState({ activeIndex: (this.state.activeIndex - 1 + len) % len })
          }
          return
        case 'Enter':
        case 'Tab':
          if (this.state.filteredItems.length > 0) {
            e.preventDefault()
            this.select(this.state.filteredItems[this.state.activeIndex]!)
          }
          // 列表为空时不 preventDefault，让事件继续冒泡
          return
        case 'Escape':
          e.preventDefault()
          this.close()
          return
      }
    })
  }

  private onBeforeinput = (e: InputEvent): void => {
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
      this.bumpVersion()
    }
  }

  private onCompositionstart = (): void => { this.isComposing = true }
  private onCompositionend = (): void => { this.isComposing = false; this.batch(() => this.detectTrigger()) }

  private onPaste = (e: ClipboardEvent): void => {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text) return
    this.isPasting = true
    document.execCommand('insertText', false, text)
    this.isPasting = false
  }

  private onFocus = (): void => {
    if (this.blurTimer) { clearTimeout(this.blurTimer); this.blurTimer = null }
  }

  private onBlur = (): void => {
    this.blurTimer = setTimeout(() => this.close(), 150)
  }

  readonly handlers: MentionHandlers = {
    input: this.onInput,
    keydown: this.onKeydown,
    beforeinput: this.onBeforeinput,
    compositionstart: this.onCompositionstart,
    compositionend: this.onCompositionend,
    paste: this.onPaste,
    focus: this.onFocus,
    blur: this.onBlur,
  }

  // ════════════════════════════════════════
  //  内容序列化 / 编辑器操作
  // ════════════════════════════════════════

  getParts = (): ContentPart[] => {
    const editor = this.element
    if (!editor) return []
    return parseDOMToParts(editor)
  }

  getDataParts = (): DataPart[] => {
    return contentPartsToDataParts(this.getParts(), this.getTriggers())
  }

  getPlainText = (): string => {
    return getPlainTextFromParts(this.getParts())
  }

  clear = (): void => {
    const editor = this.element
    if (!editor) return
    editor.innerHTML = ''
    this.batch(() => {
      this.bumpVersion()
      this.close()
    })
  }

  setContent = (parts: ContentPart[]): void => {
    const editor = this.element
    if (!editor) return
    restoreContent(editor, parts)
    this.bumpVersion()
  }

  focus = (): void => {
    const editor = this.element
    if (!editor) return
    editor.focus()
    setCursorToEnd(editor)
  }

  private computeIsEmpty(): boolean {
    const editor = this.element
    if (!editor) return true
    const text = editor.textContent ?? ''
    return text.trim().length === 0 && !editor.querySelector('[data-mention-id]')
  }

  private bumpVersion(): void {
    this.setState({ isEmpty: this.computeIsEmpty() })
  }

  // ════════════════════════════════════════
  //  viewport 监听
  // ════════════════════════════════════════

  private syncViewportListeners(): void {
    if (!this.started) return
    const behavior = this.options.popupScrollBehavior ?? 'reposition'
    if (behavior === 'ignore') {
      this.teardownViewportListeners()
      return
    }
    if (!this.listenersAttached) {
      window.addEventListener('scroll', this.handleViewportChange, true)
      window.addEventListener('resize', this.handleViewportChange)
      this.listenersAttached = true
    }
  }

  private teardownViewportListeners(): void {
    if (this.listenersAttached) {
      window.removeEventListener('scroll', this.handleViewportChange, true)
      window.removeEventListener('resize', this.handleViewportChange)
      this.listenersAttached = false
    }
  }
}
