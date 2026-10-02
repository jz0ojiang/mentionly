## Setup

Install one adapter per framework. Every adapter depends on `@mentionly/core` and re-exports its types (`Part`, `MentionTrigger`, `MentionItem`, …), so import types from the adapter you installed.

| Framework | Install | Peer |
|---|---|---|
| Vue 3 | `npm i mentionly` (recommended). `@mentionly/vue` is the same code under a scoped name; import components and `style.css` from the package you installed | `vue ^3.3` |
| React | `npm i @mentionly/react` | `react >=18` |
| Svelte 5 | `npm i @mentionly/svelte` | `svelte ^5` |
| Plain DOM, or server-side conversion only | `npm i @mentionly/core` | none |

The converters `@mentionly/core/ai-sdk` and `@mentionly/core/mcp` live in `@mentionly/core`, which every adapter already installs.

A trigger, an item, and what a selected mention produces:

```ts
import type { MentionTrigger } from '@mentionly/react' // or mentionly, @mentionly/svelte, @mentionly/core

const users = [{ id: 'u1', label: 'Alice', uri: 'user://alice' }]

const triggers: MentionTrigger[] = [
  {
    char: '@',                                // the trigger character
    items: users,                             // or (query, page?) => items | Promise<items>
    toData: (item) => ({ uri: item.uri }),    // called on selection with the full item
  },
]

// After the user types "hi @" and picks Alice, getParts() returns:
// [
//   { type: 'text', text: 'hi ' },
//   { type: 'mention', trigger: '@', id: 'u1', label: 'Alice', data: { uri: 'user://alice' } },
// ]
```

```ts
interface MentionItem { id: string; label: string; [key: string]: any } // id and label become the mention's id and label

interface MentionTrigger {
  char: string                       // '@', '#', '/', '$', …
  items: MentionItem[]
    | ((query: string, page?: { offset: number; limit: number }) =>
        MentionItem[] | { items: MentionItem[]; hasMore?: boolean }
        | Promise<MentionItem[] | { items: MentionItem[]; hasMore?: boolean }>)
  toData?: (item: MentionItem) => unknown   // becomes MentionPart.data
  pagination?: { pageSize: number }         // enables paging; a bare array result infers hasMore from length >= limit
  debounce?: number                         // ms before calling an async items function, default 0
  mode?: 'inline' | 'command'               // 'command': run onSelect(item) and remove the typed text instead of inserting a mention
  onSelect?: (item: MentionItem) => void    // command mode only
  allowMidWord?: boolean                    // default false, see Triggers below
}

type Part<T = unknown> =
  | { type: 'text'; text: string }
  | { type: 'mention'; trigger: string; id: string; label: string; data?: T }
```

Shared options for every adapter (`useMention`, `createMention`, `new MentionCore`):

```ts
{ triggers: MentionTrigger[]; insertSpaceAfter?: boolean /* default true: add a space after an inserted mention */;
  popupMode?: 'fixed' | 'cursor' /* default 'fixed' */; popupScrollBehavior?: 'reposition' | 'close' | 'ignore' }
```

## Content

- Read content with `getParts()` and restore it with `setContent(parts)`. `Part[]` is the format to store and to restore drafts from; converters below turn it into transport formats (AI SDK, MCP). `setContent(getParts())` restores the same text and mentions, with whitespace normalized as described below.
- `getParts()` returns `Part[]` with `data: unknown`. Narrow it with a type guard or `as Part<{ uri: string }>[]` when you need typed `data`.
- Put everything the backend needs about a mention into the trigger's `toData(item)`. It runs when the user selects the item and receives the full item, so fields such as `uri` reach the output.
- Edit the editor only through the API: `insertMention({ id, label, trigger?, data? })`, `setContent`, `clear`, `focus`. The core owns the contenteditable DOM and inserts through `document.execCommand`, so edits stay on the browser undo stack.
- `getParts()` trims leading and trailing whitespace, merges adjacent text, and turns non-breaking spaces into regular spaces.

## Triggers

- A trigger opens the list at the start of the text, after whitespace, after punctuation, or after non-ASCII text such as `你好@`. After an ASCII letter, digit or underscore (`a@b.com`) it stays closed; `allowMidWord: true` opens it everywhere.
- An `items` array is filtered by the core: case-insensitive substring match on `label`. An `items` function receives the typed `query` and returns already-filtered results. `state.filteredItems` is always the final list to render.
- With `pagination`, the `items` function receives `page = { offset, limit }` as its second argument and may return `{ items, hasMore }`.

## Keyboard

- While the list is open and has items, the core handles ArrowUp / ArrowDown (move), Enter and Tab (select the active item) and Escape (close), and calls `preventDefault()` on those events. In every other case (list closed, or open but empty) the event passes through untouched.
- The core listens on the editor element itself (bubbling phase), so your own keydown handler on that element or an ancestor runs after it. The headless adapters have no submit option: implement Enter-to-submit yourself.
- So: submit on Enter when the event was not already handled. React: check `e.nativeEvent.defaultPrevented` (React's synthetic `e.defaultPrevented` does not see the core's native handling). Svelte, Vue and plain DOM listen to native events: check `e.defaultPrevented`.

## Rendering your own list (React, Svelte, Vue `useMention`, plain `MentionCore`)

