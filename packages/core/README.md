# @mentionly/core

Framework-agnostic engine behind [mentionly](https://github.com/jz0ojiang/mentionly): a
`contenteditable` mention input with atomic mention entities, async and paginated data sources,
IME handling and DOM serialization.

No framework, no runtime dependencies — it only talks to the browser DOM (`HTMLElement`,
`document`, `window`, `Selection`, `Range`, `execCommand`). The constructor touches no DOM, so
importing and constructing are SSR-safe.

Vue, React and Svelte users normally install the matching adapter instead:
[`@mentionly/vue`](https://www.npmjs.com/package/@mentionly/vue),
[`@mentionly/react`](https://www.npmjs.com/package/@mentionly/react),
[`@mentionly/svelte`](https://www.npmjs.com/package/@mentionly/svelte), or the forwarding
[`mentionly`](https://www.npmjs.com/package/mentionly) package.


> **For AI agents:** this package ships `llms.txt` (`node_modules/@mentionly/core/llms.txt`) with setup and integration rules for its installed version. Site-wide docs: [llms.txt](https://im0o.top/mentionly/llms.txt), [llms-full.txt](https://im0o.top/mentionly/llms-full.txt).

## Install

```bash
npm install @mentionly/core
```

## Usage

```ts
import { MentionCore } from '@mentionly/core'

const core = new MentionCore({
  triggers: [
    {
      char: '@',
      items: [
        { id: 'u1', label: 'Alice' },
        { id: 'u2', label: 'Bob' },
      ],
      toData: (item) => ({ kind: 'user', userId: item.id }),
    },
  ],
})

// Attach the editor element; `attach()` also binds the input/keyboard/IME handlers
core.attach(document.querySelector('[contenteditable]'))

core.subscribe((state) => render(state))
core.getParts() // [{ type: 'mention', trigger: '@', id: 'u1', label: 'Alice', data: { … } }]
```

## API

### `new MentionCore(options)`

| Option | Type | Description |
|--------|------|-------------|
| `triggers` | `MentionTrigger[]` | Trigger configs (`char`, `mode`, `items`, `pagination`, `debounce`, `toData`, `onSelect`) |
| `insertSpaceAfter` | `boolean` | Insert a non-breaking space after a mention, default `true` |
| `popupMode` | `'fixed' \| 'cursor'` | Popup positioning mode, default `'fixed'` |
| `popupScrollBehavior` | `'reposition' \| 'close' \| 'ignore'` | Popup behaviour on scroll, default `'reposition'` |

### Lifecycle

| Member | Description |
|--------|-------------|
| `setElement(el \| null)` | Bind/unbind the editor element. Idempotent |
| `start({ bindHandlers? })` | Attach viewport listeners (and, by default, the DOM handlers) once |
| `attach(el, opts?)` | `setElement(el)` + `start(opts)` |
| `stop()` | Tear down listeners, timers and handlers |
| `setOptions(partial)` | Merge options; a changed `triggers` reference closes the list and aborts in-flight requests |

### State

`getState()` returns an immutable snapshot and `subscribe(fn)` notifies **synchronously**. The
snapshot keeps the same reference while nothing changed:

```ts
interface MentionState {
  isOpen: boolean
  filteredItems: MentionItem[]
  activeIndex: number
  query: string
  activeTrigger: string | null
  loading: boolean
  error: unknown | null
  loadingMore: boolean
  hasMore: boolean
  popupPosition: PopupPosition
  isEmpty: boolean
}
```

`core.ids` provides the a11y ids (`ids.listbox`, `ids.option(index)`) that the core wires into
the editor's `aria-controls` / `aria-activedescendant` / `role="combobox"`.

### Methods

| Member | Description |
|--------|-------------|
| `select(item)` | Select a candidate (inline insert or command-mode callback) |
| `insertMention(payload, opts?)` | Insert an atomic mention node programmatically |
| `loadMore()` | Append the next page (paginated function sources only) |
| `close()` | Close the popup and abort in-flight requests |
| `getParts()` | Read the editor into `Part[]` (merged, trimmed, NBSP normalized) |
| `getDataParts()` | **Deprecated** (3.0) — 1.x `DataPart[]` output |
| `getPlainText()` | Editor content as plain text |
| `clear()` | Empty the editor |
| `setContent(parts)` | Restore the editor from `Part[]` (or legacy `ContentPart[]`) |
| `focus()` | Focus the editor and move the caret to the end |
| `handlers` | DOM handlers keyed by event name, for adapters that bind them themselves |

### Content format

```ts
type Part<T = unknown> = TextPart | MentionPart<T>

interface TextPart { type: 'text'; text: string }

interface MentionPart<T = unknown> {
  type: 'mention'
  trigger: string
  id: string
  label: string
  data?: T
}
```

`toData(item)` runs when an item is selected and its result is persisted on the mention node, so
`getParts()` can return it as `data` later.

## Converter subpaths

Both subpaths use structural types, so the core stays dependency-free.

### `@mentionly/core/ai-sdk`

```ts
import { toUIMessageParts, fromUIMessageParts } from '@mentionly/core/ai-sdk'

const uiParts = toUIMessageParts(core.getParts())
// [{ type: 'text', text: 'hi ' },
//  { type: 'data-mention', data: { trigger: '@', id: 'u1', label: 'Alice' } }]
```

AI SDK's `convertToModelMessages` drops data parts by default — pass `convertDataPart` on the
server so the model can read the mentions (see the JSDoc in `src/ai-sdk.ts` for a full example).

### `@mentionly/core/mcp`

```ts
import { toMCPContent } from '@mentionly/core/mcp'

toMCPContent(core.getParts())
// [{ type: 'text', text: 'see ' },
//  { type: 'resource_link', uri: 'file:///a.ts', name: 'a.ts' }]
```

Mentions whose data carries a string `uri` become `resource_link` blocks; the rest degrade to
text. Override extraction with `getUri` / `getMimeType`.

## Documentation

- [Root README](https://github.com/jz0ojiang/mentionly/blob/main/README.md)
- [Migration guide (1.x → 2.0)](https://github.com/jz0ojiang/mentionly/blob/main/MIGRATION.md)
- [Live demo](https://im0o.top/mentionly)

## License

[MIT](https://github.com/jz0ojiang/mentionly/blob/main/LICENSE)
