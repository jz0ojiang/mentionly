# mentionly

轻量级 Vue 3 mention 输入组件，专为 AI 聊天场景设计。零外部依赖（仅 peer depend Vue 3）。

[English](./README.md)

## 特性

- **多触发字符** — `@`、`#`、`/` 或任意自定义字符
- **Headless + 开箱即用** — 核心逻辑在 `useMention` composable 中，同时提供带 UI 的 `MentionInput` 组件
- **原子 mention 实体** — `contenteditable="false"` 的 span，不可分割、不可部分选中
- **可自定义输出结构** — 支持 `dataPart` 转换函数或声明式 `schema` 映射
- **异步数据源** — 支持防抖和竞态保护
- **命令模式** — `/斜杠` 命令触发回调，不插入实体
- **IME 兼容** — 正确处理中文/日文/韩文输入法
- **序列化与反序列化** — `getDataParts()` 用于提交，`setContent()` 用于编辑已发消息
- **光标跟随弹窗** — 可选 `popupMode="cursor"` 让弹窗跟随光标位置
- **零依赖** — 仅需 Vue 3

## 安装

```bash
npm install mentionly
# 或
pnpm add mentionly
# 或
bun add mentionly
```

## 快速开始

### 开箱即用组件

```vue
<script setup>
import { MentionInput } from 'mentionly'
import 'mentionly/style.css'

const triggers = [
  {
    char: '@',
    items: [
      { id: '1', label: 'Project Alpha' },
      { id: '2', label: 'Project Beta' },
    ],
    dataPart: (item) => ({
      type: 'data',
      dataType: 'project_ref',
      projectId: item.id,
      projectName: item.label,
    }),
  },
]
function onSubmit(dataParts) {
  console.log(dataParts)
  // [
  //   { type: 'text', text: '检查 ' },
  //   { type: 'data', dataType: 'project_ref', projectId: '1', projectName: 'Project Alpha' },
  //   { type: 'text', text: ' 的状态' },
  // ]
}
</script>

<template>
  <MentionInput
    :triggers="triggers"
    placeholder="输入消息... 试试 @"
    @submit="onSubmit"
  />
</template>
```

### Headless 模式

```vue
<script setup>
import { useMention } from 'mentionly'

const {
  editorRef, isOpen, filteredItems, activeIndex,
  select, handlers, getDataParts, clear, loading,
} = useMention({
  triggers: [
    {
      char: '@',
      items: (q) => projects.filter(p => p.label.includes(q)),
      dataPart: (item) => ({ type: 'data', dataType: 'project_ref', projectId: item.id }),
    },
  ],
})

function send() {
  const parts = getDataParts()
  api.sendMessage(parts)
  clear()
}
</script>

<template>
  <div class="my-chat-input">
    <div ref="editorRef" contenteditable v-on="handlers" />
    <MyDropdown v-if="isOpen" :items="filteredItems" :active="activeIndex" :loading="loading" @select="select" />
    <button @click="send">发送</button>
  </div>
</template>
```

## 触发器配置

```ts
interface MentionTrigger {
  char: string                    // 触发字符
  mode?: 'inline' | 'command'     // 默认 'inline'
  items: MentionItem[]            // 静态数组
    | ((query: string) => MentionItem[] | Promise<MentionItem[]>)  // 或函数
  debounce?: number               // 异步防抖毫秒数，默认 300
  dataPart?: (item) => Record<string, any>  // 输出转换函数
  schema?: { type: string; mapping: Record<string, string> }  // 声明式映射
  onSelect?: (item) => void       // 命令模式回调
}
```

### 多触发器

```ts
const triggers = [
  { char: '@', items: projects, dataPart: (item) => ({ type: 'data', dataType: 'project_ref', projectId: item.id }) },
  { char: '#', items: tags, schema: { type: 'tag_ref', mapping: { tagId: 'id', tagName: 'label' } } },
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

## MentionInput Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `triggers` | `MentionTrigger[]` | 必填 | 触发器配置 |
| `placeholder` | `string` | `''` | 占位文本 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `maxHeight` | `string` | `'200px'` | 输入框最大高度 |
| `submitOnEnter` | `boolean` | `true` | 是否 Enter 键提交 |
| `popupMode` | `'fixed' \| 'cursor'` | `'fixed'` | 弹窗定位模式 |

## 事件

| 事件 | 载荷 | 说明 |
|------|------|------|
| `submit` | `DataPart[]` | 按 Enter 时触发 |
| `change` | `ContentPart[]` | 内容变化时触发 |

## 插槽

| 插槽 | Props | 说明 |
|------|-------|------|
| `#list` | `{ items, activeIndex, select, loading }` | 自定义下拉列表 |
| `#item` | `{ item, active, select }` | 自定义候选项渲染 |
| `#empty` | `{ query }` | 无匹配结果提示 |
| `#loading` | `{}` | 加载中提示 |
| `#actions` | `{ submit, clear, isEmpty }` | 自定义底部操作栏 |

## 暴露方法

通过 template ref 访问：

```ts
const inputRef = ref()

inputRef.value.getParts()       // ContentPart[]
inputRef.value.getDataParts()   // DataPart[]
inputRef.value.getPlainText()   // string
inputRef.value.clear()
inputRef.value.setContent(parts)  // 从 ContentPart[] 恢复内容
inputRef.value.focus()
```

## 反序列化

编辑已发送的消息：

```vue
<script setup>
const inputRef = ref()
const savedParts = [
  { type: 'text', content: '请检查 ' },
  { type: 'mention', triggeredBy: '@', id: '1', label: 'Project Alpha' },
  { type: 'text', content: ' 的部署状态' },
]
onMounted(() => inputRef.value.setContent(savedParts))
</script>

<template>
  <MentionInput ref="inputRef" :triggers="triggers" @submit="onUpdate" />
</template>
```

## 弹窗模式

```vue
<!-- 固定模式：下拉列表在编辑器上方（默认） -->
<MentionInput :triggers="triggers" popup-mode="fixed" />

<!-- 光标模式：下拉列表跟随光标位置 -->
<MentionInput :triggers="triggers" popup-mode="cursor" />
```

## 许可

[MIT](./LICENSE)
