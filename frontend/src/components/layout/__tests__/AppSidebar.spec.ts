import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppSidebar.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const headerPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppHeader.vue')
const headerSource = readFileSync(headerPath, 'utf8')

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

describe('AppSidebar playground navigation', () => {
  it('places playground immediately after API keys and before batch images', () => {
    const keyIndex = componentSource.indexOf("{ path: '/keys'")
    const playgroundIndex = componentSource.indexOf("{ path: '/playground'", keyIndex)
    const batchImageIndex = componentSource.indexOf("{ path: '/batch-image'", keyIndex)

    expect(keyIndex).toBeGreaterThan(-1)
    expect(playgroundIndex).toBeGreaterThan(keyIndex)
    expect(batchImageIndex).toBeGreaterThan(playgroundIndex)
    expect(componentSource).toContain(
      'const flagPlayground = makeSidebarFlag(FeatureFlags.playground)'
    )
  })

  it('keeps playground in the shared personal menu and restores it in admin simple mode', () => {
    expect(componentSource).toContain("{ path: '/playground', label: t('nav.playground'), icon: 'beaker', featureFlag: flagPlayground }")
    expect(componentSource).toContain("filtered.push(...applyFeatureFlags([{ path: '/playground'")
  })
})

describe('AppSidebar icon contract', () => {
  it('renders every navigation icon through the shared Lucide registry', () => {
    expect(componentSource).toContain("import Icon from '@/components/icons/Icon.vue'")
    expect(componentSource).toContain('<Icon :name="item.icon" size="sm" />')
    expect(componentSource).toContain("icon: 'link'")
    expect(componentSource).not.toContain('v-html')
    expect(componentSource).not.toContain('sanitizeSvg')
    expect(componentSource).not.toContain("h('svg'")
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
    const sidebarHeaderBlockMatch = componentSource.match(/\.sidebar-header\{[^}]*\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\{[^}]*\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('overflow:hidden')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow:hidden')
  })

  it('centers the horizontal logo and keeps a text fallback', () => {
    expect(componentSource).toContain(':title="siteName"')
    expect(componentSource).toContain('v-if="siteLogo"')
    expect(componentSource).toContain('<span v-else>{{ siteName }}</span>')
    expect(componentSource).toContain('object-position:center')
  })

  it('removes the hidden brand link from the collapsed keyboard order', () => {
    expect(componentSource).toContain('v-show="!sidebarCollapsed"')
    expect(componentSource).toContain(':tabindex="sidebarCollapsed ? -1 : undefined"')
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
