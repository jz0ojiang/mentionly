<script lang="ts">
  import type { MentionItem, MentionTrigger, Part } from '@mentionly/svelte'
  import MentionInput from './MentionInput.svelte'

  const users: MentionItem[] = [
    { id: 'u1', label: 'Alice', description: '产品' },
    { id: 'u2', label: 'Bob', description: '前端' },
    { id: 'u3', label: 'Carol', description: '设计' },
    { id: 'u4', label: 'Dave', description: '后端' },
    { id: 'u5', label: 'Erin', description: '数据' },
  ]

  // 20 条话题，配合 pageSize: 4 演示异步 + 分页（滚动到底部加载更多）
  const topics: MentionItem[] = [
    'release-notes',
    'roadmap',
    'bug-bash',
    'design-review',
    'onboarding',
    'performance',
    'accessibility',
    'i18n',
    'testing',
    'documentation',
    'refactor',
    'security',
    'billing',
    'analytics',
    'search',
    'notifications',
    'mobile',
    'infra',
    'observability',
    'changelog',
  ].map((label, index) => ({ id: `t${index + 1}`, label, description: `#${index + 1}` }))

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // 放在模块作用域，引用稳定；变更时经由 setOptions 同步给 core
  const triggers: MentionTrigger[] = [
    {
      char: '@',
      items: users,
      toData: (item) => ({ kind: 'user', userId: item.id, name: item.label }),
    },
    {
      char: '#',
      debounce: 150,
      pagination: { pageSize: 4 },
      toData: (item) => ({ kind: 'topic', slug: item.id, title: item.label }),
      items: async (query, page) => {
        await delay(400)
        const q = query.toLowerCase()
        const matched = topics.filter((topic) => topic.label.toLowerCase().includes(q))
        const offset = page?.offset ?? 0
        const limit = page?.limit ?? matched.length
        return {
          items: matched.slice(offset, offset + limit),
          hasMore: offset + limit < matched.length,
        }
      },
    },
  ]

  let submitted = $state<Part[][]>([])

  function handleSubmit(parts: Part[]) {
    submitted = [parts, ...submitted].slice(0, 5)
  }
</script>

<main>
  <header>
    <h1>@mentionly/svelte</h1>
    <p>
      Svelte 5 headless mention input。输入 <kbd>@</kbd> 提及用户（静态数据），输入
      <kbd>#</kbd> 引用话题（异步 + 分页）。<kbd>↑</kbd><kbd>↓</kbd> 导航，<kbd>Enter</kbd>
      选中，<kbd>Esc</kbd> 关闭，列表关闭时 <kbd>Enter</kbd> 提交。
    </p>
  </header>

  <MentionInput {triggers} onsubmit={handleSubmit} />

  <section class="output">
    <h2>提交结果 <code>Part[]</code></h2>
    {#if submitted.length === 0}
      <p class="empty">还没有提交任何内容。</p>
    {:else}
      {#each submitted as parts, index (index)}
        <pre>{JSON.stringify(parts, null, 2)}</pre>
      {/each}
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 20px 80px;
  }

  header h1 {
    margin: 0 0 8px;
    font-size: 22px;
    letter-spacing: -0.01em;
  }

  header p {
    margin: 0 0 24px;
    color: var(--muted, #6b7385);
    font-size: 14px;
    line-height: 1.7;
  }

  kbd {
    padding: 1px 5px;
    border: 1px solid var(--border, #d8dee9);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: var(--surface, #fff);
    font-family: inherit;
    font-size: 12px;
  }

  .output {
    margin-top: 36px;
  }

  .output h2 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted, #6b7385);
  }

  .output h2 code {
    font-size: 12px;
  }

  .empty {
    color: var(--muted, #9aa3b2);
    font-size: 13px;
  }

  pre {
    margin: 0 0 12px;
    padding: 14px 16px;
    overflow-x: auto;
    border: 1px solid var(--border, #e6e9f0);
    border-radius: 10px;
    background: #f7f9fc;
    font-size: 12.5px;
    line-height: 1.6;
    color: #2b3245;
    animation: fade 0.2s ease-out;
  }

  @keyframes fade {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
</style>
