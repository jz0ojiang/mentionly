<script lang="ts">
  /*
   * 一个「可直接复制到自己项目」的完整 mention 输入框（Svelte 5 runes）。
   *
   * 复制方式：把 MentionInput.svelte + MentionInput.css 拷到你的项目
   * （依赖只有 @mentionly/svelte、svelte 本身和这份 CSS）。
   *
   * 三条要点（都来自 @mentionly/core）：
   * 1. 编辑器是空的 contenteditable 元素，用 `use:mention.mention` 交给 core。
   *    ⚠ 不要往这个元素里渲染 Svelte 子节点 —— 内部 DOM（mention span、光标等）由 core 直接管理。
   * 2. 候选列表的 id 必须用 `mention.ids.listbox` / `mention.ids.option(i)`：core 会自动在编辑器上
   *    设置 aria-controls / aria-activedescendant 指向它们，读屏软件才能正确朗读。
   * 3. ↑ ↓ Enter Tab Esc 的键盘导航全部由 core 处理（core 自己绑了 handlers），本组件只补
   *    「列表关闭时 Enter 提交」和自定义操作区。
   *
   * 外观沿用 @mentionly/vue 的类名与样式（MentionInput.css），方便和 Vue 版逐像素对照。
   */
  import { untrack } from 'svelte'
  import type { Snippet } from 'svelte'
  import {
    createMention,
    type InsertMentionOptions,
    type InsertMentionPayload,
    type MentionCoreIds,
    type MentionItem,
    type MentionTrigger,
    type Part,
    type PopupMode,
    type PopupScrollBehavior,
  } from '@mentionly/svelte'
  import './MentionInput.css'

  /** `innerActions` / `actions` 两个 snippet 的作用域参数 */
  interface ActionSlotProps {
    submit: () => void
    clear: () => void
    isEmpty: boolean
  }

  interface MentionInputProps {
    /**
     * 触发器配置。页面里请用稳定引用（模块级常量或 `$derived`）：引用变化会关闭当前列表，
     * 用来实现「换语言 / 换数据源后列表重新加载」。
     */
    triggers: MentionTrigger[]
    placeholder?: string
    disabled?: boolean
    /** 编辑器最大高度，超出滚动 */
    maxHeight?: string
    /** 列表关闭时 Enter 提交（Shift+Enter 换行）。列表打开时 Enter 始终用于选中候选项 */
    submitOnEnter?: boolean
    /** Enter 提交前的钩子；`event.preventDefault()` 可阻止提交与换行（Svelte 5 的事件类 prop 用小写命名，与 `onsubmit` 一致） */
    onenter?: (event: KeyboardEvent) => void
    popupMode?: PopupMode
    popupScrollBehavior?: PopupScrollBehavior
    /** 提交回调（列表关闭时按 Enter / 调用 snippet 里的 submit） */
    onsubmit?: (parts: Part[]) => void
    /** 内容变化回调 */
    onchange?: (parts: Part[]) => void

    // ── snippet props，作用域与 Vue 版同名 slot 一致（见 packages/vue/src/MentionInput.vue）──
    /** 整个候选列表都自己渲染（需要自己处理 ids / 分页 / 无障碍） */
    list?: Snippet<
      [
        {
          items: MentionItem[]
          activeIndex: number
          select: (item: MentionItem) => void
          loading: boolean
          hasMore: boolean
          loadingMore: boolean
          loadMore: () => void
          ids: MentionCoreIds
        },
      ]
    >
    /** 单个候选项的内容（外层 div 的 class / role / mousedown 仍由本组件负责） */
    item?: Snippet<[{ item: MentionItem; active: boolean; select: () => void }]>
    empty?: Snippet<[{ query: string }]>
    error?: Snippet<[{ error: unknown }]>
    loading?: Snippet
    loadingMore?: Snippet
    /** 编辑器内部右下角的操作区（如发送按钮） */
    innerActions?: Snippet<[ActionSlotProps]>
    /** 编辑器下方的操作栏 */
    actions?: Snippet<[ActionSlotProps]>
    /** 兜底内容，渲染在最下方；参数与 Vue 版默认 slot 一致 */
    children?: Snippet<
      [ActionSlotProps & { focus: () => void; getParts: () => Part[] }]
    >
  }

  let {
    triggers,
    placeholder = '',
    disabled = false,
    maxHeight = '200px',
    submitOnEnter = true,
    onenter,
    popupMode = 'fixed',
    popupScrollBehavior = 'reposition',
    onsubmit,
    onchange,
    list,
    item,
    empty,
    error,
    loading,
    loadingMore,
    innerActions,
    actions,
    children,
  }: MentionInputProps = $props()

  // options 只在初始化时读取一次，后续变化经由 setOptions 同步（triggers 引用变化会关闭列表）
  const mention = untrack(() => createMention({ triggers, popupMode, popupScrollBehavior }))

  $effect(() => {
    mention.setOptions({ triggers, popupMode, popupScrollBehavior })
  })

  let listEl = $state<HTMLElement>()

  // ── 提交 / 内容变化 ──
  function submit() {
    // core 的 isEmpty 把「只有 mention、没有文字」也算作非空
    if (mention.state.isEmpty) return
    const parts = mention.getParts()
    onsubmit?.(parts)
    mention.clear()
  }

  function handleInput() {
    onchange?.(mention.getParts())
  }

  function handleKeydown(event: KeyboardEvent) {
    // 输入法组词中：交给 IME 处理，不提交、不 preventDefault
    if (event.isComposing || event.keyCode === 229) return
    // 列表打开时导航 / 选中 / 关闭全部归 core（它会 preventDefault），这里不插手
    if (mention.state.isOpen) return
    if (event.defaultPrevented) return
    if (event.key !== 'Enter' || event.shiftKey) return

    onenter?.(event)
    if (event.defaultPrevented) return
    if (!submitOnEnter) return

    event.preventDefault()
    submit()
  }

  function selectItem(mentionItem: MentionItem) {
    mention.select(mentionItem)
  }

  // ── 分页：滚动接近底部加载下一页 ──
  const NEAR_BOTTOM_PX = 24
  let rafPending = false

  function requestLoadMore() {
    if (mention.state.hasMore && !mention.state.loadingMore) mention.loadMore()
  }

  function handleListScroll() {
    if (rafPending) return
    rafPending = true
    requestAnimationFrame(() => {
      rafPending = false
      const el = listEl
      if (!el) return
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX) requestLoadMore()
    })
  }

  // 首屏 / 追加后如果内容撑不满容器（没有滚动条，scroll 事件永远不触发），主动补下一页
  $effect(() => {
    const { isOpen, hasMore, loading, loadingMore, filteredItems } = mention.state
    if (!listEl || !isOpen || !hasMore || loading || loadingMore) return
    if (filteredItems.length === 0) return
    if (listEl.scrollHeight <= listEl.clientHeight + 1) mention.loadMore()
  })

  // 高亮项滚动到可视区
  $effect(() => {
    void mention.state.activeIndex
    if (!listEl) return
    listEl.querySelector<HTMLElement>('.mentionly-list-item--active')?.scrollIntoView({ block: 'nearest' })
  })

  // ── 弹窗定位：fixed 模式贴编辑器宽度，cursor 模式跟随光标（位置由 core 算好）──
  const dropdownStyle = $derived.by(() => {
    const pos = mention.state.popupPosition
    const base = `position: fixed; top: ${pos.top}px; left: ${pos.left}px; transform: translateY(-100%); margin-top: -4px; z-index: 9999;`
    if (popupMode === 'cursor') {
      return `${base} width: max-content; min-width: 200px; max-width: 320px;`
    }
    return `${base} width: ${pos.width ?? 0}px;`
  })

  // ── 命令式 API（父组件 `bind:this={ref}` 后调用）──
  export function insertMention(payload: InsertMentionPayload, options?: InsertMentionOptions) {
    return mention.insertMention(payload, options)
  }

  export function setContent(parts: Part[]) {
    mention.setContent(parts)
  }

  export function getParts(): Part[] {
    return mention.getParts()
  }

  export function clear() {
    mention.clear()
  }

  export function focus() {
    mention.focus()
  }
