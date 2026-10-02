<script lang="ts">
  import { untrack } from 'svelte'
  import type { MentionCoreOptions, MentionItem } from '@mentionly/core'
  import { createMention, type CreateMentionReturn } from '../src/index.js'

  let {
    options,
    oncreate,
    onselect,
  }: {
    options: MentionCoreOptions
    oncreate?: (api: CreateMentionReturn) => void
    onselect?: (item: MentionItem) => void
  } = $props()

  // 测试夹具：options 只在初始化时读取一次
  const mention = untrack(() => createMention(options))
  untrack(() => oncreate?.(mention))
</script>

<div
  class="editor"
  contenteditable="true"
  data-testid="editor"
  use:mention.mention
></div>

{#if mention.state.isOpen}
  <ul id={mention.ids.listbox} role="listbox" data-testid="listbox">
    {#each mention.state.filteredItems as item, i (item.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
      <li
        id={mention.ids.option(i)}
        role="option"
        aria-selected={i === mention.state.activeIndex}
        onclick={() => {
          mention.select(item)
          onselect?.(item)
        }}
      >
        {item.label}
      </li>
    {/each}
  </ul>
{/if}
