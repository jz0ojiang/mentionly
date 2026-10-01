# @mentionly/vue

## 2.0.0-next.0

### Major Changes

- 5b6dbb5: mentionly 2.0 — one framework-agnostic engine plus three adapters.
  
  - **New `@mentionly/core`**: the framework-agnostic engine (triggers, async and paginated data
    sources, DOM serialization, keyboard and IME handling) that the adapters share. It also adds
    the `@mentionly/core/ai-sdk` and `@mentionly/core/mcp` converters.
  - **New `@mentionly/react`** (headless `useMention` hook) and **`@mentionly/svelte`** (Svelte 5
    `createMention()` + `use:mention`). `@mentionly/vue` is now a thin adapter over the core and
    keeps its component API, and `mentionly` stays a forwarding package for it.
  - **New content format**: `getParts()` returns `Part[]` (`TextPart | MentionPart`) instead of
    `ContentPart[]`, and `MentionInput`'s `submit` / `change` events now carry `Part[]`. The
    mention payload is produced by `MentionTrigger.toData(item)` and read back as `data`;
    `dataPart`, `schema`, `getDataParts()`, `DataPart` and `ContentPart` still work but are
    deprecated and will be removed in 3.0.
  - **New `error` state and `#error` slot** for failed data sources, plus `ids` for combobox a11y
    wiring. `MentionList` gained a required `ids` prop, and changing `triggers` now closes the
    dropdown and aborts in-flight requests.
  - The editor's `role="textbox"` / `aria-multiline` are gone: the core sets and maintains
    `role="combobox"` with `aria-controls` / `aria-activedescendant`.
  
  See [MIGRATION.md](https://github.com/jz0ojiang/mentionly/blob/main/MIGRATION.md) for every
  change with before/after code.

### Patch Changes

- Updated dependencies [5b6dbb5]
  - @mentionly/core@2.0.0-next.0
