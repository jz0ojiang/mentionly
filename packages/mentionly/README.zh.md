# mentionly

[![tests](https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml/badge.svg)](https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/mentionly?color=3b82f6&label=npm&logo=npm)](https://www.npmjs.com/package/mentionly)
[![downloads](https://img.shields.io/npm/dm/mentionly?color=10b981&label=downloads&logo=npm)](https://www.npmjs.com/package/mentionly)

面向 AI 聊天场景的 mention 输入：一个框架无关的 `contenteditable` 引擎
（`@mentionly/core`），加上开箱即用的 Vue 3 组件与 React / Svelte 的 headless 适配层。

原子 mention 实体、异步与分页数据源、输入法（IME）处理与序列化 —— core 零运行时依赖。

[在线演示](https://im0o.top/mentionly?lang=zh) | [English](https://github.com/jz0ojiang/mentionly/blob/main/README.md) | [1.x 迁移指南](https://github.com/jz0ojiang/mentionly/blob/main/MIGRATION.md)

## 包一览

| 包 | 是什么 | 安装 | peer 依赖 |
|----|--------|------|-----------|
| [`@mentionly/core`](https://github.com/jz0ojiang/mentionly/tree/main/packages/core) | 框架无关引擎：触发检测、异步/分页数据源、DOM 序列化、键盘与 IME 处理。同时提供 `./ai-sdk` 与 `./mcp` 转换子路径。 | `npm install @mentionly/core` | 无 |
| [`@mentionly/vue`](https://github.com/jz0ojiang/mentionly/tree/main/packages/vue) | 薄 Vue 3 适配层：`useMention` composable，以及开箱即用的 `MentionInput` / `MentionList` 组件。 | `npm install @mentionly/vue` | `vue` `^3.3.0` |
| [`@mentionly/react`](https://github.com/jz0ojiang/mentionly/tree/main/packages/react) | React headless hook（`useMention`），基于 `useSyncExternalStore`。不发布组件。 | `npm install @mentionly/react` | `react` `>=18` |
| [`@mentionly/svelte`](https://github.com/jz0ojiang/mentionly/tree/main/packages/svelte) | Svelte 5 headless 适配层：`createMention()` 与 `use:mention` action。不发布组件。 | `npm install @mentionly/svelte` | `svelte` `^5.0.0` |
| [`mentionly`](https://github.com/jz0ojiang/mentionly/tree/main/packages/mentionly) | 转发包：重新导出 `@mentionly/vue`，并附带 `mentionly/style.css`。1.x 用户可无缝升级。 | `npm install mentionly` | `vue` `^3.3.0` |

5 个包统一版本发布。

## 快速开始（Vue）

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { MentionInput } from 'mentionly'
import type { MentionTrigger, Part } from 'mentionly'
import 'mentionly/style.css'

const inputRef = ref<InstanceType<typeof MentionInput>>()

const triggers: MentionTrigger[] = [
  {
    char: '@',
    items: [
      { id: 'u1', label: 'Alice' },
      { id: 'u2', label: 'Bob' },
    ],
    // toData() 在选中时执行一次，结果会持久化到 mention 上
    toData: (item) => ({ kind: 'user', userId: item.id }),
  },
]

function onSubmit(parts: Part[]) {
  // [
  //   { type: 'text', text: '请检查 ' },
  //   { type: 'mention', trigger: '@', id: 'u1', label: 'Alice',
  //     data: { kind: 'user', userId: 'u1' } },
  // ]
  api.sendMessage(parts)
}
</script>

<template>
  <MentionInput
    ref="inputRef"
    :triggers="triggers"
    placeholder="输入消息... 试试 @"
    @submit="onSubmit"
  />
</template>
```

`@mentionly/vue` 的 API 完全一致 —— 把导入换成 `import { MentionInput } from '@mentionly/vue'`
和 `import '@mentionly/vue/style.css'` 即可。

### Headless 模式（Vue）

`useMention()` 给你引擎与 DOM 事件处理器，编辑器与下拉列表由你自己渲染。

```vue
<script setup lang="ts">
import { useMention } from 'mentionly'

const {
  editorRef, isOpen, filteredItems, activeIndex, ids,
  select, handlers, loadMore, getParts, clear, loading,
} = useMention({
  triggers: [
    {
      char: '@',
      items: (query, page) => searchUsers(query, page), // 异步 + 分页
      pagination: { pageSize: 20 },
      debounce: 200,
      toData: (item) => ({ kind: 'user', userId: item.id }),
    },
  ],
})

function send() {
  const parts = getParts()
  api.sendMessage(parts)
  clear()
}
</script>

<template>
  <div class="my-chat-input">
    <!-- 编辑器元素上的 role="combobox" 与 aria-* 由 core 设置 -->
    <div ref="editorRef" contenteditable v-on="handlers" />

    <ul v-if="isOpen" :id="ids.listbox" role="listbox">
      <li
        v-for="(item, index) in filteredItems"
        :id="ids.option(index)"
        :key="item.id"
        role="option"
        :aria-selected="index === activeIndex"
        @mousedown.prevent="select(item)"
      >
        {{ item.label }}
      </li>
    </ul>

    <button @click="send">发送</button>
  </div>
</template>
```

列表根元素与候选项必须使用 `ids.listbox` / `ids.option(index)` —— core 会在编辑器上写
`aria-controls` / `aria-activedescendant` 指向它们。

## 快速开始（React）

```tsx
import { useMemo } from 'react'
import { useMention } from '@mentionly/react'
import type { MentionTrigger } from '@mentionly/react'

const USERS = [
  { id: 'u1', label: 'Alice' },
  { id: 'u2', label: 'Bob' },
]

export function Composer() {
  // ⚠ `triggers` 必须保持稳定引用：模块级常量或 useMemo()。
  // 每次渲染都新建数组会让 hook 调用 setOptions()，从而关闭列表并作废在途请求。
  // 开发模式下连续 3 次渲染引用都在变化时会打印 warning。
  const triggers = useMemo<MentionTrigger[]>(
    () => [{ char: '@', items: USERS, toData: (item) => ({ userId: item.id }) }],
    [],
  )

  const { ref, state, ids, select, getParts, clear } = useMention({ triggers })

  return (
    <>
      {/* 这个元素的内部 DOM 完全由 core 管理：不要往里渲染 React 子节点 */}
      <div ref={ref} contentEditable data-placeholder="Type @ to mention" />

      {state.isOpen && (
        <ul id={ids.listbox} role="listbox">
          {state.filteredItems.map((item, index) => (
            <li
              key={item.id}
              id={ids.option(index)}
              role="option"
              aria-selected={index === state.activeIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
```

`useMention()` 返回：callback `ref`（挂到编辑器上）、core 快照 `state`、无障碍 `ids`，
以及 `select` / `loadMore` / `close` / `getParts` / `getDataParts` / `getPlainText` / `clear` /
`setContent` / `focus` / `insertMention` 和底层 `core`。

一个完整、可直接复制的组件（键盘提交、高亮项滚动入可视区、分页、错误状态）在
[`examples/react/src/MentionInput.tsx`](https://github.com/jz0ojiang/mentionly/blob/main/examples/react/src/MentionInput.tsx)。把这个文件连同
`MentionInput.css` 拷进你的项目，改掉 `mi-*` 类名即可。

## 快速开始（Svelte 5）

```svelte
<script lang="ts">
  import { createMention } from '@mentionly/svelte'

  const USERS = [
    { id: 'u1', label: 'Alice' },
    { id: 'u2', label: 'Bob' },
  ]

  const mention = createMention({
    triggers: [
      { char: '@', items: USERS, toData: (item) => ({ userId: item.id }) },
    ],
  })
</script>

<!-- core 会绑定到这个元素，并在其上设置 role="combobox" 与 aria-* -->
<div contenteditable use:mention.mention></div>

{#if mention.state.isOpen}
  <ul id={mention.ids.listbox} role="listbox">
    {#each mention.state.filteredItems as item, index (item.id)}
      <li
        id={mention.ids.option(index)}
        role="option"
        aria-selected={index === mention.state.activeIndex}
        onmousedown={(e) => e.preventDefault()}
        onclick={() => mention.select(item)}
      >
        {item.label}
      </li>
    {/each}
  </ul>
{/if}
```

`createMention()` 返回 `state`（core 快照的 `$state` 镜像）、`ids`、`mention`（action）、
`core`、`setOptions`，以及与其他适配层一致的方法集合。一个完整、可直接复制的组件在
[`examples/svelte/src/MentionInput.svelte`](https://github.com/jz0ojiang/mentionly/blob/main/examples/svelte/src/MentionInput.svelte)。

## 输出格式

引擎把编辑器 DOM 解析为与框架无关的 `Part[]`：

```ts
import type { Part, TextPart, MentionPart } from '@mentionly/core'

interface TextPart {
  type: 'text'
  text: string
}

interface MentionPart<T = unknown> {
  type: 'mention'
  trigger: string   // '@'、'#'、'/' ...
  id: string
  label: string
  data?: T          // 选中时 trigger.toData(item) 的返回值
}

type Part<T = unknown> = TextPart | MentionPart<T>
```

```ts
core.getParts()      // Part[]
core.getPlainText()  // 'hello @Alice' —— 文本 + 每个 mention 的 trigger + label
```

- **`toData(item)`** 在条目被选中时执行一次，结果直接持久化在 mention 节点上；之后
  `getParts()` 会把它作为 `data` 返回，所以即使原始条目已经不存在，mention 依然可以正确序列化。
- **`getParts()` 会规范化** DOM：合并相邻文本、把默认插入在 mention 后的不换行空格（NBSP）
  转成普通空格，并去掉首尾空白与空文本片段。
- **`setContent(parts)`** 从 `Part[]`（或 1.x 的 `ContentPart[]`，见[迁移指南](https://github.com/jz0ojiang/mentionly/blob/main/MIGRATION.md)）
  还原编辑器，因此 `setContent(getParts())` 可以往返。

## 与 AI / Agent 生态互操作

两个转换器都是 `@mentionly/core` 的子路径导出，且只使用结构类型，因此 core 保持零依赖。

### Vercel AI SDK —— `@mentionly/core/ai-sdk`

```ts
import { toUIMessageParts, fromUIMessageParts } from '@mentionly/core/ai-sdk'

const uiParts = toUIMessageParts(core.getParts())
// [{ type: 'text', text: 'hi ' },
//  { type: 'data-mention', data: { trigger: '@', id: 'u1', label: 'Alice' } }]

const parts = fromUIMessageParts(message.parts) // 只读 text 与 data-*，其余分支跳过
```

- `toUIMessageParts(parts, { dataPartName })` —— data part 名默认 `'mention'`。
- `fromUIMessageParts(uiParts, { dataPartName })` —— 传 `dataPartName` 时只转换该名字的 data
  part；省略时接受任意 `data-*` 且负载包含 `trigger` / `id` / `label` 的 part。
- 两者互为逆运算：`fromUIMessageParts(toUIMessageParts(x))` 与 `x` 深等。

> **服务端注意**：AI SDK 的 `convertToModelMessages` 默认会丢弃 user message 里的 data part，
> 模型看不到 mention。需要显式传 `convertDataPart`，把 mention 转成模型能读的内容
> （返回 `undefined` 表示忽略该 part）：
>
> ```ts
> import { convertToModelMessages, type UIMessage } from 'ai'
> import type { MentionDataPayload } from '@mentionly/core/ai-sdk'
>
> type MyMessage = UIMessage<unknown, { mention: MentionDataPayload }>
>
> const modelMessages = await convertToModelMessages<MyMessage>(messages, {
>   convertDataPart: (part) => {
>     if (part.type === 'data-mention') {
>       return { type: 'text', text: `@${part.data.label}(${part.data.id})` }
>     }
>     return undefined
>   },
> })
> ```

### MCP —— `@mentionly/core/mcp`

```ts
import { toMCPContent } from '@mentionly/core/mcp'

toMCPContent(core.getParts())
// [{ type: 'text', text: 'see ' },
//  { type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' }]
```

- `text` part 变成 `{ type: 'text', text }`；相邻的文本块（包括没有 uri 的 mention 退化成的文本）
  会合并成一个。
- `data` 里有字符串 `uri` 的 mention 变成 `{ type: 'resource_link', uri, name: label }`
  （`name` 取 mention 的 label）。
- 默认从 `part.data?.uri` 取 uri。可用 `getUri(part)` / `getMimeType(part)` 从别处读取；
  没有 uri 的 mention 退化为文本 `trigger + label`。

## 特性

- **多触发字符** —— `@`、`#`、`/` 或任意自定义字符。
- **原子 mention 实体** —— `contenteditable="false"` 的 span，不可分割、可样式化。
- **一个引擎 + 三个适配层** —— 逻辑都在 `@mentionly/core`；Vue 提供组件，React / Svelte 为 headless。
- **异步数据源** —— 防抖、竞态保护与 `error` 状态。
- **后端分页** —— 数据源收到 `{ offset, limit }`，滚动或键盘导航到底时自动加载下一页；
  返回 `{ items, hasMore }` 可显式告知是否还有下一页。
- **命令模式** —— `/斜杠` 命令触发回调而不插入实体。
- **IME 兼容** —— 正确处理中文 / 日文 / 韩文输入法组词。
- **序列化与反序列化** —— `getParts()` / `setContent()` 用于提交与编辑已发消息。
- **Teleport 下拉列表（Vue）** —— 下拉列表默认 teleport 到 `<body>`，避免被 `overflow: hidden` 裁剪。
- **光标跟随弹窗** —— `popupMode="cursor"` 让弹窗跟随光标；`popupScrollBehavior` 控制滚动时的
  行为（`reposition` / `close` / `ignore`）。
- **词边界感知** —— 默认 `allowMidWord: false` 时，触发符紧跟 ASCII 单词字符不会打开列表，
  `a@b.com` 这类邮箱保持原样；空白、中文、标点之后照常触发。
- **core 零运行时依赖** —— `@mentionly/core` 不带任何依赖；适配层只把 Vue / React / Svelte 作为
  peer 依赖。

## 触发器配置

```ts
interface MentionTrigger {
  char: string                    // 触发字符
  mode?: 'inline' | 'command'     // 默认 'inline'
  allowMidWord?: boolean          // 是否允许触发符紧跟 ASCII 单词字符，默认 false
  items: MentionItem[]            // 静态数组
    | ((query: string, page?: { offset: number; limit: number })   // 或函数
        => MentionItemsResult | Promise<MentionItemsResult>)
  pagination?: { pageSize: number }  // 启用后端分页（仅对函数源生效）
  debounce?: number               // 异步防抖毫秒数，默认 0
  toData?: (item: MentionItem) => unknown  // 持久化为 mention 的 `data`
  onSelect?: (item: MentionItem) => void   // 命令模式回调
}

// 函数源可返回裸数组，或带显式 hasMore 的对象：
type MentionItemsResult = MentionItem[] | { items: MentionItem[]; hasMore?: boolean }
```

### 多触发器

```ts
const triggers: MentionTrigger[] = [
  { char: '@', items: users, toData: (item) => ({ kind: 'user', userId: item.id }) },
  { char: '#', items: topics, toData: (item) => ({ kind: 'topic', topicId: item.id }) },
  { char: '/', mode: 'command', items: commands, onSelect: (item) => handleCommand(item) },
]
```

### 异步数据源

```ts
{
  char: '@',
  items: async (query) => {
    const res = await fetch(`/api/search?q=${query}`)
    return res.json()
  },
  debounce: 200,
}
```

### 后端分页（加载更多）

```ts
{
  char: '@',
  pagination: { pageSize: 20 },
  items: async (query, page) => {
    const res = await fetch(`/api/users?q=${query}&offset=${page.offset}&limit=${page.limit}`)
    const users = await res.json()

    // 方式一 —— 返回裸数组；hasMore 按 `length >= limit` 推断
    return users

    // 方式二 —— 显式告知是否还有下一页
    // return { items: users.list, hasMore: users.hasNext }
  },
}
```

- **仅对函数源生效** —— 静态数组维持一次性全量渲染。
- **向后兼容** —— 不配置 `pagination` 时，旧的 `(query) => items` 约定完全不变（不会传入第二个参数）。
- `loading` 对应首屏（替换列表），`loadingMore` 对应后续页（保留列表、底部显示指示器）。
  两者都由所有适配层暴露，也由 Vue 的 `#list` 插槽暴露。

## `MentionInput`（`@mentionly/vue`）

### Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `triggers` | `MentionTrigger[]` | 必填 | 触发器配置 |
| `placeholder` | `string` | `''` | 占位文本 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `maxHeight` | `string` | `'200px'` | 编辑器最大高度 |
| `submitOnEnter` | `boolean` | `true` | 是否 Enter 提交 |
| `onEnter` | `(e: KeyboardEvent) => void` | `-` | Enter 提交前触发；`e.preventDefault()` 可阻止提交/换行 |
| `popupMode` | `'fixed' \| 'cursor'` | `'fixed'` | 弹窗定位模式 |
| `popupScrollBehavior` | `'reposition' \| 'close' \| 'ignore'` | `'reposition'` | 滚动时弹窗行为 |
| `teleport` | `boolean` | `true` | 是否把下拉列表 teleport 到 `<body>` |

### 事件

| 事件 | 载荷 | 说明 |
|------|------|------|
| `submit` | `Part[]` | 按 Enter 时触发 |
| `change` | `Part[]` | 内容变化时触发 |

### 插槽

| 插槽 | Props | 说明 |
|------|-------|------|
| `#list` | `{ items, activeIndex, select, loading, hasMore, loadingMore, loadMore, ids }` | 自定义下拉列表 |
| `#item` | `{ item, active, select }` | 自定义候选项渲染 |
| `#empty` | `{ query }` | 无匹配结果 |
| `#error` | `{ error }` | 数据源错误（替换默认的提示框） |
| `#loading` | `{}` | 加载中（首屏） |
| `#loading-more` | `{}` | 加载下一页时的指示器 |
| `#actions` | `{ submit, clear, isEmpty }` | 自定义操作栏 |
| `#inner-actions` | `{ submit, clear, isEmpty }` | 编辑器内部、输入框下方（如发送按钮） |
| `#default` | `{ submit, clear, isEmpty, focus, getParts }` | 最外层底部，自由放置内容 |

### 暴露方法

通过 template ref 访问：

```ts
const inputRef = ref()

inputRef.value.getParts()        // Part[]
inputRef.value.getDataParts()    // DataPart[]（已废弃，兼容 1.x）
inputRef.value.getPlainText()    // string
inputRef.value.clear()
inputRef.value.setContent(parts) // Part[]（也兼容旧的 ContentPart[]）
inputRef.value.insertMention({
  id: 'ctx-1',
  label: '选中内容',
  data: { kind: 'context', sourceId: 'ctx-1' },
})
inputRef.value.focus()
inputRef.value.ids               // { listbox, option(index) }
```

`insertMention()` 也可以插入未注册到任何 trigger 上的自定义原子节点。

## 无障碍（a11y）

core 会在编辑器元素上设置并维护 combobox 相关属性：

| 属性 | 值 |
|------|-----|
| `role` | `combobox`（除非你自己设置了 `role`） |
| `aria-autocomplete` | `list` |
| `aria-expanded` | 下拉列表打开时为 `true` |
| `aria-controls` | `ids.listbox` |
| `aria-activedescendant` | 打开且有结果时为 `ids.option(activeIndex)` |

下拉列表用 `role="listbox"` + `id={ids.listbox}` 渲染，候选项用 `role="option"` +
`id={ids.option(index)}` + `aria-selected`。Vue 的 `MentionList` 已经做好；React / Svelte
需要你自己接。↑ / ↓ / Enter / Tab / Escape（含 IME 组词）都由 core 处理，不要重复实现。

## 错误状态

异步数据源 reject 时，core 不会抛出，而是暴露出来：

- React / Svelte 的 `state.error`、Vue 的 `error` ref 持有该错误；下次加载成功或
  `close()` 后回到 `null`。
- `MentionInput` 渲染 `#error`（默认是一个 alert 提示框，文案 "Failed to load suggestions."）。
- 首屏失败会清空列表；追加失败会保留已加载项与 `hasMore`，便于重试。

## 从 1.x 迁移

`mentionly` 仍然可用（转发 `@mentionly/vue`），但输出格式与部分 API 有变化。
每一条变更及前后代码对比见 **[MIGRATION.md](https://github.com/jz0ojiang/mentionly/blob/main/MIGRATION.md)**。

## 许可

[MIT](https://github.com/jz0ojiang/mentionly/blob/main/LICENSE)