</script>

<div class="mentionly-wrapper {disabled ? 'mentionly-wrapper--disabled' : ''}">
  <div class="mentionly-editor-area">
    <!-- core 会在编辑器元素上设置 role="combobox" 与 aria-controls/aria-activedescendant -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="mentionly-editor"
      contenteditable={disabled ? 'false' : 'true'}
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      style="max-height: {maxHeight}"
      use:mention.mention
      oninput={handleInput}
      onkeydown={handleKeydown}
    ></div>

    {#if innerActions}
      {@render innerActions({ submit, clear, isEmpty: mention.state.isEmpty })}
    {/if}
  </div>

  {#if mention.state.error !== null}
    <div class="mentionly-error" role="alert">
      {#if error}
        {@render error({ error: mention.state.error })}
      {:else}
        Failed to load suggestions.
      {/if}
    </div>
  {/if}

  {#if mention.state.isOpen}
    <div class="mentionly-dropdown" style={dropdownStyle}>
      {#if list}
        {@render list({
          items: mention.state.filteredItems,
          activeIndex: mention.state.activeIndex,
          select: selectItem,
          loading: mention.state.loading,
          hasMore: mention.state.hasMore,
          loadingMore: mention.state.loadingMore,
          loadMore: mention.loadMore,
          ids: mention.ids,
        })}
      {:else}
        <div
          bind:this={listEl}
          id={mention.ids.listbox}
          class="mentionly-list"
          role="listbox"
          aria-busy={mention.state.loading || mention.state.loadingMore}
          onscroll={handleListScroll}
        >
          {#if mention.state.loading}
            {#if loading}
              {@render loading()}
            {:else}
              <div class="mentionly-list-loading">Loading...</div>
            {/if}
          {:else if mention.state.filteredItems.length > 0}
            {#each mention.state.filteredItems as mentionItem, index (mentionItem.id)}
              <!-- 选项由编辑器上的 combobox + aria-activedescendant 驱动，自身不要 tabindex -->
              <!-- svelte-ignore a11y_interactive_supports_focus -->
              <div
                id={mention.ids.option(index)}
                class="mentionly-list-item {index === mention.state.activeIndex
                  ? 'mentionly-list-item--active'
                  : ''}"
                role="option"
                aria-selected={index === mention.state.activeIndex}
                onmousedown={(event) => {
                  event.preventDefault()
                  selectItem(mentionItem)
                }}
              >
                {#if item}
                  {@render item({
                    item: mentionItem,
                    active: index === mention.state.activeIndex,
                    select: () => selectItem(mentionItem),
                  })}
                {:else}
                  <span class="mentionly-list-item-label">{mentionItem.label}</span>
                  {#if mentionItem.desc}
                    <span class="mentionly-list-item-desc">{mentionItem.desc}</span>
                  {/if}
                {/if}
              </div>
            {/each}
            {#if mention.state.loadingMore}
              {#if loadingMore}
                {@render loadingMore()}
              {:else}
                <div class="mentionly-list-more" role="status" aria-live="polite">Loading more...</div>
              {/if}
            {/if}
          {:else}
            {#if empty}
              {@render empty({ query: mention.state.query })}
            {:else}
              <div class="mentionly-list-empty">No results</div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if actions}
    {@render actions({ submit, clear, isEmpty: mention.state.isEmpty })}
  {/if}

  {#if children}
    {@render children({ submit, clear, isEmpty: mention.state.isEmpty, focus, getParts })}
  {/if}
</div>
