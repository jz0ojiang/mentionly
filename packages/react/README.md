# @mentionly/react

Headless React hook for [mentionly](https://github.com/jz0ojiang/mentionly): a `contenteditable`
mention input for AI chat scenarios, with atomic mention entities, async and paginated data
sources, IME handling and serialization.

`useMention()` wraps the framework-agnostic
[`@mentionly/core`](https://www.npmjs.com/package/@mentionly/core) engine in
`useSyncExternalStore`, reads its immutable snapshot, and lets the core own the editor DOM and its
events. There are no published components — you render the editor and the dropdown.

React (`>=18`) is a peer dependency; `@mentionly/core` is installed automatically.

## Install

```bash
npm install @mentionly/react
```

A complete, copyable component (keyboard submit, scroll-into-view, pagination, error state) lives
in
[`examples/react/src/MentionInput.tsx`](https://github.com/jz0ojiang/mentionly/blob/main/examples/react/src/MentionInput.tsx).

## Usage

```tsx
import { useMemo } from 'react'
import { useMention } from '@mentionly/react'
import type { MentionTrigger, Part } from '@mentionly/react'

const USERS = [
  { id: 'u1', label: 'Alice' },
  { id: 'u2', label: 'Bob' },
]

export function Composer({ onSubmit }: { onSubmit: (parts: Part[]) => void }) {
  // ⚠ `triggers` must keep a stable reference: a module-level constant or useMemo().
  // A new array on every render makes the hook call setOptions(), which closes the popup
  // and invalidates in-flight requests. Development builds warn after 3 such renders.
  const triggers = useMemo<MentionTrigger[]>(
    () => [{ char: '@', items: USERS, toData: (item) => ({ kind: 'user', userId: item.id }) }],
    [],
  )

  const { ref, state, ids, core, select, getParts, clear } = useMention({ triggers })

  return (
    <>
      {/* core owns everything inside this element — do not render React children into it */}
      <div ref={ref} contentEditable data-placeholder="Type @ to mention" />

      {state.isOpen && (
        <ul id={ids.listbox} role="listbox">
          {state.filteredItems.map((item, index) => (
            <li
              key={item.id}
              id={ids.option(index)}
              role="option"
              aria-selected={index === state.activeIndex}
              // preventDefault keeps focus in the editor, otherwise blur closes the list
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={core.getState().isEmpty}
        onClick={() => {
          onSubmit(getParts())
          clear()
        }}
      >
        Send
      </button>
    </>
  )
}
```

## API

### `useMention(options: MentionCoreOptions)`

| Member | Description |
|--------|-------------|
| `ref` | Callback ref for the editor element. Attaches on mount, detaches on unmount (StrictMode-safe) |
| `state` | The core snapshot: `isOpen`, `filteredItems`, `activeIndex`, `query`, `activeTrigger`, `loading`, `error`, `loadingMore`, `hasMore`, `popupPosition`, `isEmpty` |
| `ids` | `{ listbox, option(index) }` — required on the dropdown root and options |
| `core` | The underlying `MentionCore` instance |
| `select(item)` | Select a candidate |
| `insertMention(payload, opts?)` | Insert an atomic mention node programmatically |
| `loadMore()` | Append the next page (paginated function sources) |
| `close()` | Close the popup and abort in-flight requests |
| `getParts()` | Read the editor into `Part[]` |
| `getDataParts()` | **Deprecated** (3.0) — 1.x `DataPart[]` output |
| `getPlainText()` | Editor content as plain text |
| `clear()` | Empty the editor |
| `setContent(parts)` | Restore from `Part[]` (or legacy `ContentPart[]`) |
| `focus()` | Focus the editor, caret at the end |

Options are diffed per render (`triggers`, `insertSpaceAfter`, `popupMode`,
`popupScrollBehavior`) and only written back to the core when they actually change.

### Things to know

1. **Keep `triggers` referentially stable.** A new array on every render triggers
   `setOptions()`, which closes the list and aborts in-flight requests. Use a module-level
   constant or `useMemo()`; development builds warn once after 3 consecutive renders with a
   changing reference.
2. **Never render React children into the editor element.** The core mutates that DOM directly
   (mention spans, caret). For a placeholder use `data-placeholder` plus `:empty::before` in CSS.
3. **Don't implement keyboard navigation.** ↑ / ↓ / Enter / Tab / Escape and IME composition are
   handled by the core; read `state.isOpen` / `core.getState()` in your own `keydown` only to
   decide when Enter should submit.

## Content format

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

`toData(item)` runs at selection time and its result is persisted on the mention node, so
`getParts()` can return it as `data` later without keeping the original item around.

## Documentation

- [Root README](https://github.com/jz0ojiang/mentionly/blob/main/README.md)
- [Migration guide (1.x → 2.0)](https://github.com/jz0ojiang/mentionly/blob/main/MIGRATION.md)
- [Live demo](https://im0o.top/mentionly)

## License

[MIT](https://github.com/jz0ojiang/mentionly/blob/main/LICENSE)
