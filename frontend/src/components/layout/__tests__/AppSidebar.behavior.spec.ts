import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, nextTick } from 'vue'

const routeState = vi.hoisted(() => ({ path: '/dashboard' }))
const routerPush = vi.hoisted(() => vi.fn())
const setMobileOpen = vi.hoisted(() => vi.fn())
const toggleSidebar = vi.hoisted(() => vi.fn())
const refreshBatchImageAccess = vi.hoisted(() => vi.fn().mockResolvedValue(false))
const fetchAdminSettings = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

const appStore = reactive({
  sidebarCollapsed: false,
  mobileOpen: false,
  sidebarScrollTop: 0,
  siteName: 'Qiu API',
  siteLogo: '',
  siteVersion: '0.1.0-test',
  cachedPublicSettings: null as Record<string, unknown> | null,
  backendModeEnabled: false,
  setMobileOpen,
  toggleSidebar,
})

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({ push: routerPush }),
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/stores', () => ({
  useAppStore: () => appStore,
  useAuthStore: () => ({
    isAdmin: false,
    isSimpleMode: false,
    isAuthenticated: true,
  }),
  useOnboardingStore: () => ({
    isCurrentStep: () => false,
    nextStep: vi.fn(),
  }),
  useAdminSettingsStore: () => ({
    opsMonitoringEnabled: true,
    paymentEnabled: true,
    customMenuItems: [],
    fetch: fetchAdminSettings,
  }),
}))

vi.mock('@/utils/featureFlags', () => ({
  FeatureFlags: {
    channelMonitor: {},
    payment: {},
    availableChannels: {},
    modelPlaza: {},
    playground: {},
    affiliate: {},
    riskControl: {},
  },
  makeSidebarFlag: () => () => true,
}))

vi.mock('@/composables/useBatchImageAccess', () => ({
  useBatchImageAccess: () => ({
    canUseBatchImage: { value: false },
    refreshBatchImageAccess,
  }),
}))

import AppSidebar from '../AppSidebar.vue'

function mountSidebar() {
  return mount(AppSidebar, {
    attachTo: document.body,
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a :href="typeof to === \'string\' ? to : to.path"><slot /></a>',
        },
        Icon: true,
        VersionBadge: true,
      },
    },
  })
}

describe('AppSidebar runtime behavior', () => {
  beforeEach(() => {
    appStore.sidebarCollapsed = false
    appStore.mobileOpen = false
    appStore.sidebarScrollTop = 0
    appStore.cachedPublicSettings = null
    setMobileOpen.mockReset().mockImplementation((open: boolean) => {
      appStore.mobileOpen = open
    })
    toggleSidebar.mockReset()
    routerPush.mockReset()
    refreshBatchImageAccess.mockClear()
    fetchAdminSettings.mockClear()
    localStorage.clear()
    document.body.classList.remove('sidebar-open')
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.body.classList.remove('sidebar-open')
    document.documentElement.classList.remove('dark')
    localStorage.clear()
  })

  it('closes the mobile sidebar with Escape and cleans the body lock on unmount', async () => {
    appStore.mobileOpen = true
    const wrapper = mountSidebar()
    await flushPromises()

    expect(document.body.classList.contains('sidebar-open')).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(setMobileOpen).toHaveBeenCalledWith(false)

    setMobileOpen.mockClear()
    wrapper.unmount()
    expect(document.body.classList.contains('sidebar-open')).toBe(false)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(setMobileOpen).not.toHaveBeenCalled()
  })

  it('moves focus into the open sidebar and restores the menu trigger on close', async () => {
    const trigger = document.createElement('button')
    trigger.id = 'app-mobile-menu-trigger'
    document.body.appendChild(trigger)
    trigger.focus()

    appStore.mobileOpen = true
    const wrapper = mountSidebar()
    await flushPromises()
    await nextTick()

    const firstSidebarLink = wrapper.get<HTMLElement>('aside a[href]').element
    expect(document.activeElement).toBe(firstSidebarLink)

    const focusableSidebar = Array.from(
      wrapper.get<HTMLElement>('aside').element.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )
    const lastSidebarControl = focusableSidebar.at(-1)
    expect(lastSidebarControl).toBeDefined()
    lastSidebarControl?.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(firstSidebarLink)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await flushPromises()
    expect(document.activeElement).toBe(trigger)

    wrapper.unmount()
    trigger.remove()
  })

  it('removes the closed mobile sidebar from the accessibility and focus trees', async () => {
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

    appStore.mobileOpen = false
    const closed = mountSidebar()
    await flushPromises()
    expect(['', 'true']).toContain(closed.get('aside').attributes('inert'))
    expect(closed.get('aside').attributes('aria-hidden')).toBe('true')
    closed.unmount()

    appStore.mobileOpen = true
    const open = mountSidebar()
    await flushPromises()
    expect(open.get('aside').attributes('inert')).toBeUndefined()
    expect(open.get('aside').attributes('aria-hidden')).toBeUndefined()
    open.unmount()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    })
  })

  it('closes an open drawer when the viewport crosses into desktop', async () => {
    const originalMatchMedia = window.matchMedia
    let mediaQueryListener: ((event: MediaQueryListEvent) => void) | undefined
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: true,
        media: '(max-width: 1023px)',
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          mediaQueryListener = listener
        },
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })

    try {
      appStore.mobileOpen = true
      const wrapper = mountSidebar()
      await flushPromises()

      mediaQueryListener?.({ matches: false } as MediaQueryListEvent)
      await nextTick()

      expect(setMobileOpen).toHaveBeenCalledWith(false)
      expect(appStore.mobileOpen).toBe(false)
      wrapper.unmount()
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('restores and saves the navigation scroll position across mounts', async () => {
    appStore.sidebarScrollTop = 96
    const wrapper = mountSidebar()
    await flushPromises()
    await wrapper.vm.$nextTick()

    const nav = wrapper.get<HTMLElement>('.sidebar-nav')
    expect(nav.element.scrollTop).toBe(96)
    nav.element.scrollTop = 42
    wrapper.unmount()

    expect(appStore.sidebarScrollTop).toBe(42)
  })

  it('persists the shared light and dark theme state from the footer control', async () => {
    const wrapper = mountSidebar()
    const themeButton = wrapper.findAll('.sidebar-footer-item')[0]
    expect(themeButton).toBeDefined()
    const initialDark = document.documentElement.classList.contains('dark')

    await themeButton!.trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(!initialDark)
    expect(localStorage.getItem('theme')).toBe(initialDark ? 'light' : 'dark')

    await themeButton!.trigger('click')
    expect(document.documentElement.classList.contains('dark')).toBe(initialDark)
    expect(localStorage.getItem('theme')).toBe(initialDark ? 'dark' : 'light')
    wrapper.unmount()
  })
})
