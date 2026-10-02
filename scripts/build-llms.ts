/**
 * Generates the LLM-facing documentation of the repository from the hand-written
 * sources in `llms/`:
 *
 * - `packages/<dir>/llms.txt` for each published package (package header +
 *   `llms/notes.md` + `llms/footer.md`), written during that package's `build`;
 * - `playground-dist/llms.txt` (site header + `llms/notes.md`) and
 *   `playground-dist/llms-full.txt` (the site header, the notes, every README,
 *   the React / Svelte example components and `MIGRATION.md`), written by
 *   `build:playground`.
 *
 * The `[generated]` lines (`{{exports}}` and `{{returns}}`) are read from the
 * package sources through the TypeScript compiler API, so they cannot drift
 * from the code that ships. Everything else is hand-written in `llms/`.
 *
 * Usage: `bun scripts/build-llms.ts [--out <dir>] [packages... | site]`.
 * Without targets every package and the site files are written. `--out`
 * redirects the output root (used by the tests); the default is the repository
 * root.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface PackageSpec {
  /** CLI target, and the name of `llms/packages/<key>.md` */
  key: string
  /** directory below `packages/` */
  dir: string
  /** published package name */
  name: string
  /** whether the `## 1.x API` section of `llms/notes.md` applies */
  includeLegacyApi: boolean
  /** interface describing the adapter's return value, when it has one */
  returns?: { file: string; iface: string }
}

export const PACKAGES: PackageSpec[] = [
  { key: 'mentionly', dir: 'mentionly', name: 'mentionly', includeLegacyApi: true },
  { key: 'vue', dir: 'vue', name: '@mentionly/vue', includeLegacyApi: true },
  {
    key: 'react',
    dir: 'react',
    name: '@mentionly/react',
    includeLegacyApi: false,
    returns: { file: 'packages/react/src/types.ts', iface: 'UseMentionReturn' },
  },
  {
    key: 'svelte',
    dir: 'svelte',
    name: '@mentionly/svelte',
    includeLegacyApi: false,
    returns: { file: 'packages/svelte/src/types.ts', iface: 'CreateMentionReturn' },
  },
  { key: 'core', dir: 'core', name: '@mentionly/core', includeLegacyApi: true },
]

const SITE_TARGET = 'site'
const NOTES_MARKER = '{{notes.md}}'
const LEGACY_HEADING = '## 1.x API'

/** Files concatenated into `llms-full.txt`, in order, after the site header. */
const FULL_TEXT_PARTS: { path: string; lang?: string }[] = [
  { path: 'README.md' },
  { path: 'packages/core/README.md' },
  { path: 'packages/vue/README.md' },
  { path: 'packages/react/README.md' },
  { path: 'packages/svelte/README.md' },
  { path: 'examples/react/src/MentionInput.tsx', lang: 'tsx' },
  { path: 'examples/svelte/src/MentionInput.svelte', lang: 'svelte' },
  { path: 'MIGRATION.md' },
]

// ════════════════════════════════════════
//  Reading the repository
// ════════════════════════════════════════

const repoPath = (...parts: string[]): string => join(ROOT, ...parts)

/** Repository-relative, forward-slashed path used in log and error messages. */
const rel = (file: string): string => relative(ROOT, file).split('\\').join('/')

function readFileOrThrow(file: string): string {
  if (!existsSync(file)) throw new Error(`build-llms: missing source file: ${rel(file)}`)
  return readFileSync(file, 'utf8')
}

function readJsonOrThrow(file: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileOrThrow(file)) as Record<string, unknown>
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`build-llms: invalid JSON in ${rel(file)}`)
    throw error
  }
}

function packageVersion(spec: PackageSpec): string {
  const { version } = readJsonOrThrow(repoPath('packages', spec.dir, 'package.json'))
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error(`build-llms: packages/${spec.dir}/package.json has no version`)
  }
  return version
}

// ════════════════════════════════════════
//  Exports, read from each package's src/index.ts
// ════════════════════════════════════════

export interface PackageExports {
  runtime: string[]
  types: string[]
}

interface ExportCollector {
  runtime: string[]
  types: string[]
  names: Set<string>
  files: Set<string>
}

