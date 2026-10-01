# AGENTS.md

Guidance for AI coding agents and human contributors working in this repository.

## What this is

`mentionly` — a lightweight Vue 3 mention input component for AI chat scenarios (see the
`description` in `package.json`). A `contenteditable` editor with atomic mention entities,
async and paginated data sources, IME handling, and serialization. Zero runtime dependencies;
Vue 3 is a peer dependency. English docs: `README.md`, Chinese docs: `README.zh.md`.

## Toolchain

Use **bun** only — the repo has `bun.lock` and no other lockfile. The build is Vite (with
`vite-plugin-dts`) and the tests are Vitest on jsdom; do not "simplify" this to Bun's built-in
bundler or test runner.

- `bun install` — install dependencies (CI uses `bun install --frozen-lockfile`).
- `bun run dev` — Vite dev server for `playground/`.
- `bun run test` — Vitest in watch mode.
- `bun run test:ci` — Vitest single run; this is what CI (`.github/workflows/test.yml`) runs.
- `bun run typecheck` — `vue-tsc --noEmit`.
- `bun run build` — build the library to `dist/` (ES + CJS + rolled-up `.d.ts`).
- `bun run build:playground` — build the demo site to `playground-dist/`.

## Layout

- `src/core/` — framework-agnostic `MentionCore` plus DOM utils and types. It depends on the
  browser DOM (`HTMLElement` / `document` / `window` / `Selection` / `Range` / `execCommand`)
  but **not** on Vue.
- `src/vue/` — thin Vue adapter: `useMention.ts` mirrors core state into refs, and
  `MentionInput.vue` / `MentionList.vue` are the ready-to-use components.
- `src/useMention.ts`, `src/types.ts`, `src/utils.ts` — compatibility re-export shims for the old
  import paths; the real code lives in `src/core/` and `src/vue/`.
- `src/index.ts` — public entry point. Everything it exports is public API, so changing it is a
  compatibility decision.
- `tests/core/`, `tests/vue/` — Vitest specs (jsdom environment).
- `playground/` — Vite demo and documentation site, built from `src/` via an alias.

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

## Commits

Conventional Commits with an imperative subject and an optional scope: `feat: ...`,
`fix(core): ...`, `docs: ...`, `test: ...`, `refactor: ...`, `chore: ...`. Run `git log` for
examples.