- State to render from: `isOpen`, `filteredItems`, `activeIndex`, `query`, `activeTrigger`, `loading`, `loadingMore`, `hasMore`, `error`, `isEmpty`, `popupPosition`.
- `ids` is `{ listbox: string; option(index: number): string }`. Give the list element `id={ids.listbox}` and `role="listbox"`, and each option `id={ids.option(index)}`, `role="option"` and `aria-selected`. The core sets `role="combobox"` and the `aria-*` wiring on the editor element, so the editor needs no `role`.
- Select with `select(item)` (it takes the item, not an index). Call `preventDefault()` in each option's `mousedown` handler and `select(item)` on click: the editor keeps focus, and the list stays open until the selection lands.
- Position the list with `popupPosition = { top, left, width? }`: numbers in px, viewport coordinates for `position: fixed`, `{ top: 0, left: 0 }` until the list first opens; add `transform: translateY(-100%)` to place it above. In `'fixed'` mode the coordinates are the editor's top-left and `width` is the editor's width; in `'cursor'` mode they follow the caret.
- Pagination: call `loadMore()` when the list scrolls near its bottom, and also right after a page renders while `hasMore` is true and the list's `scrollHeight <= clientHeight` (a first page that does not overflow never scrolls).
- Placeholder: the core renders none. Set `data-placeholder="…"` on the editor and style `[contenteditable]:empty::before { content: attr(data-placeholder) }`, or show your own element while `isEmpty` is true.

## Framework specifics

- React: `const { ref, state, ids, select, getParts, … } = useMention({ triggers })`. State fields live under `state` (`state.isOpen`, `state.filteredItems`, …). Keep `triggers` referentially stable (module-level constant or `useMemo`): a new array reference makes the hook call `setOptions`, which closes the list and drops in-flight requests, and development builds warn after three such renders. Attach `ref` to the contenteditable element and render no React children inside it.
- Svelte: inside a component's `<script>`, `const m = createMention({ triggers })`; bind the editor with `<div contenteditable use:m.mention></div>` (the action takes no arguments); read `m.state.isOpen`, `m.state.filteredItems`, … directly in markup, they are reactive. Options are read once: call `m.setOptions({ triggers })` when they change.
- Vue, ready-made: `<MentionInput :triggers="triggers" @submit="onSubmit" />` with `import 'mentionly/style.css'`; `submit` and `change` emit `Part[]`. `MentionInput` always adds the space after a mention; `insertSpaceAfter` is available through `useMention`.
- Vue, headless: `const { editorRef, handlers, isOpen, filteredItems, ids, select, getParts, … } = useMention({ triggers })`. Unlike React, each state field is a top-level ref, then `<div ref="editorRef" contenteditable v-on="handlers" />`. `MentionList` renders a list from props `items`, `activeIndex`, `loading`, `query`, `ids`, `hasMore`, `loadingMore` and emits `select(item)` and `load-more`.
- Plain DOM: `const core = new MentionCore({ triggers })`, `core.attach(editorEl)`; read `core.getState()` and `core.subscribe(listener)` (synchronous; returns an unsubscribe function). Tear down with `core.stop()` and `core.setElement(null)`.

## Sending to an LLM

Vercel AI SDK: `toUIMessageParts` turns `Part[]` into UI message parts. It has no DOM dependency, so it runs on the client or the server. On the server, turn mentions into model-readable parts, because `convertToModelMessages` drops data parts in user messages by default.

```ts
// payload of a data-mention part
type MentionDataPayload<T = unknown> = { trigger: string; id: string; label: string; data?: T } // data = toData() output
```

```ts
// client
import { toUIMessageParts } from '@mentionly/core/ai-sdk'
const parts = toUIMessageParts(getParts())
// text → { type: 'text', text }
// mention → { type: 'data-mention', data: { trigger, id, label, data } }
sendMessage({ parts })               // AI SDK useChat

// server
import { convertToModelMessages, type UIMessage } from 'ai'
import type { MentionDataPayload } from '@mentionly/core/ai-sdk'
type Msg = UIMessage<unknown, { mention: MentionDataPayload }>
const modelMessages = await convertToModelMessages<Msg>(messages, {
  convertDataPart: (part) =>
    part.type === 'data-mention'
      ? { type: 'text', text: `@${part.data.label} ${JSON.stringify(part.data.data ?? {})}` } // part.data.data is the toData() output, e.g. { uri }
      : undefined,                    // undefined drops the part
})
```

`fromUIMessageParts(uiParts)` converts back to `Part[]` (other part types are skipped). `toUIMessageParts(parts, { dataPartName: 'ref' })` emits `data-ref` instead of `data-mention`; then use `{ ref: MentionDataPayload }` in the `UIMessage` type and check `part.type === 'data-ref'`.

To build the message on the server from a stored `Part[]`: `{ id: crypto.randomUUID(), role: 'user', parts: toUIMessageParts(parts) }` is a valid `UIMessage`.

MCP: `toMCPContent(parts)` from `@mentionly/core/mcp` synchronously returns an array of content blocks (runs anywhere, no DOM):

```ts
// text → { type: 'text', text }
// mention whose data.uri is a string → { type: 'resource_link', uri, name: label, mimeType? }
// any other mention → text `${trigger}${label}`; adjacent text blocks are merged
// getUri replaces the default data.uri lookup; returning undefined turns that mention into text
toMCPContent(parts, {
  getUri: (mention) => (mention.data as { fileUrl?: string } | undefined)?.fileUrl,
  getMimeType: () => 'text/markdown',
})
```

## 1.x API (Vue and core only)

Code written for mentionly 1.x uses `dataPart` or `schema` on triggers, `getDataParts()`, the types `DataPart` and `ContentPart`, and `insertMention({ triggeredBy, dataPart })`. These still work in 2.x and are removed in 3.0. Write new code with `toData`, `getParts()`, `Part` and `insertMention({ id, label, trigger, data })`; see the migration guide to convert existing code.
