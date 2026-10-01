# mentionly

[![tests](https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml/badge.svg)](https://github.com/jz0ojiang/mentionly/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/mentionly?color=3b82f6&label=npm&logo=npm)](https://www.npmjs.com/package/mentionly)
[![downloads](https://img.shields.io/npm/dm/mentionly?color=10b981&label=downloads&logo=npm)](https://www.npmjs.com/package/mentionly)

Mention input for AI chat scenarios: a framework-agnostic `contenteditable` engine
(`@mentionly/core`) with a ready-to-use Vue 3 component and headless React / Svelte adapters.

Atomic mention entities, async and paginated data sources, IME handling and serialization — with
zero runtime dependencies in the core.

[Live Demo](https://im0o.top/mentionly) | [中文文档](./README.zh.md) | [Migrating from 1.x](./MIGRATION.md)

## Packages

| Package | What it is | Install | Peer dependency |
|---------|------------|---------|-----------------|
| [`@mentionly/core`](./packages/core) | Framework-agnostic engine: trigger detection, async/paginated sources, DOM serialization, keyboard + IME handling. Also ships the `./ai-sdk` and `./mcp` converters. | `npm install @mentionly/core` | none |
| [`@mentionly/vue`](./packages/vue) | Thin Vue 3 adapter: the `useMention` composable plus ready-to-use `MentionInput` and `MentionList` components. | `npm install @mentionly/vue` | `vue` `^3.3.0` |
| [`@mentionly/react`](./packages/react) | Headless React hook (`useMention`), built on `useSyncExternalStore`. No published components. | `npm install @mentionly/react` | `react` `>=18` |
| [`@mentionly/svelte`](./packages/svelte) | Headless Svelte 5 adapter: `createMention()` plus the `use:mention` action. No published components. | `npm install @mentionly/svelte` | `svelte` `^5.0.0` |
| [`mentionly`](./packages/mentionly) | Forwarding package: re-exports `@mentionly/vue` and ships `mentionly/style.css`. Drop-in upgrade for 1.x users. | `npm install mentionly` | `vue` `^3.3.0` |

All five packages are versioned together.

## Quick start (Vue)

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
    // toData() runs when an item is selected; its result is stored on the mention
    toData: (item) => ({ kind: 'user', userId: item.id }),
  },
]

function onSubmit(parts: Part[]) {
  // [
  //   { type: 'text', text: 'Check ' },
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
    placeholder="Type a message... try @"
    @submit="onSubmit"
  />
</template>
```

`@mentionly/vue` exposes exactly the same API — swap the import to
`import { MentionInput } from '@mentionly/vue'` and `import '@mentionly/vue/style.css'`.

### Headless mode (Vue)

`useMention()` gives you the engine and the DOM event handlers; you render the editor and the
dropdown yourself.

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
      items: (query, page) => searchUsers(query, page), // async + paginated
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
    <!-- The editor element gets role="combobox" and aria-* wiring from the core -->
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

    <button @click="send">Send</button>
  </div>
</template>
```

Always use `ids.listbox` / `ids.option(index)` for the listbox and options — the core writes
`aria-controls` / `aria-activedescendant` on the editor pointing at those ids.

## Quick start (React)

```tsx
import { useMemo } from 'react'
import { useMention } from '@mentionly/react'
import type { MentionTrigger } from '@mentionly/react'

const USERS = [
  { id: 'u1', label: 'Alice' },
  { id: 'u2', label: 'Bob' },
]

export function Composer() {
  // ⚠ `triggers` must keep a stable reference: a module-level constant or useMemo().
  // A new array on every render makes the hook call setOptions(), which closes the
  // popup and invalidates in-flight requests. Development builds warn when the
  // reference changes on 3 renders in a row.
  const triggers = useMemo<MentionTrigger[]>(
    () => [{ char: '@', items: USERS, toData: (item) => ({ userId: item.id }) }],
    [],
  )

  const { ref, state, ids, select, getParts, clear } = useMention({ triggers })

  return (
    <>
      {/* core owns everything inside this element: do not render React children into it */}
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

`useMention()` returns a callback `ref` (attach it to the editor), the core snapshot as `state`,
the a11y `ids`, plus `select` / `loadMore` / `close` / `getParts` / `getDataParts` /
`getPlainText` / `clear` / `setContent` / `focus` / `insertMention` and the underlying `core`.

A complete, copyable component — keyboard submit, scroll-into-view, pagination and error state —
lives in [`examples/react/src/MentionInput.tsx`](./examples/react/src/MentionInput.tsx). Copy that
file plus `MentionInput.css` into your project and restyle the `mi-*` class names.

## Quick start (Svelte 5)

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

<!-- core binds to this element and sets role="combobox" + aria-* on it -->
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

`createMention()` returns `state` (a `$state` mirror of the core snapshot), `ids`, `mention`
(the action), `core`, `setOptions`, and the same method set as the other adapters. A complete,
copyable component lives in
[`examples/svelte/src/MentionInput.svelte`](./examples/svelte/src/MentionInput.svelte).

## Output format

The engine reads the editor DOM into a framework-independent `Part[]`:

```ts
import type { Part, TextPart, MentionPart } from '@mentionly/core'

interface TextPart {
  type: 'text'
  text: string
}

interface MentionPart<T = unknown> {
  type: 'mention'
  trigger: string   // '@', '#', '/', ...
  id: string
  label: string
  data?: T          // whatever trigger.toData(item) returned at selection time
}

type Part<T = unknown> = TextPart | MentionPart<T>
```

```ts
core.getParts()      // Part[]
core.getPlainText()  // 'hello @Alice' — text plus trigger + label for each mention
```

- **`toData(item)`** runs once, when the item is selected, and its result is persisted on the
  mention node itself. `getParts()` later returns it as `data`, so the mention survives
  serialization even if the original item is gone.
- **`getParts()` normalizes** the DOM: adjacent text is merged, non-breaking spaces (inserted
  after a mention by default) become regular spaces, and leading/trailing whitespace plus empty
  text parts are trimmed away.
- **`setContent(parts)`** restores the editor from a `Part[]` (or a legacy 1.x `ContentPart[]`,
  see the [migration guide](./MIGRATION.md)), so `setContent(getParts())` round-trips.

## AI and agent interoperability

Both converters are subpath exports of `@mentionly/core` and use structural types, so the core
stays dependency-free.

### Vercel AI SDK — `@mentionly/core/ai-sdk`

```ts
import { toUIMessageParts, fromUIMessageParts } from '@mentionly/core/ai-sdk'

const uiParts = toUIMessageParts(core.getParts())
// [{ type: 'text', text: 'hi ' },
//  { type: 'data-mention', data: { trigger: '@', id: 'u1', label: 'Alice' } }]

const parts = fromUIMessageParts(message.parts) // reads text + data-* parts, skips the rest
```

- `toUIMessageParts(parts, { dataPartName })` — data part name defaults to `'mention'`.
- `fromUIMessageParts(uiParts, { dataPartName })` — pass `dataPartName` to accept only that data
  part, or omit it to accept any `data-*` part whose payload has `trigger`, `id` and `label`.
- The two functions are inverses: `fromUIMessageParts(toUIMessageParts(x))` deep-equals `x`.

> **Server side:** AI SDK's `convertToModelMessages` drops data parts from user messages by
> default, so the model never sees the mention. Pass `convertDataPart` to turn mentions into
> something the model can read (returning `undefined` ignores the part):
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

### MCP — `@mentionly/core/mcp`

```ts
import { toMCPContent } from '@mentionly/core/mcp'

toMCPContent(core.getParts())
// [{ type: 'text', text: 'see ' },
//  { type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' }]
```

- `text` parts become `{ type: 'text', text }`; adjacent text blocks (including text from mentions
  without a uri) are merged.
- A mention whose data has a string `uri` becomes `{ type: 'resource_link', uri, name: label }`
  (`name` is the mention label).
- By default the uri comes from `part.data?.uri`. Use `getUri(part)` / `getMimeType(part)` to
  read it from anywhere else; a mention with no uri degrades to the text `trigger + label`.

## Features

- **Multiple triggers** — `@`, `#`, `/` or any character you want.
- **Atomic mention entities** — `contenteditable="false"` spans, indivisible and styled.
- **One engine, three adapters** — `@mentionly/core` holds the logic; Vue ships components,
  React and Svelte are headless.
- **Async data sources** — debounce, race protection and an `error` state.
- **Backend pagination** — the data source gets `{ offset, limit }` and the list loads the next
  page on scroll or keyboard navigation; return `{ items, hasMore }` for an explicit next page.
- **Command mode** — `/slash` commands that fire a callback instead of inserting an entity.
- **IME compatible** — correct handling of Chinese / Japanese / Korean composition.
- **Serialization** — `getParts()` / `setContent()` for submitting and editing saved messages.
- **Teleport dropdown (Vue)** — the dropdown teleports to `<body>` by default, avoiding
  `overflow: hidden` clipping.
- **Cursor-following popup** — `popupMode="cursor"` positions the dropdown at the caret;
  `popupScrollBehavior` controls what happens on scroll (`reposition` / `close` / `ignore`).
- **Word-boundary aware** — with the default `allowMidWord: false`, a trigger directly after an
  ASCII word character does not open the list, so `a@b.com` stays a plain email; whitespace,
  CJK characters and punctuation still trigger.
- **Zero runtime dependencies in the core** — `@mentionly/core` pulls in nothing; the adapters add
  only Vue / React / Svelte as peer dependencies.

## Trigger configuration

```ts
interface MentionTrigger {
  char: string                    // Trigger character
  mode?: 'inline' | 'command'     // Default 'inline'
  allowMidWord?: boolean          // Allow the trigger right after an ASCII word char, default false
  items: MentionItem[]            // Static array
    | ((query: string, page?: { offset: number; limit: number })   // or function
        => MentionItemsResult | Promise<MentionItemsResult>)
  pagination?: { pageSize: number }  // Enable backend pagination (function sources only)
  debounce?: number               // Async debounce in ms, default 0
  toData?: (item: MentionItem) => unknown  // Persisted on the mention as `data`
  onSelect?: (item: MentionItem) => void   // Command mode callback
}

// Function sources may return a bare array, or an object with an explicit hasMore:
type MentionItemsResult = MentionItem[] | { items: MentionItem[]; hasMore?: boolean }
```

### Multiple triggers

```ts
const triggers: MentionTrigger[] = [
  { char: '@', items: users, toData: (item) => ({ kind: 'user', userId: item.id }) },
  { char: '#', items: topics, toData: (item) => ({ kind: 'topic', topicId: item.id }) },
  { char: '/', mode: 'command', items: commands, onSelect: (item) => handleCommand(item) },
]
```

### Async data source

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

### Backend pagination (load more)

```ts
{
  char: '@',
  pagination: { pageSize: 20 },
  items: async (query, page) => {
    const res = await fetch(`/api/users?q=${query}&offset=${page.offset}&limit=${page.limit}`)
    const users = await res.json()

    // Option 1 — return a bare array; hasMore is inferred from `length >= limit`
    return users

    // Option 2 — be explicit about whether there is a next page
    // return { items: users.list, hasMore: users.hasNext }
  },
}
```

- **Function sources only** — static arrays still render in full.
- **Backward compatible** — without `pagination`, the `(query) => items` contract is unchanged
  (no second argument is passed).
- `loading` covers the first page (replaces the list) and `loadingMore` covers subsequent pages
  (keeps the list, shows a footer indicator). Both are exposed by every adapter, and by the Vue
  `#list` slot.

## `MentionInput` (`@mentionly/vue`)

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `triggers` | `MentionTrigger[]` | required | Trigger configs |
| `placeholder` | `string` | `''` | Placeholder text |
| `disabled` | `boolean` | `false` | Disable the input |
| `maxHeight` | `string` | `'200px'` | Max editor height |
| `submitOnEnter` | `boolean` | `true` | Submit on Enter |
| `onEnter` | `(e: KeyboardEvent) => void` | `-` | Called on Enter before submit; call `e.preventDefault()` to block submit/newline |
| `popupMode` | `'fixed' \| 'cursor'` | `'fixed'` | Popup positioning mode |
| `popupScrollBehavior` | `'reposition' \| 'close' \| 'ignore'` | `'reposition'` | Popup behaviour on scroll |
| `teleport` | `boolean` | `true` | Teleport the dropdown to `<body>` |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `submit` | `Part[]` | Fired on Enter |
| `change` | `Part[]` | Fired on content change |

### Slots

| Slot | Props | Description |
|------|-------|-------------|
| `#list` | `{ items, activeIndex, select, loading, hasMore, loadingMore, loadMore, ids }` | Custom dropdown |
| `#item` | `{ item, active, select }` | Custom item rendering |
| `#empty` | `{ query }` | No results |
| `#error` | `{ error }` | Data source error (replaces the default alert box) |
| `#loading` | `{}` | Loading state (first page) |
| `#loading-more` | `{}` | "Load more" indicator while fetching the next page |
| `#actions` | `{ submit, clear, isEmpty }` | Custom action bar |
| `#inner-actions` | `{ submit, clear, isEmpty }` | Inside the editor area, below the input (e.g. send button) |
| `#default` | `{ submit, clear, isEmpty, focus, getParts }` | Bottom of the wrapper, free-form content |

### Exposed methods

Access via a template ref:

```ts
const inputRef = ref()

inputRef.value.getParts()        // Part[]
inputRef.value.getDataParts()    // DataPart[]   (deprecated, 1.x compatible)
inputRef.value.getPlainText()    // string
inputRef.value.clear()
inputRef.value.setContent(parts) // Part[] (or legacy ContentPart[])
inputRef.value.insertMention({
  id: 'ctx-1',
  label: 'Selection Context',
  data: { kind: 'context', sourceId: 'ctx-1' },
})
inputRef.value.focus()
inputRef.value.ids               // { listbox, option(index) }
```

`insertMention()` also inserts custom atomic nodes that are not registered on any trigger.

## Accessibility

The core sets and maintains the combobox wiring on the editor element:

| Attribute | Value |
|-----------|-------|
| `role` | `combobox` (unless you set your own `role`) |
| `aria-autocomplete` | `list` |
| `aria-expanded` | `true` while the dropdown is open |
| `aria-controls` | `ids.listbox` |
| `aria-activedescendant` | `ids.option(activeIndex)` while open with results |

Render the dropdown as `role="listbox"` with `id={ids.listbox}`, and each option as
`role="option"` with `id={ids.option(index)}` and `aria-selected`. Vue's `MentionList` already
does this; in React and Svelte you wire it up yourself. ↑ / ↓ / Enter / Tab / Escape, including
IME composition, are handled by the core — do not reimplement them.

## Error state

When an async data source rejects, the core exposes it instead of throwing:

- `state.error` (React / Svelte) or the `error` ref (Vue) holds the rejection; it resets to
  `null` on the next successful load and on `close()`.
- `MentionInput` renders `#error` (default: an alert box with "Failed to load suggestions.").
- A failed first page clears the list; a failed next page keeps the already loaded items and
  `hasMore` so the user can retry.

## Migrating from 1.x

`mentionly` keeps working as a forwarding package, but parts of the output format and some APIs
changed. See **[MIGRATION.md](./MIGRATION.md)** for every change with before/after code.

## License

[MIT](./LICENSE)
