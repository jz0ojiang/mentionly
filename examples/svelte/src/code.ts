/*
 * Svelte playground 自己的代码片段（Svelte 5 语法 + 各自的本地化文案）。
 * 不属于共享层：共享层只放与框架无关的界面文案与数据，各框架的示例代码由各自应用维护。
 * 与 playground/code.ts（Vue 版）key 一一对应，只是少了只有 Vue 页有的 deprecatedCode。
 */
import type { Locale } from '@playground/shared/i18n'

/** 各分区展示的示例代码（与 UiStrings 合并后即为 Svelte 页的文案对象） */
export interface CodeStrings {
  basicCode: string
  advancedCode: string
  avatarCode: string
  insertCode: string
  customTriggerCode: string
  paginationCode: string
}

export const code: Record<Locale, CodeStrings> = {
  en: {
    basicCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger, Part } from '@mentionly/svelte'

  const triggers: MentionTrigger[] = [
    {
      char: '@',
      items: [
        { id: 'p1', label: 'Project Alpha' },
        { id: 'p2', label: 'Project Beta' }
      ],
      toData: (item) => ({ dataType: 'mentioned_ref', projectId: item.id })
    }
  ]

  function handleSubmit(parts: Part[]) {
    console.log(parts)
  }
<\/script>

<MentionInput {triggers} onsubmit={handleSubmit} />`,
    advancedCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger, Part } from '@mentionly/svelte'

  const triggers: MentionTrigger[] = [...]

  let isStreaming = $state(false)

  function handleEnter(event: KeyboardEvent) {
    if (isStreaming) event.preventDefault()
  }

  function handleSubmit(parts: Part[]) {
    console.log(parts)
  }
<\/script>

<MentionInput
  {triggers}
  onenter={handleEnter}
  onsubmit={handleSubmit}
>
  {#snippet innerActions({ submit, isEmpty })}
    <button disabled={isEmpty} onclick={submit}>Send</button>
  {/snippet}
</MentionInput>`,
    avatarCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
<\/script>

<MentionInput {triggers}>
  {#snippet item({ item, active, select })}
    <div class="mention-item" class:active onclick={select}>
      <span class="avatar">{item.label[0]}</span>
      <span>{item.label}</span>
    </div>
  {/snippet}
</MentionInput>`,
    insertCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger } from '@mentionly/svelte'

  const triggers: MentionTrigger[] = [...]

  let inputRef: MentionInput | undefined = $state()
  let count = $state(0)

  function insertContext() {
    count += 1
    inputRef?.insertMention({
      id: \`ctx-\${count}\`,
      label: \`Context #\${count}\`,
      data: {
        dataType: 'context_ref',
        contextId: \`ctx-\${count}\`,
        source: 'selection',
        content: 'Long selection text from editor...'
      }
    })
  }
<\/script>

<MentionInput bind:this={inputRef} {triggers} />
<button onclick={insertContext}>Insert context node</button>`,
    customTriggerCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger } from '@mentionly/svelte'

  const variableTriggers: MentionTrigger[] = [
    {
      char: '$',
      items: [
        { id: 'var-1', label: 'workspace.path' },
        { id: 'var-2', label: 'workspace.branch' }
      ],
      toData: (item) => ({
        dataType: 'variable_ref',
        variableId: item.id,
        key: item.label
      })
    }
  ]
<\/script>

<MentionInput triggers={variableTriggers} placeholder="Type $ to insert variables" />`,
    paginationCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger } from '@mentionly/svelte'

  // A remote source with many results
  const triggers: MentionTrigger[] = [
    {
      char: '@',
      pagination: { pageSize: 15 },
      items: async (query, page) => {
        const res = await fetch(
          \`/api/users?q=\${query}&offset=\${page?.offset ?? 0}&limit=\${page?.limit ?? 15}\`
        )
        // Return a bare array (hasMore inferred from length >= limit)...
        return res.json()
        // ...or be explicit: { items, hasMore }
      }
    }
  ]
<\/script>

<MentionInput {triggers} placeholder="Type @ to search users" />`,
  },
  zh: {
    basicCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger, Part } from '@mentionly/svelte'

  const triggers: MentionTrigger[] = [
    {
      char: '@',
      items: [
        { id: 'p1', label: 'Project Alpha' },
        { id: 'p2', label: 'Project Beta' }
      ],
      toData: (item) => ({ dataType: 'mentioned_ref', projectId: item.id })
    }
  ]

  function handleSubmit(parts: Part[]) {
    console.log(parts)
  }
<\/script>

<MentionInput {triggers} onsubmit={handleSubmit} />`,
    advancedCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger, Part } from '@mentionly/svelte'

  const triggers: MentionTrigger[] = [...]

  let isStreaming = $state(false)

  function handleEnter(event: KeyboardEvent) {
    if (isStreaming) event.preventDefault()
  }

  function handleSubmit(parts: Part[]) {
    console.log(parts)
  }
<\/script>

<MentionInput
  {triggers}
  onenter={handleEnter}
  onsubmit={handleSubmit}
>
  {#snippet innerActions({ submit, isEmpty })}
    <button disabled={isEmpty} onclick={submit}>发送</button>
  {/snippet}
</MentionInput>`,
    avatarCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
<\/script>

<MentionInput {triggers}>
  {#snippet item({ item, active, select })}
    <div class="mention-item" class:active onclick={select}>
      <span class="avatar">{item.label[0]}</span>
      <span>{item.label}</span>
    </div>
  {/snippet}
</MentionInput>`,
    insertCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger } from '@mentionly/svelte'

  const triggers: MentionTrigger[] = [...]

  let inputRef: MentionInput | undefined = $state()
  let count = $state(0)

  function insertContext() {
    count += 1
    inputRef?.insertMention({
      id: \`ctx-\${count}\`,
      label: \`上下文 #\${count}\`,
      data: {
        dataType: 'context_ref',
        contextId: \`ctx-\${count}\`,
        source: 'selection',
        content: '来自编辑器的长文本选区...'
      }
    })
  }
<\/script>

<MentionInput bind:this={inputRef} {triggers} />
<button onclick={insertContext}>插入上下文节点</button>`,
    customTriggerCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger } from '@mentionly/svelte'

  const variableTriggers: MentionTrigger[] = [
    {
      char: '$',
      items: [
        { id: 'var-1', label: 'workspace.path' },
        { id: 'var-2', label: 'workspace.branch' }
      ],
      toData: (item) => ({
        dataType: 'variable_ref',
        variableId: item.id,
        key: item.label
      })
    }
  ]
<\/script>

<MentionInput triggers={variableTriggers} placeholder="输入 $ 引用变量" />`,
    paginationCode: `<script lang="ts">
  import MentionInput from './MentionInput.svelte'
  import type { MentionTrigger } from '@mentionly/svelte'

  // 一个有大量结果的远程数据源
  const triggers: MentionTrigger[] = [
    {
      char: '@',
      pagination: { pageSize: 15 },
      items: async (query, page) => {
        const res = await fetch(
          \`/api/users?q=\${query}&offset=\${page?.offset ?? 0}&limit=\${page?.limit ?? 15}\`
        )
        // 返回裸数组（hasMore 按 length >= limit 推断）...
        return res.json()
        // ...或显式返回：{ items, hasMore }
      }
    }
  ]
<\/script>

<MentionInput {triggers} placeholder="输入 @ 搜索用户" />`,
  },
}
