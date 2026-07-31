import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppSidebar.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const headerPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppHeader.vue')
const headerSource = readFileSync(headerPath, 'utf8')
const stylePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../style.css')
const styleSource = readFileSync(stylePath, 'utf8')

describe('AppSidebar model plaza navigation', () => {
  it('places the embedded model plaza entry between available channels and channel status', () => {
    const availableChannelsIndex = componentSource.indexOf("{ path: '/available-channels'")
    const modelPlazaIndex = componentSource.indexOf(
      'createModelPlazaNavItem()',
      availableChannelsIndex
    )
    const channelStatusIndex = componentSource.indexOf("{ path: '/monitor'")

    expect(availableChannelsIndex).toBeGreaterThan(-1)
    expect(modelPlazaIndex).toBeGreaterThan(availableChannelsIndex)
    expect(channelStatusIndex).toBeGreaterThan(modelPlazaIndex)
    expect(componentSource).toContain("query: { embedded: '1' }")
    expect(componentSource).toContain(
      'const flagModelPlaza = makeSidebarFlag(FeatureFlags.modelPlaza)'
    )
  })

  it('keeps model plaza out of the primary admin system navigation', () => {
    const adminNavStart = componentSource.indexOf('const adminNavItems = computed')
    const baseItemsEnd = componentSource.indexOf('const visible = applyFeatureFlags(baseItems)')
    const adminBaseItems = componentSource.slice(adminNavStart, baseItemsEnd)

    expect(adminNavStart).toBeGreaterThan(-1)
    expect(baseItemsEnd).toBeGreaterThan(adminNavStart)
    expect(adminBaseItems).not.toContain('createModelPlazaNavItem()')
  })

  it('adds the feature-filtered model plaza entry to the admin simple-mode user area', () => {
    expect(componentSource).toContain(
      'filtered.push(...applyFeatureFlags([createModelPlazaNavItem()]))'
    )
  })

  it('removes the duplicate model plaza entry from the authenticated header', () => {
    expect(headerSource).not.toContain("path: '/model-plaza'")
  })
})

describe('AppSidebar custom SVG styles', () => {
  it('does not override uploaded SVG fill or stroke colors', () => {
    expect(componentSource).toContain('.sidebar-svg-icon {')
    expect(componentSource).toContain('color: currentColor;')
    expect(componentSource).toContain('display: block;')
    expect(componentSource).not.toContain('stroke: currentColor;')
    expect(componentSource).not.toContain('fill: none;')
  })
})

describe('AppSidebar scroll position persistence', () => {
  it('binds a template ref to the sidebar nav element', () => {
    expect(componentSource).toContain('ref="sidebarNavRef"')
    expect(componentSource).toContain('sidebar-nav')
  })

  it('declares sidebarNavRef in script setup', () => {
    expect(componentSource).toContain("const sidebarNavRef = ref<HTMLElement | null>(null)")
  })

  it('saves scroll position on beforeUnmount', () => {
    expect(componentSource).toContain('onBeforeUnmount')
    expect(componentSource).toContain('appStore.sidebarScrollTop')
    expect(componentSource).toContain('sidebarNavRef.value.scrollTop')
  })

  it('restores scroll position on mount', () => {
    expect(componentSource).toContain('onMounted')
    expect(componentSource).toContain('appStore.sidebarScrollTop')
    expect(componentSource).toContain('nextTick')
  })
})

describe('AppSidebar header styles', () => {
  it('does not clip the version badge dropdown', () => {
    const sidebarHeaderBlockMatch = styleSource.match(/\.sidebar-header\s*\{[\s\S]*?\n {2}\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\s*\{[\s\S]*?\n\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('@apply overflow-hidden;')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow: hidden;')
  })

  it('gives the site name its own two-line brand area', () => {
    expect(componentSource).toContain(':title="siteName"')
    expect(componentSource).toContain('-webkit-line-clamp: 2;')
    expect(componentSource).toContain('max-width: 100%;')
  })

  it('moves the version control to the bottom tools and opens it upward', () => {
    const headerEnd = componentSource.indexOf('<!-- Navigation -->')
    const headerSource = componentSource.slice(0, headerEnd)

    expect(headerSource).not.toContain('<VersionBadge')
    expect(componentSource).toContain('<VersionBadge :version="siteVersion" placement="top" />')
    expect(componentSource.indexOf('<VersionBadge')).toBeGreaterThan(
      componentSource.indexOf('<!-- Bottom Section -->')
    )
  })
})
