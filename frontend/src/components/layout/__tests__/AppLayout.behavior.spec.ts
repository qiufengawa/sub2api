import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const appStore = reactive({
  sidebarCollapsed: false,
  mobileOpen: false,
})
const authStore = reactive({
  user: { role: 'user' as string },
})

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStore,
}))

import AppLayout from '../AppLayout.vue'

function mountLayout() {
  return mount(AppLayout, {
    global: {
      stubs: {
        AppSidebar: { template: '<aside data-test="app-sidebar" />' },
        AppHeader: { template: '<header data-test="app-header" />' },
      },
    },
    slots: {
      default: '<div data-test="page-content">page content</div>',
    },
  })
}

describe('AppLayout runtime behavior', () => {
  beforeEach(() => {
    appStore.sidebarCollapsed = false
    appStore.mobileOpen = false
    authStore.user = { role: 'user' }
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps the workspace shell and page slot mounted for the expanded sidebar', () => {
    const wrapper = mountLayout()

    expect(wrapper.get('.app-shell').classes()).not.toContain('app-shell--collapsed')
    expect(wrapper.get('[data-test="app-sidebar"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="app-header"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="page-content"]').text()).toBe('page content')
  })

  it('reflects the collapsed sidebar state without replacing the workspace', () => {
    appStore.sidebarCollapsed = true
    const wrapper = mountLayout()

    expect(wrapper.get('.app-shell').classes()).toContain('app-shell--collapsed')
    expect(wrapper.get('.app-shell__workspace').exists()).toBe(true)
    expect(wrapper.get('[data-test="page-content"]').exists()).toBe(true)
  })

  it('makes the workspace inert while the mobile sidebar overlay is open', () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: true,
        media: '(max-width: 1023px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })
    appStore.mobileOpen = true
    const wrapper = mountLayout()

    expect(wrapper.get('.app-shell__workspace').attributes('inert')).toBeDefined()
    wrapper.unmount()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    })
  })

})
