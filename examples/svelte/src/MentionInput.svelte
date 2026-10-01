<script lang="ts">
  import { untrack } from 'svelte'
  import {
    createMention,
    type MentionItem,
    type MentionTrigger,
    type Part,
  } from '@mentionly/svelte'

  let {
    triggers,
    placeholder = '输入 @ 提及用户，# 引用话题，Enter 发送',
    onsubmit,
    submitLabel = '发送',
  }: {
    triggers: MentionTrigger[]
    placeholder?: string
    onsubmit?: (parts: Part[]) => void
    submitLabel?: string
  } = $props()

  // options 只在初始化时读取一次（triggers 是稳定引用）
  const mention = untrack(() => createMention({ triggers }))

  // 把 props 变化同步给 core：Svelte 的响应式引用稳定，无需自己比较
  $effect(() => {
    mention.setOptions({ triggers })
  })

  // 高亮项滚动到可视区
  $effect(() => {
    if (!mention.state.isOpen) return
    const option = document.getElementById(mention.ids.option(mention.state.activeIndex))
    option?.scrollIntoView({ block: 'nearest' })
  })

  function handleKeydown(event: KeyboardEvent) {
    // 列表打开时导航 / 选中 / 关闭全部由 core 处理（会 preventDefault）
    if (event.defaultPrevented) return
    if (event.key !== 'Enter' || event.shiftKey) return
    if (mention.state.isOpen) return

    event.preventDefault()
    const parts = mention.getParts()
    if (parts.length === 0) return
    onsubmit?.(parts)
    mention.clear()
  }

  let listEl: HTMLUListElement | undefined = $state()

  function handleScroll(event: Event) {
    const el = event.currentTarget as HTMLElement
    if (!mention.state.hasMore || mention.state.loadingMore) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) mention.loadMore()
  }

  // 第一页撑不满列表时不会出现滚动条，滚动事件永远不会触发，所以内容不足一屏就直接加载下一页
  $effect(() => {
    const { isOpen, hasMore, loading, loadingMore, filteredItems } = mention.state
    if (!listEl || !isOpen || !hasMore || loading || loadingMore || filteredItems.length === 0) return
    if (listEl.scrollHeight <= listEl.clientHeight + 1) mention.loadMore()
  })

  function pick(item: MentionItem) {
    mention.select(item)
  }

  const activeTrigger = $derived(
    triggers.find((trigger) => trigger.char === mention.state.activeTrigger),
  )
</script>

<div class="mention-input">
  <!-- core 会在编辑器元素上设置 role="combobox" 与 aria-controls/aria-activedescendant -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="editor"
    contenteditable="true"
    data-placeholder={placeholder}
    use:mention.mention
    onkeydown={handleKeydown}
  ></div>

  <button
    type="button"
    class="submit"
    disabled={mention.state.isEmpty}
    onclick={() => {
      const parts = mention.getParts()
      if (parts.length === 0) return
      onsubmit?.(parts)
      mention.clear()
    }}
  >
    {submitLabel}
  </button>

  {#if mention.state.isOpen}
    <div class="popup">
      <div class="popup-header">
        <span class="trigger">{activeTrigger?.char ?? '@'}</span>
        <span class="query">{mention.state.query || '全部'}</span>
        {#if mention.state.loading}<span class="spinner">加载中…</span>{/if}
      </div>

      {#if mention.state.error}
        <div class="status error">加载失败：{String(mention.state.error)}</div>
      {:else if !mention.state.loading && mention.state.isEmpty}
        <div class="status">没有匹配项</div>
      {/if}

      <ul
        id={mention.ids.listbox}
        class="list"
        role="listbox"
        bind:this={listEl}
        onscroll={handleScroll}
      >
        {#each mention.state.filteredItems as item, index (item.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
          <li
            id={mention.ids.option(index)}
            class="option"
            class:active={index === mention.state.activeIndex}
            role="option"
            aria-selected={index === mention.state.activeIndex}
            onmousedown={(e) => e.preventDefault()}
            onclick={() => pick(item)}
          >
            {#if item.avatar}
              <img class="avatar" src={item.avatar} alt="" />
            {/if}
            <span class="label">{item.label}</span>
            {#if item.description}
              <span class="description">{item.description}</span>
            {/if}
          </li>
        {/each}
      </ul>

      {#if mention.state.loadingMore}
        <div class="status">加载更多…</div>
      {:else if mention.state.hasMore}
        <div class="status">滚动加载更多</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .mention-input {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--border, #d8dee9);
    border-radius: 12px;
    background: var(--surface, #fff);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .mention-input:focus-within {
    border-color: var(--accent, #4f7cff);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #4f7cff) 18%, transparent);
  }

  .editor {
    flex: 1;
    min-height: 24px;
    max-height: 160px;
    overflow-y: auto;
    padding: 4px 2px;
    outline: none;
    line-height: 1.5;
    font-size: 14px;
    color: var(--text, #1f2430);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .editor:empty::before {
    content: attr(data-placeholder);
    color: var(--muted, #9aa3b2);
    pointer-events: none;
  }

  .submit {
    flex: none;
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    background: var(--accent, #4f7cff);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .submit:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .popup {
    position: absolute;
    z-index: 20;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    max-height: 260px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border, #d8dee9);
    border-radius: 12px;
    background: var(--surface, #fff);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
    animation: pop 0.12s ease-out;
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
  }

  .popup-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border, #eef1f6);
    font-size: 12px;
    color: var(--muted, #9aa3b2);
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent, #4f7cff) 14%, transparent);
    color: var(--accent, #4f7cff);
    font-weight: 600;
  }

  .query {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .list {
    margin: 0;
    padding: 4px;
    list-style: none;
    overflow-y: auto;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--text, #1f2430);
    cursor: pointer;
  }

  .option.active {
    background: color-mix(in srgb, var(--accent, #4f7cff) 12%, transparent);
  }

  .avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    object-fit: cover;
  }

  .label {
    font-weight: 500;
  }

  .description {
    margin-left: auto;
    color: var(--muted, #9aa3b2);
    font-size: 12px;
  }

  .status {
    padding: 10px 12px;
    font-size: 12px;
    color: var(--muted, #9aa3b2);
  }

  .status.error {
    color: #d64545;
  }

  .spinner {
    color: var(--accent, #4f7cff);
  }
</style>
