import { useState } from 'react'
import { MentionInput } from './MentionInput'
import type { MentionItem, MentionItemsResult, MentionPageInfo, MentionTrigger, Part } from '@mentionly/react'

// ── 数据源 1：@ 用户（静态数组，立即过滤） ──
const USERS: MentionItem[] = [
  { id: 'u1', label: 'Alice', desc: '前端工程师' },
  { id: 'u2', label: 'Bob', desc: '后端工程师' },
  { id: 'u3', label: 'Carol', desc: '产品经理' },
  { id: 'u4', label: 'David', desc: '设计师' },
  { id: 'u5', label: 'Eve', desc: '数据分析师' },
]

// ── 数据源 2：# 话题（异步 + 分页，模拟远程搜索） ──
const TOPICS: MentionItem[] = Array.from({ length: 23 }, (_, i) => ({
  id: `t${i + 1}`,
  label: `话题 ${String(i + 1).padStart(2, '0')}`,
  desc: ['产品', '设计', '工程', '数据', '运营'][i % 5],
}))

async function searchTopics(query: string, page?: MentionPageInfo): Promise<MentionItemsResult> {
  await new Promise((resolve) => setTimeout(resolve, 350))
  const matched = TOPICS.filter((topic) => topic.label.includes(query))
  const offset = page?.offset ?? 0
  const limit = page?.limit ?? matched.length
  return {
    items: matched.slice(offset, offset + limit),
    hasMore: offset + limit < matched.length,
  }
}

/**
 * triggers 是模块级常量 → 引用永远稳定。
 * 如果写在组件里，请用 useMemo（或在开发模式下会看到提醒），否则每次渲染的新数组
 * 都会让 core 重新 setOptions 并关闭列表。
 */
const TRIGGERS: MentionTrigger[] = [
  {
    char: '@',
    items: USERS,
    // toData 的结果会写进 MentionPart.data，提交时原样带出
    toData: (item) => ({ kind: 'user', uri: `user:${item.id}` }),
  },
  {
    char: '#',
    items: searchTopics,
    pagination: { pageSize: 6 },
    debounce: 200,
    toData: (item) => ({ kind: 'topic', topicId: item.id }),
  },
]

interface Message {
  id: number
  parts: Part[]
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([])

  const handleSubmit = (parts: Part[]) => {
    setMessages((prev) => [...prev, { id: Date.now(), parts }])
  }

  return (
    <div className="app">
      <div className="app-card">
        <header className="app-header">
          <h1>mentionly · React</h1>
          <p>
            输入 <code>@</code> 提及用户（静态列表），输入 <code>#</code> 提及话题（异步 + 分页）。
            方向键选择，Enter 选中，Esc 关闭，列表关闭时 Enter 提交。
          </p>
        </header>

        <div className="app-messages">
          {messages.length === 0 ? (
            <p className="app-empty">还没有提交内容。提交后会在这里看到 getParts() 返回的 Part[]。</p>
          ) : (
            messages.map((message) => (
              <pre key={message.id} className="app-message">{JSON.stringify(message.parts, null, 2)}</pre>
            ))
          )}
        </div>

        <footer className="app-composer">
          <MentionInput triggers={TRIGGERS} onSubmit={handleSubmit} />
        </footer>
      </div>
    </div>
  )
}
