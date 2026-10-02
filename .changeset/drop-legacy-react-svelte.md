---
"@mentionly/react": patch
"@mentionly/svelte": patch
---

Remove the 1.x compatibility API from the React and Svelte adapters before 2.0.0.

`@mentionly/react` and `@mentionly/svelte` are new in 2.0 and never had a 1.x release, so they no
longer expose the legacy `getDataParts()` method or the `DataPart` / `ContentPart` types, and
`setContent()` is typed as `(parts: Part[]) => void`. `@mentionly/core` and `@mentionly/vue`
still provide the deprecated 1.x APIs for Vue users migrating from 1.x.