/** Resolves a local module request (`./x.js`, `@mentionly/vue`) to a source file. */
function resolveLocalModule(request: string, fromFile: string): string {
  const scoped = /^@mentionly\/([a-z0-9-]+)$/.exec(request)
  if (scoped) {
    const spec = PACKAGES.find((pkg) => pkg.dir === scoped[1])
    if (!spec) throw new Error(`build-llms: cannot resolve "${request}" from ${rel(fromFile)}`)
    return repoPath('packages', spec.dir, 'src', 'index.ts')
  }
  if (request.startsWith('.')) {
    const base = resolve(dirname(fromFile), request)
    const candidates = [`${base}.ts`, base.replace(/\.js$/, '.ts'), join(base, 'index.ts')]
    const found = candidates.find((candidate) => existsSync(candidate))
    if (found) return found
  }
  throw new Error(`build-llms: cannot resolve "${request}" from ${rel(fromFile)}`)
}

function addExport(collector: ExportCollector, name: string, typeOnly: boolean): void {
  if (collector.names.has(name)) return
  collector.names.add(name)
  if (typeOnly) collector.types.push(name)
  else collector.runtime.push(name)
}

function collectModuleExports(file: string, collector: ExportCollector): void {
  if (collector.files.has(file)) return
  collector.files.add(file)

  const source = readFileOrThrow(file)
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue
    if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const specifier of statement.exportClause.elements) {
        addExport(collector, specifier.name.text, statement.isTypeOnly || specifier.isTypeOnly)
      }
      continue
    }
    if (!statement.exportClause && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      // `export * from '...'`: follow the re-export so a forwarding package
      // (mentionly) reports the same surface as the package it forwards to.
      collectModuleExports(resolveLocalModule(statement.moduleSpecifier.text, file), collector)
    }
  }
}

/** Runtime and type exports of a package's public entry, in source order. */
export function collectPackageExports(spec: PackageSpec): PackageExports {
  const collector: ExportCollector = { runtime: [], types: [], names: new Set(), files: new Set() }
  collectModuleExports(repoPath('packages', spec.dir, 'src', 'index.ts'), collector)
  return { runtime: collector.runtime, types: collector.types }
}

export function renderExports(exports: PackageExports): string {
  if (exports.runtime.length === 0) throw new Error('build-llms: parsed export list is empty (runtime exports)')
  if (exports.types.length === 0) throw new Error('build-llms: parsed export list is empty (types)')
  const runtime = exports.runtime.map((name) => `\`${name}\``).join(', ')
  const types = exports.types.map((name) => `\`${name}\``).join(', ')
  return `${runtime}; types ${types}.`
}

