import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../TablePageLayout.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const appLayoutPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppLayout.vue')
const appLayoutSource = readFileSync(appLayoutPath, 'utf8')

describe('TablePageLayout responsive table scrolling', () => {
  it('inherits available height through a flex/min-h-0 chain instead of viewport arithmetic', () => {
    expect(appLayoutSource).toContain('relative flex min-h-screen flex-col')
    expect(appLayoutSource).toContain('app-main-content flex min-h-0 min-w-0 flex-1 flex-col')
    expect(appLayoutSource).toContain('app-page-content flex min-h-0 min-w-0 flex-1 flex-col')
    expect(componentSource).toContain('@apply flex min-h-0 flex-1 flex-col gap-3')
    expect(componentSource).not.toContain('height: calc')
    expect(componentSource).not.toContain('100dvh')
  })

  it('does not disable the table horizontal scroll container in mobile mode', () => {
    const tableWrapperBlocks = Array.from(
      componentSource.matchAll(/([^{}]*:deep\(\.table-wrapper\)[^{}]*)\{([^{}]*)\}/g)
    )

    expect(tableWrapperBlocks.length).toBeGreaterThan(0)

    const baseBlock = tableWrapperBlocks.find(([selector]) => !selector.includes('.mobile-mode'))
    expect(baseBlock?.[2]).toContain('overflow-x-auto')
    expect(tableWrapperBlocks.every(([, , declarations]) => !declarations.includes('overflow-visible'))).toBe(
      true
    )
  })
})
