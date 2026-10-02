# @mentionly/vue

Vue 3 adapter for [mentionly](https://github.com/jz0ojiang/mentionly): a lightweight
`contenteditable` mention input for AI chat scenarios, with atomic mention entities, async and
paginated data sources, IME handling and serialization.

This package is a thin Vue layer over the framework-agnostic
[`@mentionly/core`](https://www.npmjs.com/package/@mentionly/core) engine. It exposes:

- `useMention()` — headless composable: state as refs, DOM handlers, and the core methods.
- `MentionInput` — batteries-included component (editor + dropdown + slots).
- `MentionList` — the default dropdown, usable on its own.

Vue 3 is a peer dependency; `@mentionly/core` is installed automatically.


> **For AI agents:** this package ships `llms.txt` (`node_modules/@mentionly/vue/llms.txt`) with setup and integration rules for its installed version. Site-wide docs: [llms.txt](https://im0o.top/mentionly/llms.txt), [llms-full.txt](https://im0o.top/mentionly/llms-full.txt).

## Install

```bash
npm install @mentionly/vue
```

If you are upgrading from 1.x, the forwarding package
[`mentionly`](https://www.npmjs.com/package/mentionly) exposes the same API and ships
`mentionly/style.css`.

## Usage

```vue
<script setup lang="ts">
import { MentionInput } from '@mentionly/vue'
import type { MentionTrigger, Part } from '@mentionly/vue'
import '@mentionly/vue/style.css'

const triggers: MentionTrigger[] = [
  {
    char: '@',
    items: [
      { id: 'u1', label: 'Alice' },
      { id: 'u2', label: 'Bob' },
    ],
    toData: (item) => ({ kind: 'user', userId: item.id }),
  },
]

function onSubmit(parts: Part[]) {
  // [{ type: 'text', text: 'hi ' },
  //  { type: 'mention', trigger: '@', id: 'u1', label: 'Alice', data: { kind: 'user', userId: 'u1' } }]
}
</script>

<template>
  <MentionInput :triggers="triggers" placeholder="Type a message... try @" @submit="onSubmit" />
</template>
```

### Headless

```vue
<script setup lang="ts">
import { useMention } from '@mentionly/vue'

const { editorRef, isOpen, filteredItems, activeIndex, ids, select, handlers, getParts, clear } =
  useMention({
    triggers: [{ char: '@', items: users, toData: (item) => ({ userId: item.id }) }],
  })
</script>

<template>
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
</template>
```

## API

### `useMention(options)`

`options` is a `UseMentionOptions` (`triggers`, `insertSpaceAfter`, `popupMode`,
`popupScrollBehavior`). Returns refs (`isOpen`, `filteredItems`, `activeIndex`, `query`,
`activeTrigger`, `loading`, `error`, `popupPosition`, `hasMore`, `loadingMore`, `isEmpty`),
`editorRef`, `ids`, `handlers`, and the methods `select`, `insertMention`, `loadMore`, `close`,
`getParts`, `getDataParts` (deprecated), `getPlainText`, `clear`, `setContent`, `focus`.

### `MentionInput`

Props: `triggers`, `placeholder`, `disabled`, `maxHeight`, `submitOnEnter`, `onEnter`,
`popupMode`, `popupScrollBehavior`, `teleport`.

Events: `submit(parts: Part[])`, `change(parts: Part[])`.

Slots: `#list` (with `ids`), `#item`, `#empty`, `#error`, `#loading`, `#loading-more`,
`#actions`, `#inner-actions`, `#default`.

Exposed through a template ref: `getParts()`, `getDataParts()` (deprecated), `getPlainText()`,
`clear()`, `setContent(parts)`, `insertMention(payload)`, `focus()`, `ids`.

### `MentionList`

Props: `items`, `activeIndex`, `loading`, `query`, `ids` (**required**), `hasMore`,
`loadingMore`.

## Documentation

- [Root README](https://github.com/jz0ojiang/mentionly/blob/main/README.md)
- [Migration guide (1.x → 2.0)](https://github.com/jz0ojiang/mentionly/blob/main/MIGRATION.md)
- [Live demo](https://im0o.top/mentionly)

## License

[MIT](https://github.com/jz0ojiang/mentionly/blob/main/LICENSE)
