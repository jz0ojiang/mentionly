# mentionly

Lightweight Vue 3 mention input component for AI chat scenarios. Zero dependencies (only peer depends on Vue 3).

[中文文档](./README.zh.md)

## Features

- **Multiple triggers** — `@`, `#`, `/` or any character you want
- **Headless + Ready-to-use** — Core logic in `useMention` composable; batteries-included `MentionInput` component
- **Atomic mention entities** — `contenteditable="false"` spans, indivisible and styled
- **Customizable output schema** — `dataPart` transformer or declarative `schema` mapping
- **Async data sources** — With debounce and race condition protection
- **Command mode** — `/slash` commands that trigger callbacks without inserting entities
- **IME compatible** — Correct handling of Chinese / Japanese / Korean input
- **Serialization & deserialization** — `getDataParts()` for submission, `setContent()` for editing saved messages
- **Cursor-following popup** — Optional `popupMode="cursor"` for popup that follows the caret
- **Zero dependencies** — Only Vue 3 as peer dependency

## Install

```bash
npm install mentionly
# or
pnpm add mentionly
# or
bun add mentionly
```

## Quick Start

### Ready-to-use Component

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
  //   { type: 'text', text: 'Check ' },
  //   { type: 'data', dataType: 'project_ref', projectId: '1', projectName: 'Project Alpha' },
  //   { type: 'text', text: ' status' },
  // ]
}
</script>

<template>
  <MentionInput
    :triggers="triggers"
    placeholder="Type a message... try @"
    @submit="onSubmit"
  />
</template>
```

### Headless Mode

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
    <button @click="send">Send</button>
  </div>
</template>
```

## Triggers

```ts
interface MentionTrigger {
  char: string                    // Trigger character
  mode?: 'inline' | 'command'     // Default 'inline'
  items: MentionItem[]            // Static array
    | ((query: string) => MentionItem[] | Promise<MentionItem[]>)  // or function
  debounce?: number               // Async debounce ms, default 300
  dataPart?: (item) => Record<string, any>  // Output transformer
  schema?: { type: string; mapping: Record<string, string> }  // Declarative mapping
  onSelect?: (item) => void       // Command mode callback
}
```

### Multiple Triggers

```ts
const triggers = [
  { char: '@', items: projects, dataPart: (item) => ({ type: 'data', dataType: 'project_ref', projectId: item.id }) },
  { char: '#', items: tags, schema: { type: 'tag_ref', mapping: { tagId: 'id', tagName: 'label' } } },
  { char: '/', mode: 'command', items: commands, onSelect: (item) => handleCommand(item) },
]
```

### Async Data Source

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

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `triggers` | `MentionTrigger[]` | required | Trigger configs |
| `placeholder` | `string` | `''` | Placeholder text |
| `disabled` | `boolean` | `false` | Disable input |
| `maxHeight` | `string` | `'200px'` | Max editor height |
| `submitOnEnter` | `boolean` | `true` | Submit on Enter |
| `popupMode` | `'fixed' \| 'cursor'` | `'fixed'` | Popup positioning mode |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `submit` | `DataPart[]` | Fired on Enter |
| `change` | `ContentPart[]` | Fired on content change |

## Slots

| Slot | Props | Description |
|------|-------|-------------|
| `#list` | `{ items, activeIndex, select, loading }` | Custom dropdown |
| `#item` | `{ item, active, select }` | Custom item rendering |
| `#empty` | `{ query }` | No results |
| `#loading` | `{}` | Loading state |
| `#actions` | `{ submit, clear, isEmpty }` | Custom action bar |

## Exposed Methods

Access via template ref:

```ts
const inputRef = ref()

inputRef.value.getParts()       // ContentPart[]
inputRef.value.getDataParts()   // DataPart[]
inputRef.value.getPlainText()   // string
inputRef.value.clear()
inputRef.value.setContent(parts)  // Restore from ContentPart[]
inputRef.value.focus()
```

## Deserialization

Edit a previously sent message:

```vue
<script setup>
const inputRef = ref()
const savedParts = [
  { type: 'text', content: 'Check ' },
  { type: 'mention', triggeredBy: '@', id: '1', label: 'Project Alpha' },
  { type: 'text', content: ' deployment status' },
]
onMounted(() => inputRef.value.setContent(savedParts))
</script>

<template>
  <MentionInput ref="inputRef" :triggers="triggers" @submit="onUpdate" />
</template>
```

## Popup Mode

```vue
<!-- Fixed: dropdown above editor (default) -->
<MentionInput :triggers="triggers" popup-mode="fixed" />

<!-- Cursor: dropdown follows caret position -->
<MentionInput :triggers="triggers" popup-mode="cursor" />
```

## License

[MIT](./LICENSE)
