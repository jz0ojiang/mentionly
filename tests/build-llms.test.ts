import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PACKAGES, ROOT, generate, type PackageSpec } from '../scripts/build-llms'

/** Marker names the generator understands; none may survive into an output. */
const MARKERS = ['{{version}}', '{{exports}}', '{{returns}}', '{{notes.md}}']

const packageOut = (outDir: string, spec: PackageSpec) => join(outDir, 'packages', spec.dir, 'llms.txt')
const packageVersion = (spec: PackageSpec) =>
  (JSON.parse(readFileSync(join(ROOT, 'packages', spec.dir, 'package.json'), 'utf8')) as { version: string }).version

const readGeneratedExports = (text: string) => {
  const line = text.split('\n').find((row) => row.startsWith('[generated] Exports: '))
  if (!line) throw new Error('no [generated] Exports: line')
  const body = line.replace('[generated] Exports: ', '').replace(/\.$/, '')
  const [runtimePart, typesPart] = body.split('; types ')
  const names = (part: string | undefined) => [...(part ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1])
  return { runtime: names(runtimePart), types: names(typesPart) }
}

/**
 * Independent (regex-based) reading of a package's public exports, used to check
 * the generator's TypeScript-AST result. Follows `export * from` the same way.
 */
function sourceExports(spec: PackageSpec): { runtime: string[]; types: string[] } {
  const runtime = new Set<string>()
  const types = new Set<string>()

  const visit = (file: string): void => {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/export\s+\*\s+from\s+'([^']+)'/g)) {
      const scoped = /^@mentionly\/([a-z0-9-]+)$/.exec(match[1])
      if (scoped) visit(join(ROOT, 'packages', scoped[1], 'src', 'index.ts'))
      else visit(resolve(dirname(file), match[1].replace(/\.js$/, '.ts')))
    }
    for (const match of source.matchAll(/export\s+(type\s+)?\{([^}]*)\}/g)) {
      const blockTypeOnly = Boolean(match[1])
      for (const raw of match[2].split(',')) {
        const entry = raw.trim()
        if (!entry) continue
        const isType = blockTypeOnly || entry.startsWith('type ')
        const name = entry.replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim()
        if (!name || runtime.has(name) || types.has(name)) continue
        if (isType) types.add(name)
        else runtime.add(name)
      }
    }
  }

  visit(join(ROOT, 'packages', spec.dir, 'src', 'index.ts'))
  return { runtime: [...runtime], types: [...types] }
}

/** Independent (regex-based) reading of an interface's member names. */
function sourceInterfaceMembers(spec: PackageSpec): string[] {
  const { file, iface } = spec.returns!
  const source = readFileSync(join(ROOT, file), 'utf8')
  const block = new RegExp(`interface ${iface} \\{([\\s\\S]*?)\\n\\}`).exec(source)
  if (!block) throw new Error(`interface ${iface} not found in ${file}`)
  return [...block[1].matchAll(/^\s{2}(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*[:(]/gm)].map((m) => m[1])
}

describe('build-llms', () => {
  let outDir: string

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), 'mentionly-llms-'))
    generate({ outDir })
  })

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true })
  })

  it('writes every package file with its own name and version title', () => {
    for (const spec of PACKAGES) {
      const file = packageOut(outDir, spec)
      expect(existsSync(file), file).toBe(true)
      const text = readFileSync(file, 'utf8')
      expect(text.startsWith(`# ${spec.name} ${packageVersion(spec)}`), `${spec.key} title`).toBe(true)
    }
  })

  it('includes the 1.x API section exactly where the package declares it', () => {
    for (const spec of PACKAGES) {
      const text = readFileSync(packageOut(outDir, spec), 'utf8')
      if (spec.includeLegacyApi) expect(text, spec.key).toContain('## 1.x API')
      else expect(text, spec.key).not.toContain('## 1.x API')
    }
  })

  it('generates export lines that match the package sources', () => {
    for (const spec of PACKAGES) {
      const generated = readGeneratedExports(readFileSync(packageOut(outDir, spec), 'utf8'))
      const actual = sourceExports(spec)
      expect(new Set(generated.runtime), `${spec.key} runtime exports`).toEqual(new Set(actual.runtime))
      expect(new Set(generated.types), `${spec.key} type exports`).toEqual(new Set(actual.types))
    }
  })

  it('generates the adapter return list from its interface', () => {
    for (const spec of PACKAGES.filter((pkg) => pkg.returns)) {
      const text = readFileSync(packageOut(outDir, spec), 'utf8')
      const line = text.split('\n').find((row) => row.includes('returns `{ '))
      const fields = line?.match(/returns `\{ (.*) \}`/)![1].split(', ')
      expect(fields, spec.key).toEqual(sourceInterfaceMembers(spec))
    }
  })

  it('leaves no unresolved marker', () => {
    for (const spec of PACKAGES) {
      const text = readFileSync(packageOut(outDir, spec), 'utf8')
      expect(text, spec.key).not.toContain('{{')
    }
    const site = readFileSync(join(outDir, 'playground-dist', 'llms.txt'), 'utf8')
    expect(site).not.toContain('{{')

    // llms-full.txt embeds raw READMEs and example components, which legitimately
    // contain `{{ … }}` Vue / JSX interpolation; only our own markers must be gone.
    const full = readFileSync(join(outDir, 'playground-dist', 'llms-full.txt'), 'utf8')
    for (const marker of MARKERS) expect(full, marker).not.toContain(marker)
  })

  it('writes the site outputs from the shared notes', () => {
    const site = join(outDir, 'playground-dist', 'llms.txt')
    const full = join(outDir, 'playground-dist', 'llms-full.txt')
    expect(existsSync(site) && existsSync(full)).toBe(true)

    const notes = readFileSync(join(ROOT, 'llms', 'notes.md'), 'utf8').trim()
    const siteText = readFileSync(site, 'utf8')
    expect(siteText).toContain(notes)
    expect(siteText.startsWith('# mentionly\n')).toBe(true)

    const fullText = readFileSync(full, 'utf8')
    for (const part of ['# llms/notes.md', '# README.md', '# packages/core/README.md', '# MIGRATION.md']) {
      expect(fullText, part).toContain(`\n${part}\n`)
    }
    expect(fullText).toContain('# examples/react/src/MentionInput.tsx')
    expect(fullText).toContain('# examples/svelte/src/MentionInput.svelte')
  })

  it('fails on an unknown target', () => {
    expect(() => generate({ outDir, targets: ['not-a-package'] })).toThrow(/unknown target/)
  })

  it('exits non-zero from the CLI when a target is unknown', () => {
    const result = spawnSync('bun', [join(ROOT, 'scripts', 'build-llms.ts'), '--out', outDir, 'not-a-package'], {
      encoding: 'utf8',
    })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('unknown target')
  })
})