/** Property and method names of an exported interface, in declaration order. */
export function readInterfaceMembers(file: string, iface: string): string[] {
  const abs = repoPath(file)
  const source = readFileOrThrow(abs)
  const sourceFile = ts.createSourceFile(abs, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  for (const statement of sourceFile.statements) {
    if (!ts.isInterfaceDeclaration(statement) || statement.name.text !== iface) continue
    const members = statement.members
      .map((member) => (member.name && ts.isIdentifier(member.name) ? member.name.text : ''))
      .filter((name) => name.length > 0)
    if (members.length === 0) throw new Error(`build-llms: interface ${iface} in ${file} has no members`)
    return members
  }
  throw new Error(`build-llms: interface ${iface} not found in ${file}`)
}

// ════════════════════════════════════════
//  Hand-written sources
// ════════════════════════════════════════

function fillTemplate(template: string, vars: Record<string, string>, label: string): string {
  let output = template
  for (const [key, value] of Object.entries(vars)) output = output.split(`{{${key}}}`).join(value)
  const leftover = /\{\{[^{}]*\}\}/.exec(output)
  if (leftover) throw new Error(`build-llms: unresolved marker ${leftover[0]} in ${label}`)
  return output
}

/** `llms/notes.md`, without the `## 1.x API` section when it does not apply. */
function notesBody(includeLegacyApi: boolean): string {
  const notes = readFileOrThrow(repoPath('llms', 'notes.md'))
  if (includeLegacyApi) return notes.trim()
  const lines = notes.split('\n')
  const start = lines.findIndex((line) => line.startsWith(LEGACY_HEADING))
  if (start === -1) throw new Error(`build-llms: "${LEGACY_HEADING}" heading missing from llms/notes.md`)
  return lines.slice(0, start).join('\n').trimEnd()
}

const joinSections = (sections: string[]): string => sections.map((part) => part.trim()).join('\n\n') + '\n'

// ════════════════════════════════════════
//  Outputs
// ════════════════════════════════════════

/** `packages/<dir>/llms.txt`: header + notes + footer. */
export function buildPackage(spec: PackageSpec): string {
  const template = readFileOrThrow(repoPath('llms', 'packages', `${spec.key}.md`))
  const vars: Record<string, string> = {
    version: packageVersion(spec),
    exports: renderExports(collectPackageExports(spec)),
  }
  if (spec.returns) {
    vars.returns = `{ ${readInterfaceMembers(spec.returns.file, spec.returns.iface).join(', ')} }`
  }
  const header = fillTemplate(template, vars, `llms/packages/${spec.key}.md`)
  const footer = readFileOrThrow(repoPath('llms', 'footer.md'))
  return joinSections([header, notesBody(spec.includeLegacyApi), footer])
}

/** The site `llms.txt`: header + notes + doc links. */
export function buildSite(): string {
  const template = readFileOrThrow(repoPath('llms', 'site.md'))
  return fillTemplate(template, { 'notes.md': notesBody(true) }, 'llms/site.md').trim() + '\n'
}

function section(path: string, body: string): string {
  return `# ${path}\n\n${body}`
}

function codeFence(body: string, lang: string): string {
  const runs = body.match(/`+/g) ?? []
  const width = Math.max(3, ...runs.map((run) => run.length + 1))
  const fence = '`'.repeat(width)
  return `${fence}${lang}\n${body}\n${fence}`
}

/** `llms-full.txt`: every hand-written and generated document in one file. */
export function buildFull(): string {
  const template = readFileOrThrow(repoPath('llms', 'site.md'))
  const markerAt = template.indexOf(NOTES_MARKER)
  if (markerAt === -1) throw new Error(`build-llms: ${NOTES_MARKER} not found in llms/site.md`)

  const sections = [
    section('llms.txt', fillTemplate(template.slice(0, markerAt), {}, 'llms/site.md header').trim()),
    section('llms/notes.md', notesBody(true)),
  ]
  for (const part of FULL_TEXT_PARTS) {
    const body = readFileOrThrow(repoPath(part.path)).trim()
    sections.push(section(part.path, part.lang ? codeFence(body, part.lang) : body))
  }
  return sections.join('\n\n') + '\n'
}

// ════════════════════════════════════════
//  Entry point
// ════════════════════════════════════════

export interface GenerateOptions {
  /** root the outputs are written below; defaults to the repository root */
  outDir?: string
  /** package keys and/or `site`; defaults to everything */
  targets?: string[]
}

export function generate(options: GenerateOptions = {}): string[] {
  const outDir = options.outDir ?? ROOT
  const targets = options.targets && options.targets.length > 0
    ? options.targets
    : [...PACKAGES.map((spec) => spec.key), SITE_TARGET]

  const written: string[] = []
  for (const target of targets) {
    if (target === SITE_TARGET) {
      written.push(writeOutput(join(outDir, 'playground-dist', 'llms.txt'), buildSite()))
      written.push(writeOutput(join(outDir, 'playground-dist', 'llms-full.txt'), buildFull()))
      continue
    }
    const spec = PACKAGES.find((pkg) => pkg.key === target)
    if (!spec) throw new Error(`build-llms: unknown target "${target}"`)
    written.push(writeOutput(join(outDir, 'packages', spec.dir, 'llms.txt'), buildPackage(spec)))
  }
  return written
}

function writeOutput(file: string, content: string): string {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content, 'utf8')
  return file
}

function main(argv: string[]): void {
  let outDir: string | undefined
  const targets: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--out') {
      const value = argv[index + 1]
      if (!value) throw new Error('build-llms: --out needs a directory')
      index += 1
      outDir = resolve(process.cwd(), value)
    } else if (arg.startsWith('--out=')) {
      outDir = resolve(process.cwd(), arg.slice('--out='.length))
    } else if (arg.startsWith('-')) {
      throw new Error(`build-llms: unknown option "${arg}"`)
    } else {
      targets.push(arg)
    }
  }

  for (const file of generate({ outDir, targets })) {
    const shown = relative(ROOT, file)
    console.log(`llms: wrote ${shown.startsWith('..') ? file : rel(file)}`)
  }
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
