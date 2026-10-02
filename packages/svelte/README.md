# @mentionly/svelte

Svelte 5 headless adapter for [mentionly](https://github.com/jz0ojiang/mentionly): a
`contenteditable` mention input for AI chat scenarios, with atomic mention entities, async and
paginated data sources, IME handling and serialization.

`createMention()` wraps the framework-agnostic
[`@mentionly/core`](https://www.npmjs.com/package/@mentionly/core) engine: it mirrors the core
snapshot into `$state` and returns the `use:mention` action that binds and unbinds the editor
element. There are no published components — you render the editor and the dropdown.

Svelte 5 (runes) is a peer dependency; `@mentionly/core` is installed automatically.

## Install

```bash
npm install @mentionly/svelte
```

A complete, copyable component lives in
[`examples/svelte/src/MentionInput.svelte`](https://github.com/jz0ojiang/mentionly/blob/main/examples/svelte/src/MentionInput.svelte).

## Usage

```svelte
<script lang="ts">
  import { createMention } from '@mentionly/svelte'

  const USERS = [
    { id: 'u1', label: 'Alice' },
    { id: 'u2', label: 'Bob' },
  ]

  const mention = createMention({
    triggers: [{ char: '@', items: USERS, toData: (item) => ({ kind: 'user', userId: item.id }) }],
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

### Reactive props

`createMention()` reads its options once. When a prop that affects the core changes, mirror it
back with `setOptions()`:

```svelte
<script lang="ts">
  let { triggers }: { triggers: MentionTrigger[] } = $props()

  const mention = createMention({ triggers })

  // a changed `triggers` reference closes the list and aborts in-flight requests
  $effect(() => {
    mention.setOptions({ triggers })
  })
</script>
```

## Building your own list

The list UI is yours, so two details the Vue component handles internally are your job:

- **Select on click without losing focus.** Call `preventDefault()` on the option's `mousedown`
  (then select in `click`, or select directly in `mousedown`). Otherwise the editor blurs first,
  the core closes the list on blur, and the click selects nothing.
- **Fill the first page.** Paginated sources load the next page when the list scrolls near its
  bottom. If the first page does not overflow the list, it can never scroll, so call `loadMore()`
  yourself when `hasMore` is true and the list's `scrollHeight <= clientHeight` (or render a
  "Load more" button).

The examples in the repository implement both.

## API

### `createMention(options: MentionCoreOptions)`

| Member | Description |
|--------|-------------|
| `state` | Reactive `$state` mirror of the core snapshot: `isOpen`, `filteredItems`, `activeIndex`, `query`, `activeTrigger`, `loading`, `error`, `loadingMore`, `hasMore`, `popupPosition`, `isEmpty` |
| `ids` | `{ listbox, option(index) }` — required on the dropdown root and options |
| `mention` | The action: `<div contenteditable use:mention.mention></div>` — binds the element, subscribes to the core, and cleans both up on destroy |
| `core` | The underlying `MentionCore` instance |
| `setOptions(partial)` | Merge options; a changed `triggers` reference closes the list and aborts in-flight requests |
| `select(item)` | Select a candidate |
| `insertMention(payload, opts?)` | Insert an atomic mention node programmatically |
| `loadMore()` | Append the next page (paginated function sources) |
| `close()` | Close the popup and abort in-flight requests |
| `getParts()` | Read the editor into `Part[]` |
| `getPlainText()` | Editor content as plain text |
| `clear()` | Empty the editor |
| `setContent(parts)` | Restore from `Part[]` |
| `focus()` | Focus the editor, caret at the end |

### Things to know

1. **Render the listbox with `ids`.** `mention.ids.listbox` on the root, `mention.ids.option(i)`
   on each option; the core writes `aria-controls` / `aria-activedescendant` on the editor.
2. **Never render Svelte children into the editor element.** The core mutates that DOM directly
   (mention spans, caret). For a placeholder use `data-placeholder` plus `:empty::before` in CSS.
3. **Don't implement keyboard navigation.** ↑ / ↓ / Enter / Tab / Escape and IME composition are
   handled by the core.

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
