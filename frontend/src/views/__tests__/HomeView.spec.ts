import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'

import HomeView from '../HomeView.vue'

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  fetchPublicSettings: vi.fn(),
}))

const authStore = reactive({
  isAuthenticated: false,
  isAdmin: false,
  checkAuth: mocks.checkAuth,
})

const appStore = reactive({
  publicSettingsLoaded: true,
  siteName: 'Fallback Site',
  siteLogo: '/fallback-logo.svg',
  docUrl: 'https://fallback.example/docs',
  cachedPublicSettings: {} as Record<string, unknown>,
  fetchPublicSettings: mocks.fetchPublicSettings,
})

vi.mock('@/stores', () => ({
  useAuthStore: () => authStore,
  useAppStore: () => appStore,
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: { site?: string }) => params?.site ? `${key}:${params.site}` : key,
    }),
  }
})

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

async function mountHome() {
  const wrapper = mount(HomeView, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        HomeSiteHeader: {
          props: ['siteName', 'siteLogo', 'docUrl', 'isAuthenticated', 'dashboardPath', 'modelPlazaEnabled'],
          template: '<header data-test="site-header" />',
        },
        Icon: true,
        PlatformIcon: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('HomeView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    authStore.isAuthenticated = false
    authStore.isAdmin = false
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = {}
  })

  it('renders backend branding and service URLs without replacing dynamic settings', async () => {
    appStore.cachedPublicSettings = {
      site_name: 'Qiu API Enterprise Gateway With A Long Name',
      site_logo: '/uploads/qiu-logo.svg',
      site_subtitle: 'One key for every production model',
      api_base_url: 'https://api.example.test/v1/',
      doc_url: 'https://docs.example.test/start',
      model_plaza_enabled: true,
      registration_enabled: true,
    }

    const wrapper = await mountHome()

    expect(wrapper.get('h1').text()).toBe('Qiu API Enterprise Gateway With A Long Name')
    expect(wrapper.get('h2').text()).toBe('One key for every production model')
    expect(wrapper.get('.qiu-board-logo img').attributes('src')).toBe('/uploads/qiu-logo.svg')
    expect(wrapper.get('.qiu-code').text()).toContain('https://api.example.test/v1')
    expect(wrapper.get('.qiu-code').text()).not.toContain('/v1/')
    expect(wrapper.text()).toContain('home.sections.prompts.items.integration.text:Qiu API Enterprise Gateway With A Long Name')
    expect(wrapper.text()).toContain('home.sections.faq.items.official.question:Qiu API Enterprise Gateway With A Long Name')
    expect(wrapper.findAll('a[href="/model-plaza"]')).toHaveLength(2)
    expect(wrapper.get('a[href="https://docs.example.test/start"]').attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.get('a[href="/register"]').exists()).toBe(true)
    expect(mocks.checkAuth).toHaveBeenCalledOnce()
    expect(mocks.fetchPublicSettings).not.toHaveBeenCalled()
  })

  it('uses login or role-specific dashboards for the primary action', async () => {
    appStore.cachedPublicSettings = { registration_enabled: false }
    let wrapper = await mountHome()
    expect(wrapper.get('a[href="/login"]').exists()).toBe(true)
    wrapper.unmount()

    authStore.isAuthenticated = true
    authStore.isAdmin = true
    wrapper = await mountHome()
    expect(wrapper.get('a[href="/admin/dashboard"]').exists()).toBe(true)
  })

  it('sanitizes unsafe public links and fetches settings when the cache is not ready', async () => {
    appStore.publicSettingsLoaded = false
    appStore.cachedPublicSettings = {
      site_logo: 'javascript:alert(1)',
      doc_url: 'javascript:alert(1)',
    }

    const wrapper = await mountHome()

    expect(wrapper.get('.qiu-board-logo img').attributes('src')).toBe('/logo.svg')
    expect(wrapper.find('a[href^="javascript:"]').exists()).toBe(false)
    expect(mocks.fetchPublicSettings).toHaveBeenCalledOnce()
  })

  it('preserves the administrator HTML and iframe home-content override contract', async () => {
    appStore.cachedPublicSettings = { home_content: '<section id="custom-home">Custom landing</section>' }
    let wrapper = await mountHome()
    expect(wrapper.get('#custom-home').text()).toBe('Custom landing')
    expect(wrapper.find('[data-test="site-header"]').exists()).toBe(false)
    wrapper.unmount()

    appStore.cachedPublicSettings = { home_content: 'https://pages.example.test/home' }
    wrapper = await mountHome()
    expect(wrapper.get('iframe').attributes('src')).toBe('https://pages.example.test/home')
    expect(wrapper.get('iframe').classes()).toContain('h-screen')
  })
})
