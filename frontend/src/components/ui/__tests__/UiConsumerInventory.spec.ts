import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseSfc } from 'vue/compiler-sfc'
import * as ts from 'typescript'

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = resolve(uiRoot, '../..')

const intentionallyExternalUnused = new Set([
  'UiAvatarGroup',
  'UiColorSwatch',
  'UiCommandMenu',
  'UiDateTimeRangePicker',
  'UiErrorDetailDialog',
  'UiFieldError',
  'UiInlineEdit',
  'UiKeyValue',
  'UiKbd',
  'UiList',
  'UiLogLine',
  'UiScoreBar',
  'UiSecretField',
  'UiSideNavGroup',
  'UiSparkline',
  'UiSnackbar',
  'UiSortableHeader',
  'UiTimeInput',
  'UiTransferList',
  'UiTree',
])

const typeOnlyBarrelExports = new Set([
  'Column',
  'SelectOption',
  'SelectOptionLike',
  'SelectValue',
  'UiAccordionItem',
  'UiButtonVariant',
  'UiChoiceOption',
  'UiCommandItem',
  'UiDensity',
  'UiEntityOption',
  'UiFieldChange',
  'UiIntent',
  'UiKeyValueRow',
  'UiMenuItem',
  'UiTabOption',
])

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(path)
    return /\.(?:ts|tsx|vue)$/.test(entry.name) ? [path] : []
  })
}

function isConsumerFile(path: string): boolean {
  const file = relative(srcRoot, path)
  return !file.startsWith('components/ui/')
    && !file.includes('/__tests__/')
    && !/\.(?:spec|test)\.(?:ts|tsx)$/.test(file)
}

function scriptSources(path: string, source: string): string[] {
  if (!path.endsWith('.vue')) return [source]
  const descriptor = parseSfc(source, { filename: path }).descriptor
  return [descriptor.script?.content, descriptor.scriptSetup?.content].filter(
    (content): content is string => Boolean(content),
  )
}

type ConsumerReport = {
  componentNames: string[]
  counts: Map<string, number>
  files: Map<string, Set<string>>
  runtimeReferences: number
  unsupportedBarrelImports: string[]
  dynamicBarrelImports: string[]
}

function collectConsumerReport(): ConsumerReport {
  const componentNames = readdirSync(uiRoot)
    .filter((name) => name.endsWith('.vue'))
    .map((name) => name.replace(/\.vue$/, ''))
    .sort()
  const componentSet = new Set(componentNames)
  const counts = new Map(componentNames.map((name) => [name, 0]))
  const files = new Map(componentNames.map((name) => [name, new Set<string>()]))
  const unsupportedBarrelImports: string[] = []
  const dynamicBarrelImports: string[] = []
  let runtimeReferences = 0

  for (const path of collectFiles(srcRoot).filter(isConsumerFile)) {
    const file = relative(srcRoot, path)
    const source = readFileSync(path, 'utf8')
    for (const script of scriptSources(path, source)) {
      const sourceFile = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
      sourceFile.forEachChild((node) => {
        if (!ts.isImportDeclaration(node) || node.moduleSpecifier.getText(sourceFile) !== "'@/components/ui'" && node.moduleSpecifier.getText(sourceFile) !== '"@/components/ui"') return
        const clause = node.importClause
        if (!clause) return
        if (clause.name || clause.namedBindings && !ts.isNamedImports(clause.namedBindings)) {
          unsupportedBarrelImports.push(`${file}:${node.getStart(sourceFile)}`)
          return
        }
        if (!clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return
        for (const specifier of clause.namedBindings.elements) {
          if (specifier.isTypeOnly) continue
          const component = (specifier.propertyName ?? specifier.name).text
          if (typeOnlyBarrelExports.has(component)) continue
          if (!componentSet.has(component)) {
            unsupportedBarrelImports.push(`${file}:${component}`)
            continue
          }
          counts.set(component, (counts.get(component) ?? 0) + 1)
          files.get(component)?.add(file)
          runtimeReferences += 1
        }
      })
      const dynamicPattern = /import\s*\(\s*(['"])@\/components\/ui\1\s*\)/g
      for (const match of script.matchAll(dynamicPattern)) {
        dynamicBarrelImports.push(`${file}:${match.index ?? 0}`)
      }
    }
  }
  return { componentNames, counts, files, runtimeReferences, unsupportedBarrelImports, dynamicBarrelImports }
}

describe('Qiu UI consumer inventory', () => {
  it('keeps the 114 public contracts mapped to production consumers or an explicit staged-use allowlist', () => {
    const report = collectConsumerReport()
    const externalUnused = report.componentNames.filter((name) => report.files.get(name)?.size === 0)
    const consumerFiles = new Set(
      report.componentNames.flatMap((name) => [...(report.files.get(name) ?? [])]),
    )

    expect(report.componentNames).toHaveLength(114)
    expect(externalUnused).toEqual([...intentionallyExternalUnused].sort())
    expect(report.unsupportedBarrelImports).toEqual([])
    expect(report.dynamicBarrelImports).toEqual([])
    expect(consumerFiles.size).toBe(276)
    expect(report.runtimeReferences).toBe(1884)
  })

  it('keeps internal-only and staged components documented instead of silently counting showcase markup as consumers', () => {
    const report = collectConsumerReport()
    const internalOnly = ['UiFieldError', 'UiTimeInput']
    const staged = [...intentionallyExternalUnused].filter((name) => !internalOnly.includes(name)).sort()

    expect(staged).toHaveLength(18)
    expect(report.files.get('UiFieldError')?.size).toBe(0)
    expect(report.files.get('UiTimeInput')?.size).toBe(0)
    expect(readFileSync(join(uiRoot, 'UiFormField.vue'), 'utf8')).toContain('UiFieldError')
    expect(readFileSync(join(uiRoot, 'UiDateTimeRangePicker.vue'), 'utf8')).toContain('UiTimeInput')
  })
})
