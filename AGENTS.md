# AGENTS.md

Guidance for AI coding agents and human contributors working in this repository.

## What this is

`mentionly` — a lightweight Vue 3 mention input component for AI chat scenarios. A
`contenteditable` editor with atomic mention entities, async and paginated data sources, IME
handling, and serialization. Zero runtime dependencies; Vue 3 is a peer dependency. English
docs: `README.md`, Chinese docs: `README.zh.md`.

The repo is a **bun workspaces monorepo** with three publishable packages plus a local demo:

- `@mentionly/core` — framework-agnostic engine (no Vue, browser DOM only).
- `@mentionly/vue` — thin Vue 3 adapter and ready-to-use components.
- `mentionly` — forwarding package: re-exports `@mentionly/vue` and ships `mentionly/style.css`.

## Toolchain

Use **bun** only — the repo has `bun.lock` and no other lockfile. The build is Vite (with
`vite-plugin-dts`) and the tests are Vitest on jsdom; do not "simplify" this to Bun's built-in
bundler or test runner.

Root scripts fan out across packages; run them from the repository root:

- `bun install` — install all workspace dependencies (CI uses `bun install --frozen-lockfile`).
- `bun run dev` — Vite dev server for `playground/`.
- `bun run test` — Vitest in watch mode across all package projects.
- `bun run test:ci` — Vitest single run; this is what CI (`.github/workflows/test.yml`) runs.
- `bun run typecheck` — typechecks `packages/core`, `packages/vue`, `packages/mentionly`, then
  `playground/` (`vue-tsc --noEmit`).
- `bun run build` — builds `@mentionly/core`, then `@mentionly/vue`, then `mentionly` to each
  package's `dist/` (ES + CJS + rolled-up `.d.ts`).
- `bun run build:playground` — builds the demo site to `playground-dist/`.

Per-package scripts (`bun run --cwd packages/<name> <script>`) provide `build`, `test`,
`test:ci` and `typecheck`. Build order matters: `core` before `vue` before `mentionly`.

## Layout

- `packages/core/` — `@mentionly/core`: `MentionCore` plus DOM utils and types. It depends on the
  browser DOM (`HTMLElement` / `document` / `window` / `Selection` / `Range` / `execCommand`)
  but **not** on Vue. Public entry: `src/index.ts`. Reserved subpath placeholders
  (`@mentionly/core/ai-sdk`, `@mentionly/core/mcp`) live in `src/ai-sdk.ts` and `src/mcp.ts` and
  currently just `export {}`.
- `packages/vue/` — `@mentionly/vue`: `useMention.ts` mirrors core state into refs, and
  `MentionInput.vue` / `MentionList.vue` are the ready-to-use components. Public entry:
  `src/index.ts` (the full public API, including `version`). `src/types.ts` holds the Vue-only
  return type; other types come from `@mentionly/core`.
- `packages/mentionly/` — `mentionly`: `src/index.ts` is `export * from '@mentionly/vue'`, and
  `src/style.css` re-imports `@mentionly/vue/style.css` so the build emits `dist/mentionly.css`
  (`vite.style.config.ts`).
- `packages/*/tests/` — Vitest specs (jsdom environment), included in each package's typecheck.
- `playground/` — Vite demo and documentation site. Aliases in `vite.playground.ts` and the root
  `tsconfig.json` point `mentionly`, `@mentionly/vue` and `@mentionly/core` at package sources, so
  editing `packages/*/src` hot-reloads.
- `.changeset/` — Changesets config. `@mentionly/core`, `@mentionly/vue` and `mentionly` are a
  `fixed` group, so they version together.

Package relationships are declared with plain semver ranges (for example `"^1.2.1"`), not the
`workspace:` protocol; bun still links them to the local workspace packages.

## MentionCore conventions

- Every state change goes through the private `setState()` / `batch()` helpers, which notify
  subscribers **synchronously** (no microtask). State updates inside async callbacks (e.g. data
  source promises) must use them too.
- `getState()` returns the same reference while nothing changed; an actual change produces a new
  state object.
- Public methods are arrow-function class fields, so destructuring them (as the composable's
  return value does) does not lose `this`.
- The constructor must not touch `window` / `document`. SSR safety here means "no DOM access on
  import or construction".
- `document.execCommand` is intentional: it keeps insertions in the browser undo stack, so do not
  replace it. jsdom has no `execCommand`, so tests mock it and restore the original in `finally`.

## Package build notes

- The published `version` is injected at build time via Vite `define`
  (`__MENTIONLY_VERSION__`), read from each package's own `package.json`. `@mentionly/vue` is the
  package that declares it today.
- Each package has a `tsconfig.json` for typechecking (source **and** tests) and a
  `tsconfig.build.json` used only by `vite-plugin-dts`; the build variant clears `paths` so the
  rolled-up `.d.ts` keeps package specifiers such as `@mentionly/core` instead of relative source
  paths.
- `@mentionly/vue` marks both `vue` and `@mentionly/core` as external, and `mentionly` marks
  `@mentionly/vue` as external, so nothing is bundled twice.

## Commits

Conventional Commits with an imperative subject and an optional scope: `feat: ...`,
`fix(core): ...`, `docs: ...`, `test: ...`, `refactor: ...`, `chore: ...`. Run `git log` for
examples.
