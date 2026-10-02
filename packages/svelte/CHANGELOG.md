# @mentionly/svelte

## 2.0.0

### Major Changes

- 5b6dbb5: mentionly 2.0 — one framework-agnostic engine plus three adapters.
  
  - **New `@mentionly/core`**: the framework-agnostic engine (triggers, async and paginated data
    sources, DOM serialization, keyboard and IME handling) that the adapters share. It also adds
    the `@mentionly/core/ai-sdk` and `@mentionly/core/mcp` converters.
  - **New `@mentionly/react`** (headless `useMention` hook) and **`@mentionly/svelte`** (Svelte 5
    `createMention()` + `use:mention`). `@mentionly/vue` is now a thin adapter over the core and
    keeps its component API, and `mentionly` stays a forwarding package for it.
  - **New content format**: `getParts()` returns `Part[]` (`TextPart | MentionPart`), with the
    mention payload produced by `MentionTrigger.toData(item)` and read back as `data`. As a new
    2.0 package, `@mentionly/svelte` has no 1.x compatibility API: `setContent()` accepts `Part[]`
    only. The deprecated 1.x mapping APIs live in `@mentionly/core` and `@mentionly/vue` and are
    removed in 3.0.
  - **New `error` state and `#error` slot** for failed data sources, plus `ids` for combobox a11y
    wiring. `MentionList` gained a required `ids` prop, and changing `triggers` now closes the
    dropdown and aborts in-flight requests.
  - The editor's `role="textbox"` / `aria-multiline` are gone: the core sets and maintains
    `role="combobox"` with `aria-controls` / `aria-activedescendant`.
  
  See [MIGRATION.md](https://github.com/jz0ojiang/mentionly/blob/main/MIGRATION.md) for every
  change with before/after code.

### Patch Changes

- 2867051: Remove the 1.x compatibility API from the React and Svelte adapters before 2.0.0.
  
  `@mentionly/react` and `@mentionly/svelte` are new in 2.0 and never had a 1.x release, so they no
  longer expose the legacy `getDataParts()` method or the `DataPart` / `ContentPart` types, and
  `setContent()` is typed as `(parts: Part[]) => void`. `@mentionly/core` and `@mentionly/vue`
  still provide the deprecated 1.x APIs for Vue users migrating from 1.x.
- Updated dependencies [5b6dbb5]
  - @mentionly/core@2.0.0

## 2.0.0-next.0

### Major Changes

- 5b6dbb5: mentionly 2.0 — one framework-agnostic engine plus three adapters.
  
  - **New `@mentionly/core`**: the framework-agnostic engine (triggers, async and paginated data
    sources, DOM serialization, keyboard and IME handling) that the adapters share. It also adds
    the `@mentionly/core/ai-sdk` and `@mentionly/core/mcp` converters.
  - **New `@mentionly/react`** (headless `useMention` hook) and **`@mentionly/svelte`** (Svelte 5
    `createMention()` + `use:mention`). `@mentionly/vue` is now a thin adapter over the core and
    keeps its component API, and `mentionly` stays a forwarding package for it.
  - **New content format**: `getParts()` returns `Part[]` (`TextPart | MentionPart`). As a new 2.0
    package, `@mentionly/svelte` has no 1.x compatibility API: `setContent()` accepts `Part[]`
    only. The deprecated 1.x mapping APIs live in `@mentionly/core` and `@mentionly/vue` and are
    removed in 3.0.
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
