# mentionly {{version}} (Vue 3)

> Mention input for AI chat composers, for Vue 3. `mentionly` re-exports `@mentionly/vue`: both names give the same API.

Exports: {{exports}}

`MentionInput`:
- props: `triggers`, `placeholder`, `disabled`, `maxHeight` (default `'200px'`), `submitOnEnter` (default `true`), `onEnter(e)` (call `e.preventDefault()` to block the submit), `popupMode` (default `'fixed'`), `popupScrollBehavior` (default `'reposition'`), `teleport` (default `true`).
- events: `submit(parts: Part[])` (the input clears itself afterwards), `change(parts: Part[])`.
- slots: default and `actions` / `inner-actions` (`{ submit, clear, isEmpty }`, the default slot also gets `focus` and `getParts`), `item` (`{ item, active, select }`), `list` (`{ items, activeIndex, select, loading, hasMore, loadingMore, loadMore, ids }`), `empty` (`{ query }`), `loading`, `loading-more`, `error` (`{ error }`).
- ref methods: `getParts`, `setContent`, `insertMention`, `clear`, `focus`, `getPlainText`, `getDataParts` (1.x), and `ids`.
- styles: `import 'mentionly/style.css'` (or `@mentionly/vue/style.css`).
