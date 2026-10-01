/*
 * React playground 自己的代码片段（React 语法 + 各自的本地化文案）。
 * 不属于共享层：共享层只放与框架无关的界面文案与数据，各框架的示例代码由各自应用维护。
 * key 与 Vue playground/code.ts 一一对应（只少了 Vue 独有的 deprecatedCode）。
 */
import type { Locale } from '@playground/shared/i18n'

/** 各分区展示的示例代码（与 UiStrings 合并后即为 React 页的文案对象） */
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
    basicCode: `import { MentionInput } from './MentionInput'

const triggers = [
  {
    char: '@',
    items: users,
    toData: (item) => ({ kind: 'user', uri: \`user:\${item.id}\` }),
  },
]

export function App() {
  const onSubmit = (parts) => {
    console.log(parts)
  }

  return <MentionInput triggers={triggers} onSubmit={onSubmit} />
}`,
    advancedCode: `import { useState } from 'react'
import { MentionInput } from './MentionInput'

export function App() {
  const [isStreaming, setIsStreaming] = useState(false)

  // Call e.preventDefault() to block Enter from submitting
  const onEnter = (e) => {
    if (isStreaming) e.preventDefault()
  }

  return (
    <MentionInput
      triggers={triggers}
      onEnter={onEnter}
      renderInnerActions={({ submit, isEmpty }) => (
        <button disabled={isEmpty} onClick={submit}>Send</button>
      )}
    />
  )
}`,
    avatarCode: `<MentionInput
  triggers={triggers}
  renderItem={({ item, active, select }) => (
    <div className={\`mention-item\${active ? ' active' : ''}\`} onClick={select}>
      <span className="avatar">{item.label[0]}</span>
      <span>{item.label}</span>
    </div>
  )}
/>`,
    insertCode: `import { useRef } from 'react'
import { MentionInput, type MentionInputHandle } from './MentionInput'

export function App() {
  const inputRef = useRef<MentionInputHandle>(null)
  const count = useRef(0)

  function insertContext() {
    count.current += 1
    const i = count.current
    inputRef.current?.insertMention({
      id: \`ctx-\${i}\`,
      label: \`Context #\${i}\`,
      data: {
        dataType: 'context_ref',
        contextId: \`ctx-\${i}\`,
        source: 'selection',
        content: 'Long selection text from editor...',
      },
    })
  }

  return (
    <>
      <MentionInput ref={inputRef} triggers={triggers} />
      <button onClick={insertContext}>Insert context node</button>
    </>
  )
}`,
    customTriggerCode: `const variableTriggers = [
  {
    char: '$',
    items: [
      { id: 'var-1', label: 'workspace.path' },
      { id: 'var-2', label: 'workspace.branch' },
    ],
    toData: (item) => ({
      dataType: 'variable_ref',
      variableId: item.id,
      key: item.label,
    }),
  },
]

<MentionInput triggers={variableTriggers} placeholder="Type $ to insert variables" />`,
    paginationCode: `// A remote source with many results
const triggers = [
  {
    char: '@',
    pagination: { pageSize: 15 },
    items: async (query, page) => {
      const res = await fetch(
        \`/api/users?q=\${query}&offset=\${page.offset}&limit=\${page.limit}\`
      )
      // Return a bare array (hasMore inferred from length >= limit)...
      return res.json()
      // ...or be explicit: { items, hasMore }
    },
  },
]

<MentionInput triggers={triggers} placeholder="Type @ to search users" />`,
  },
  zh: {
    basicCode: `import { MentionInput } from './MentionInput'

const triggers = [
  {
    char: '@',
    items: users,
    toData: (item) => ({ kind: 'user', uri: \`user:\${item.id}\` }),
  },
]

export function App() {
  const onSubmit = (parts) => {
    // 提交后拿到 Part[]，直接发给后端
    console.log(parts)
  }

  return <MentionInput triggers={triggers} onSubmit={onSubmit} />
}`,
    advancedCode: `import { useState } from 'react'
import { MentionInput } from './MentionInput'

export function App() {
  const [isStreaming, setIsStreaming] = useState(false)

  // 调用 e.preventDefault() 阻止 Enter 提交
  const onEnter = (e) => {
    if (isStreaming) e.preventDefault()
  }

  return (
    <MentionInput
      triggers={triggers}
      onEnter={onEnter}
      renderInnerActions={({ submit, isEmpty }) => (
        <button disabled={isEmpty} onClick={submit}>发送</button>
      )}
    />
  )
}`,
    avatarCode: `<MentionInput
  triggers={triggers}
  renderItem={({ item, active, select }) => (
    <div className={\`mention-item\${active ? ' active' : ''}\`} onClick={select}>
      <span className="avatar">{item.label[0]}</span>
      <span>{item.label}</span>
    </div>
  )}
/>`,
    insertCode: `import { useRef } from 'react'
import { MentionInput, type MentionInputHandle } from './MentionInput'

export function App() {
  const inputRef = useRef<MentionInputHandle>(null)
  const count = useRef(0)

  function insertContext() {
    count.current += 1
    const i = count.current
    inputRef.current?.insertMention({
      id: \`ctx-\${i}\`,
      label: \`上下文 #\${i}\`,
      data: {
        dataType: 'context_ref',
        contextId: \`ctx-\${i}\`,
        source: 'selection',
        content: '来自编辑器的长文本选区...',
      },
    })
  }

  return (
    <>
      <MentionInput ref={inputRef} triggers={triggers} />
      <button onClick={insertContext}>插入上下文节点</button>
    </>
  )
}`,
    customTriggerCode: `const variableTriggers = [
  {
    char: '$',
    items: [
      { id: 'var-1', label: 'workspace.path' },
      { id: 'var-2', label: 'workspace.branch' },
    ],
    toData: (item) => ({
      dataType: 'variable_ref',
      variableId: item.id,
      key: item.label,
    }),
  },
]

<MentionInput triggers={variableTriggers} placeholder="输入 $ 引用变量" />`,
    paginationCode: `// 一个有大量结果的远程数据源
const triggers = [
  {
    char: '@',
    pagination: { pageSize: 15 },
    items: async (query, page) => {
      const res = await fetch(
        \`/api/users?q=\${query}&offset=\${page.offset}&limit=\${page.limit}\`
      )
      // 返回裸数组（hasMore 按 length >= limit 推断）...
      return res.json()
      // ...或显式返回：{ items, hasMore }
    },
  },
]

<MentionInput triggers={triggers} placeholder="输入 @ 搜索用户" />`,
  },
}
