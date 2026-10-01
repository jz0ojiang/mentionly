# Migrating from 1.x to 2.0

2.0 splits mentionly into a framework-agnostic engine plus three adapters, and replaces the 1.x
`ContentPart` / `DataPart` output with a single `Part[]` format. `mentionly` itself keeps working
as a forwarding package for Vue, and the deprecated 1.x APIs still run (they are removed in 3.0),
so most apps can migrate one piece at a time.

Everything below is written as **what changed → how to change it → before/after code**.

- [1. Package layout](#1-package-layout)
- [2. `getParts()` returns `Part[]`](#2-getparts-returns-part)
- [3. `MentionInput` `submit` / `change` now emit `Part[]`](#3-mentioninput-submit--change-now-emit-part)
- [4. `dataPart`, `schema`, `getDataParts()`, `DataPart`, `ContentPart` are deprecated](#4-datapart-schema-getdataparts-datapart-contentpart-are-deprecated)
- [5. `insertMention()` has a new payload](#5-insertmention-has-a-new-payload)
- [6. `setContent()` accepts legacy `ContentPart[]`](#6-setcontent-accepts-legacy-contentpart)
- [7. `MentionList` needs the new required `ids` prop](#7-mentionlist-needs-the-new-required-ids-prop)
- [8. The editor `role` is now `combobox`](#8-the-editor-role-is-now-combobox)
- [9. New: `error` state and the `#error` slot](#9-new-error-state-and-the-error-slot)
- [10. New: `ids` for a11y wiring](#10-new-ids-for-a11y-wiring)
- [11. New: changing `triggers` closes the list and aborts requests](#11-new-changing-triggers-closes-the-list-and-aborts-requests)
- [12. `allowMidWord` boundary rule (introduced in 1.2.1)](#12-allowmidword-boundary-rule-introduced-in-121)

## 1. Package layout

**What changed**

- The logic moved out of the Vue package into `@mentionly/core`, a framework-agnostic engine that
  depends on the browser DOM but not on any framework. `@mentionly/vue` is now a thin adapter.
- Two new adapters ship alongside it: `@mentionly/react` (headless `useMention` hook) and
  `@mentionly/svelte` (headless `createMention()` + `use:mention`).
- Two new converter subpaths ship with the core: `@mentionly/core/ai-sdk` and `@mentionly/core/mcp`.
- `mentionly` is still published and still exposes the exact `@mentionly/vue` API, but it is **no
  longer a zero-dependency package**: it forwards `@mentionly/vue`, which depends on
  `@mentionly/core`. Vue 3 remains only a peer dependency.

**How to change it**

Nothing is required — `npm install mentionly` and `import { MentionInput } from 'mentionly'`
keep working. If you want the framework-agnostic parts without Vue, depend on
`@mentionly/core` directly. If you are on React or Svelte, add the matching adapter.

```bash
# 1.x
npm install mentionly

# 2.0 — still valid
npm install mentionly

# 2.0 — alternative, framework-agnostic / per-framework
npm install @mentionly/core
npm install @mentionly/vue     # or @mentionly/react, @mentionly/svelte
```

```ts
// 1.x — the engine was internal; only the Vue API was public
// (there was no @mentionly/core to import from)

// 2.0
import { MentionCore } from '@mentionly/core'
```

## 2. `getParts()` returns `Part[]`

**What changed**

In 1.x `getParts()` returned the raw internal `ContentPart[]`. In 2.0 it returns `Part[]`, a
public, framework-independent format:

| 1.x `ContentPart` | 2.0 `Part` |
|-------------------|------------|
| `{ type: 'text', content }` | `{ type: 'text', text }` |
| `{ type: 'mention', triggeredBy, id, label, dataPart? }` | `{ type: 'mention', trigger, id, label, data? }` |

`getParts()` now also **normalizes** the output: adjacent text is merged, non-breaking spaces
inserted after a mention become regular spaces, leading/trailing whitespace is trimmed and empty
text parts are dropped. 1.x `getParts()` returned those bytes verbatim.

**How to change it**

Rename the fields when you read the result: `content` → `text`, `triggeredBy` → `trigger`,
`dataPart` → `data`. If you persisted 1.x parts, see
[section 6](#6-setcontent-accepts-legacy-contentpart) for reading them back.

```ts
// 1.x
const parts = inputRef.value.getParts()
// [
//   { type: 'text', content: 'Check ' },
//   { type: 'mention', triggeredBy: '@', id: '1', label: 'Project Alpha',
//     dataPart: { dataType: 'mentioned_ref', projectId: '1' } },
// ]

// 2.0
const parts = inputRef.value.getParts()
// [
//   { type: 'text', text: 'Check ' },
//   { type: 'mention', trigger: '@', id: '1', label: 'Project Alpha',
//     data: { kind: 'project', projectId: '1' } },
// ]

// Reading either shape without breaking 1.x consumers:
const text = part.type === 'text' ? (part.text ?? part.content) : `${part.trigger ?? part.triggeredBy}${part.label}`
```

## 3. `MentionInput` `submit` / `change` now emit `Part[]`

**What changed**

| Event | 1.x payload | 2.0 payload |
|-------|-------------|-------------|
| `submit` | `DataPart[]` (from `getDataParts()`) | `Part[]` (from `getParts()`) |
| `change` | `ContentPart[]` (from `getParts()`) | `Part[]` |

The `submit` payload is the interesting one: 1.x flattened your `dataPart` transformer result
into the part (`{ type: 'data', dataType: 'mentioned_ref', projectId: '1' }`). 2.0 nests it under
the mention (`{ type: 'mention', trigger: '@', id: '1', label: 'Project Alpha', data: { … } }`).
Update the backend contract accordingly, or keep using `getDataParts()` (deprecated) if the
server must stay untouched for now.

**How to change it**

```vue
<script setup lang="ts">
// 1.x
function onSubmit(dataParts) {
  // [{ type: 'text', text: 'Check ' },
  //  { type: 'data', dataType: 'mentioned_ref', projectId: '1', projectName: 'Project Alpha' }]
  api.send(dataParts)
}
</script>

<template>
  <MentionInput :triggers="triggers" @submit="onSubmit" />
</template>
```

```vue
<script setup lang="ts">
// 2.0
import type { MentionTrigger, Part } from 'mentionly'

const triggers: MentionTrigger[] = [
  { char: '@', items: projects, toData: (item) => ({ kind: 'project', projectId: item.id, name: item.label }) },
]

function onSubmit(parts: Part[]) {
  // [{ type: 'text', text: 'Check ' },
  //  { type: 'mention', trigger: '@', id: '1', label: 'Project Alpha',
  //    data: { kind: 'project', projectId: '1', name: 'Project Alpha' } }]
  api.send(parts)
}
</script>

<template>
  <MentionInput :triggers="triggers" @submit="onSubmit" />
</template>
```

## 4. `dataPart`, `schema`, `getDataParts()`, `DataPart`, `ContentPart` are deprecated

**What changed**

The 1.x mapping APIs still exist and behave exactly as before, but they are deprecated and will
be removed in 3.0:

- `MentionTrigger.dataPart` → use `toData`
- `MentionTrigger.schema` → use `toData`
- `getDataParts()` → use `getParts()`
- `DataPart` / `ContentPart` types → use `Part` / `TextPart` / `MentionPart`

`getDataParts()` output is **identical to 1.x** (including the flattened `{ type: 'data', … }`
parts, custom `type` overrides and the original NBSP bytes in text). The `DataPart` type was
widened from `{ type: 'data' } & Record<string, any>` to `{ type: string } & Record<string, any>`
so your own `type` overrides still typecheck.

`toData` is not a rename of `dataPart`: `toData` receives the whole item and its return value is
persisted on the mention node, then read back by `getParts()` as `data`. `dataPart` output is
kept in a separate slot and only surfaces through `getDataParts()`.

**How to change it**

```ts
// 1.x
const triggers = [
  { char: '@', items: projects, dataPart: (item) => ({ dataType: 'mentioned_ref', projectId: item.id }) },
  { char: '#', items: tags, schema: { type: 'tag_ref', mapping: { tagId: 'id', tagName: 'label' } } },
]
const dataParts = inputRef.value.getDataParts()
```

```ts
// 2.0
const triggers: MentionTrigger[] = [
  { char: '@', items: projects, toData: (item) => ({ kind: 'mentioned_ref', projectId: item.id }) },
  { char: '#', items: tags, toData: (item) => ({ kind: 'tag_ref', tagId: item.id, tagName: item.label }) },
]
const parts: Part[] = inputRef.value.getParts()
```

## 5. `insertMention()` has a new payload

**What changed**

| 1.x | 2.0 |
|-----|-----|
| `{ id, label, triggeredBy?, dataPart? }` | `{ id, label, trigger?, data? }` |

`triggeredBy` is still read (as a fallback for `trigger`) and `dataPart` still works as a map or
as a function receiving `{ id, label, triggeredBy }`, but both are deprecated. Only `data` ends up
in `getParts().data`; a legacy `dataPart` remains visible through `getDataParts()`.

**How to change it**

```ts
// 1.x
inputRef.value.insertMention({
  id: 'ctx-1',
  label: 'Selection Context',
  dataPart: (item) => ({ dataType: 'selection_ref', sourceId: item.id, title: item.label }),
})
```

```ts
// 2.0
inputRef.value.insertMention({
  id: 'ctx-1',
  label: 'Selection Context',
  trigger: '@',                                                  // optional, defaults to ''
  data: { kind: 'selection_ref', sourceId: 'ctx-1', title: 'Selection Context' },
})
```

The second argument is unchanged: `{ appendSpace?: boolean, focus?: boolean }`.

## 6. `setContent()` accepts legacy `ContentPart[]`

**What changed**

`setContent()` accepts both shapes and detects them per part, so you can keep feeding it content
you saved with 1.x. The first time legacy input is seen it logs
`[mentionly] setContent(ContentPart[]) is deprecated; use Part[] instead.` — **once per page
load**, not once per call.

**How to change it**

Prefer storing `Part[]` going forward; convert old rows on read.

```ts
// 1.x
inputRef.value.setContent([
  { type: 'text', content: 'Check ' },
  { type: 'mention', triggeredBy: '@', id: '1', label: 'Project Alpha' },
  { type: 'text', content: ' deployment status' },
])
```

```ts
// 2.0
inputRef.value.setContent([
  { type: 'text', text: 'Check ' },
  { type: 'mention', trigger: '@', id: '1', label: 'Project Alpha' },
  { type: 'text', text: ' deployment status' },
])
```

## 7. `MentionList` needs the new required `ids` prop

**What changed**

`MentionList` gained a required `ids: MentionCoreIds` prop. It is used for the `listbox` id and
per-option ids so the editor's `aria-controls` / `aria-activedescendant` can point at them.
`MentionInput` passes it automatically; only direct `MentionList` users are affected.

**How to change it**

```vue
<!-- 1.x -->
<MentionList :items="filteredItems" :active-index="activeIndex" :loading="loading" :query="query" @select="select" />
```

```vue
<!-- 2.0 -->
<script setup lang="ts">
const { ids } = useMention({ triggers })
</script>

<template>
  <MentionList
    :items="filteredItems"
    :active-index="activeIndex"
    :loading="loading"
    :query="query"
    :ids="ids"
    @select="select"
  />
</template>
```

If you render a custom dropdown through `#list`, the slot also provides `ids` now — use
`ids.listbox` and `ids.option(index)` on your elements.

## 8. The editor `role` is now `combobox`

**What changed**

1.x `MentionInput` hard-coded `role="textbox"` and `aria-multiline="true"` on the editor. The core
now owns the a11y attributes: it sets `role="combobox"`, `aria-autocomplete="list"`,
`aria-expanded`, `aria-controls` and `aria-activedescendant`, and removes the 1.x attributes.

`role="combobox"` is only applied when the element has no `role` attribute of its own, so an
explicit `role` you set still wins (the core then keeps managing the `aria-*` wiring).

**How to change it**

If you had tests or CSS keyed on the old role, update them.

```ts
// 1.x
container.querySelector('[role="textbox"]')

// 2.0
container.querySelector('[role="combobox"]')
// or, framework-agnostically, just use the editor element you already have a ref to
```

```css
/* 1.x */
.editor[role='textbox'] { … }

/* 2.0 */
.editor[role='combobox'] { … }
```

## 9. New: `error` state and the `#error` slot

**What changed**

Async data source failures used to be silent. 2.0 surfaces them:

- `error` (Vue ref) / `state.error` (React, Svelte) holds the rejection, and resets to `null` on
  the next successful load or on `close()`.
- `MentionInput` renders a `#error` slot. Default content:

```html
<div class="mentionly-error" role="alert">Failed to load suggestions.</div>
```

A failed first page clears the list; a failed subsequent page keeps the loaded items and
`hasMore` so the user can retry.

**How to change it**

Nothing is required. To show your own message:

```vue
<MentionInput :triggers="triggers">
  <template #error="{ error }">Could not load suggestions: {{ error }}</template>
</MentionInput>
```

## 10. New: `ids` for a11y wiring

**What changed**

Every adapter now exposes `ids: { listbox: string; option(index: number): string }`. Use them on
the listbox root and each option; the core writes `aria-controls` / `aria-activedescendant` on
the editor pointing at them. `MentionInput` also exposes `ids` on its template ref.

**How to change it**

Headless users should adopt `ids` (the built-in Vue `MentionList` already does).

```vue
<!-- before: ids were not available -->
<ul role="listbox">

<!-- 2.0 -->
<ul :id="ids.listbox" role="listbox">
  <li v-for="(item, i) in filteredItems" :id="ids.option(i)" :key="item.id" role="option">…</li>
</ul>
```

## 11. New: changing `triggers` closes the list and aborts requests

**What changed**

`MentionCore.setOptions()` now compares the `triggers` reference; when it changes, the core closes
and clears the list and invalidates all in-flight data source requests. Previously the popup
stayed open on the previous config's results, and a response that was already in flight could
still land there.

All adapters go through this path:

- **Vue** — the `useMention` watcher on `triggers` / `insertSpaceAfter` / `popupMode` /
  `popupScrollBehavior` calls `setOptions`.
- **React** — `useMention` diffs the same fields per render and warns in development when
  `triggers` changes on 3 renders in a row.
- **Svelte** — `setOptions` is returned from `createMention()` and must be called when a prop
  changes.

**How to change it**

Keep the `triggers` reference stable across renders/updates.

```tsx
// React — ❌ a new array on every render closes the popup and aborts requests
<MentionInput triggers={[{ char: '@', items: USERS }]} />

// React — ✅ module-level constant or useMemo
const TRIGGERS: MentionTrigger[] = [{ char: '@', items: USERS }]
<MentionInput triggers={TRIGGERS} />
```

```svelte
<!-- Svelte — the reference only changes when the prop does -->
<script lang="ts">
  let { triggers }: { triggers: MentionTrigger[] } = $props()
  const mention = createMention({ triggers })
  $effect(() => { mention.setOptions({ triggers }) })
</script>
```

Development warning text:

```
[mentionly/react] `triggers` changed on every render. This closes the popup and aborts in-flight
requests. Pass a stable reference: a module-level constant or useMemo().
```

## 12. `allowMidWord` boundary rule (introduced in 1.2.1)

**What changed**

Since 1.2.1 the trigger is only detected at a word boundary: when the character right before the
trigger matches `/\w/` (ASCII letter, digit or underscore) and `allowMidWord` is not set, the
trigger is ignored. This stops `a@b.com` from opening the mention list. The start of the text
node, whitespace, non-breaking spaces, CJK characters and punctuation still trigger normally.

If you are upgrading from an older 1.x release, this may already be a behaviour change you have
not accounted for.

**How to change it**

Keep the default unless you need the old "trigger anywhere" behaviour:

```ts
// 2.0 default — `a@b.com` stays an email
{ char: '@', items: users }

// opt back into the pre-1.2.1 behaviour
{ char: '@', items: users, allowMidWord: true }
```

## What did not change

- `MentionTrigger` fields `char`, `mode`, `items`, `pagination`, `debounce`, `onSelect`.
- The dropdown keyboard handling: ↑ / ↓ wrap around, Enter / Tab select, Escape closes, and IME
  composition is left to the browser.
- `MentionInput` props `placeholder`, `disabled`, `maxHeight`, `submitOnEnter`, `onEnter`,
  `popupMode`, `popupScrollBehavior`, `teleport`, and all slots except the new `#error`.
- `useMention()`'s Vue return shape (`editorRef`, `isOpen`, `filteredItems`, …) — including
  `isEmpty`, which stays a computed ref.
- `insertMention()`'s second argument and the `mentionly/style.css` entry point.
