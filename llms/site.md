# mentionly

> Mention input for AI chat composers. A framework-agnostic engine, `@mentionly/core`, turns a contenteditable element into an editor with atomic mention entities, async and paginated suggestion sources, IME-safe keyboard handling, and one serializable output format (`Part[]`). Adapters: Vue 3 (`mentionly`, with ready-made components), React (`@mentionly/react`, headless hook), Svelte 5 (`@mentionly/svelte`, headless).

When you work inside a project that already depends on mentionly, read the `llms.txt` shipped in the installed package instead (`node_modules/mentionly/llms.txt` or `node_modules/@mentionly/<name>/llms.txt`): it matches the installed version.

{{notes.md}}

## Docs

- [Full documentation in one file](https://im0o.top/mentionly/llms-full.txt): every package README, the migration guide, these notes, and the complete React and Svelte example components.
- [Migration guide 1.x → 2.0](https://raw.githubusercontent.com/jz0ojiang/mentionly/main/MIGRATION.md)
- [mentionly / @mentionly/vue README](https://raw.githubusercontent.com/jz0ojiang/mentionly/main/packages/vue/README.md)
- [@mentionly/react README](https://raw.githubusercontent.com/jz0ojiang/mentionly/main/packages/react/README.md)
- [@mentionly/svelte README](https://raw.githubusercontent.com/jz0ojiang/mentionly/main/packages/svelte/README.md)
- [@mentionly/core README](https://raw.githubusercontent.com/jz0ojiang/mentionly/main/packages/core/README.md)

## Examples

- [React composer to copy](https://raw.githubusercontent.com/jz0ojiang/mentionly/main/examples/react/src/MentionInput.tsx): list, pagination, render props, imperative handle.
- [Svelte composer to copy](https://raw.githubusercontent.com/jz0ojiang/mentionly/main/examples/svelte/src/MentionInput.svelte): the same composer with snippets.

## Optional

- [Playground: Vue](https://im0o.top/mentionly/), [React](https://im0o.top/mentionly/react/), [Svelte](https://im0o.top/mentionly/svelte/)
- [Repository](https://github.com/jz0ojiang/mentionly)
