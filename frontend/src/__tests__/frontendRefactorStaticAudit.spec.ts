import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse as parseSfc } from 'vue/compiler-sfc'

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(path)
    return /\.(?:ts|vue|css)$/.test(entry.name) ? [path] : []
  })
}

const productionSourceFiles = collectSourceFiles(srcRoot)
  .filter((path) => !path.includes('/__tests__/'))
  .sort()
const nonUiProductionSourceFiles = productionSourceFiles.filter(
  (path) => !relative(srcRoot, path).startsWith('components/ui/'),
)
const sourceByFile = new Map(
  nonUiProductionSourceFiles
    .filter((path) => path.endsWith('.vue'))
    .map((path) => [relative(srcRoot, path), readFileSync(path, 'utf8')]),
)

function templateSource(source: string): string {
  return source.match(/<template>([\s\S]*?)<\/template>/)?.[1] ?? ''
}

function styleSource(source: string, file: string): string {
  if (file.endsWith('.css')) return source
  return [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join('\n')
}

type NativeControlTag = 'button' | 'input' | 'select' | 'textarea'
type NativeControlManifestEntry = Partial<Record<NativeControlTag, number>> & {
  docsRef: string
}

function nativeControlCounts(source: string, file: string): Partial<Record<NativeControlTag, number>> {
  const counts: Partial<Record<NativeControlTag, number>> = {}
  const ast = parseSfc(source, { filename: file }).descriptor.template?.ast
  if (!ast) return counts

  const visit = (node: { type?: number; tag?: string; children?: unknown[] }) => {
    if (node.type === 1 && ['button', 'input', 'select', 'textarea'].includes(node.tag || '')) {
      const tag = node.tag as NativeControlTag
      counts[tag] = (counts[tag] ?? 0) + 1
    }
    for (const child of node.children ?? []) {
      if (child && typeof child === 'object') visit(child as typeof node)
    }
  }
  visit(ast as typeof ast & { children?: unknown[] })
  return counts
}

describe('frontend refactor static contracts', () => {
  it('has no production imports of deleted common compatibility wrappers', () => {
    const deletedWrappers = [
      'BaseDialog',
      'ConfirmDialog',
      'DataTable',
      'EmptyState',
      'ExportProgressDialog',
      'Input',
      'LoadingSpinner',
      'Pagination',
      'Select',
      'StatCard',
      'StatusBadge',
      'Toggle',
    ]

    for (const [file, source] of sourceByFile) {
      for (const wrapper of deletedWrappers) {
        expect(source, `${file} still imports deleted common ${wrapper}`).not.toMatch(
          new RegExp(`components/common/${wrapper}\\.vue`),
        )
      }
    }
  })

  it('does not reintroduce legacy .btn control classes', () => {
    const legacyControlClass = /(?:class|:class)\s*=\s*["'`][^"'`]*\bbtn(?:-|\s|["'`])/m
    for (const [file, source] of sourceByFile) {
      expect(source, `${file} contains a legacy .btn control class`).not.toMatch(legacyControlClass)
    }
  })

  it('does not reintroduce legacy card or field helper classes', () => {
    for (const [file, source] of sourceByFile) {
      const template = templateSource(source)
      const classValues = [...template.matchAll(/(?:^|\s)(?::class|class)="([^"]*)"/gm)]
        .map((match) => match[1])

      for (const value of classValues) {
        expect(value, `${file} contains the legacy .card surface token`).not.toMatch(
          /(?:^|[\s'])card(?:$|[\s'])/,
        )
        expect(value, `${file} contains a legacy badge class`).not.toMatch(
          /(?:^|[\s'])badge(?:-(?:primary|success|warning|danger|gray|purple|info|secondary))?(?:$|[\s'])/,
        )
      }
      expect(template, `${file} contains legacy field helper classes`).not.toMatch(
        /\binput-(?:label|hint)\b/,
      )
    }
  })

  it('imports shared UI contracts only through the public barrel', () => {
    const uiSubpathImport = /from\s+['"]@\/components\/ui\//
    for (const path of nonUiProductionSourceFiles) {
      const file = relative(srcRoot, path)
      const source = readFileSync(path, 'utf8')
      expect(source, `${file} bypasses the @/components/ui public barrel`).not.toMatch(uiSubpathImport)
    }
  })

  it('limits inline SVG to registered brand/data-visualization owners', () => {
    const allowedSvgOwners = new Set([
      'components/common/GrokFreeIcon.vue',
      'components/common/ModelIcon.vue',
      'components/common/PlatformIcon.vue',
      'components/ui/UiProgressRing.vue',
      'components/ui/UiSparkline.vue',
      'components/user/monitor/ProviderIcon.vue',
    ])

    for (const [file, source] of sourceByFile) {
      if (!source.includes('<svg')) continue
      expect(allowedSvgOwners.has(file), `${file} contains an unregistered inline SVG`).toBe(true)
    }
  })

  it('uses the shared Lucide icon contract instead of icon-font classes', () => {
    for (const [file, source] of sourceByFile) {
      expect(source, `${file} uses an unregistered icon-font class`).not.toMatch(/\bi-(?:mdi|material|heroicons?)-[a-z0-9-]+\b/)
    }
  })

  it('keeps Driver onboarding styles scoped to the registered popover exception', () => {
    const onboardingCss = readFileSync(join(srcRoot, 'styles/onboarding.css'), 'utf8')
    const onboardingTour = readFileSync(join(srcRoot, 'composables/useOnboardingTour.ts'), 'utf8')
    expect(onboardingTour).not.toMatch(/className\s*=\s*['"`]([^'"`]*\b(?:mt-|text-|flex|items-|gap-|mr-)\w*)/)
    for (const selector of ['.tour-footer-left', '.tour-footer-right', '.tour-footer-shortcuts', '.tour-shortcut-item', '.tour-interactive-hint']) {
      expect(onboardingCss).toContain(`.driver-popover.theme-tour-popover ${selector}`)
    }
    expect(onboardingCss).not.toMatch(/(^|\n)\s*\.(?:footer-left|footer-right|footer-shortcuts|shortcut-item)\b/)
    expect(onboardingCss).not.toMatch(/(^|\n)\s*\.driver-popover-arrow\b/)
  })

  it('does not override shared UiButton visual tokens from account preset data', () => {
    const source = readFileSync(join(srcRoot, 'components/account/BulkEditAccountModal.vue'), 'utf8')
    expect(source).not.toMatch(/<UiButton[\s\S]{0,500}:class="[^\n]*preset\.color/)
  })

  it('keeps motion declarations tokenized and reduced-motion safe', () => {
    for (const path of productionSourceFiles) {
      const file = relative(srcRoot, path)
      const rawSource = readFileSync(path, 'utf8')
      const source = styleSource(rawSource, file)
      if (source) {
        expect(source, `${file} uses a blanket transition`).not.toMatch(/transition\s*:\s*all\b/)
        expect(source, `${file} uses Tailwind transition-all`).not.toContain('transition-all')
        expect(source, `${file} defines an infinite reduced-motion pulse`).not.toContain('progress-pulse')
      }
      if (file.endsWith('.vue')) {
        const template = templateSource(rawSource)
        expect(template, `${file} uses a bare Tailwind transform transition`).not.toMatch(
          /(?<!motion-safe:)transition-transform\b/,
        )
      }
    }
    const stripeSource = readFileSync(join(srcRoot, 'views/user/StripePaymentView.vue'), 'utf8')
    expect(stripeSource).not.toContain('.stripe-payment-page :deep(*)')
    expect(stripeSource).not.toContain('transition-duration: 0.01ms !important')
    const homeHeaderSource = readFileSync(join(srcRoot, 'components/home/HomeSiteHeader.vue'), 'utf8')
    expect(homeHeaderSource).not.toContain('.qiu-site-header *')
    expect(homeHeaderSource).not.toContain('transition: none !important')
  })

  it('does not animate layout width in shared progress primitives', () => {
    for (const relativeFile of [
      'components/ui/UiProgressBar.vue',
      'components/ui/UiFileUpload.vue',
      'components/ui/UiScoreBar.vue',
      'components/account/UsageProgressBar.vue',
    ]) {
      const source = readFileSync(join(srcRoot, relativeFile), 'utf8')
      const styles = styleSource(source, relativeFile)
      expect(styles, `${relativeFile} animates progress width`).not.toMatch(/transition\s*:\s*width\b/)
    }
  })

  it('allows layout-property transitions only in the documented shell exception', () => {
    const allowedLayoutTransitionOwners = new Set([
      'components/layout/AppLayout.vue',
      'components/layout/AppSidebar.vue',
    ])
    const layoutTransition = /transition\s*:\s*[^;{}]*(?:width|min-width|height|top|left|padding|margin(?:-left|-right|-top|-bottom)?)\b/i

    for (const path of productionSourceFiles) {
      const file = relative(srcRoot, path)
      const styles = styleSource(readFileSync(path, 'utf8'), file)
      if (!layoutTransition.test(styles)) continue
      expect(
        allowedLayoutTransitionOwners.has(file),
        `${file} contains an unregistered layout-property transition`,
      ).toBe(true)
    }
  })

  it('keeps native controls exactly matched to the documented exception manifest', () => {
    const repositoryRoot = resolve(srcRoot, '../..')
    const manifestPath = resolve(srcRoot, '../config/native-control-exceptions.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      NativeControlManifestEntry
    >
    const exceptionDocs = readFileSync(
      join(repositoryRoot, 'docs/frontend-rebuild/exceptions.md'),
      'utf8',
    )
    const actual: Record<string, Partial<Record<NativeControlTag, number>>> = {}

    for (const [file, source] of sourceByFile) {
      const counts = nativeControlCounts(source, file)
      if (Object.keys(counts).length > 0) actual[file] = counts
    }

    const expected = Object.fromEntries(
      Object.entries(manifest).map(([file, entry]) => {
        const { docsRef: _docsRef, ...counts } = entry
        return [file, counts]
      }),
    )
    expect(actual).toEqual(expected)

    for (const [file, entry] of Object.entries(manifest)) {
      expect(exceptionDocs, `${file} is missing from the exception register`).toContain(entry.docsRef)
    }
  })

  it('keeps the rollback archive and ownership documents present', () => {
    const repositoryRoot = resolve(srcRoot, '../..')
    expect(existsSync(join(repositoryRoot, 'docs/frontend-rebuild/WORKSPACE-OWNERSHIP-AUDIT.md'))).toBe(true)
    expect(existsSync(join(repositoryRoot, 'docs/frontend-rebuild/exceptions.md'))).toBe(true)
    expect(existsSync(join(repositoryRoot, 'plan.md'))).toBe(true)
    expect(existsSync(join(repositoryRoot, '.git'))).toBe(true)
  })
})
