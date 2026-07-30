import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import CustomPageView from '../CustomPageView.vue'

const { routeState, appState, authState } = vi.hoisted(() => ({
  routeState: { params: { id: 'docs' } },
  appState: {
    publicSettingsLoaded: true,
    cachedPublicSettings: { custom_menu_items: [] as Array<Record<string, unknown>> },
    fetchPublicSettings: vi.fn(),
  },
  authState: { isAdmin: false, user: { id: 7 }, token: 'test-token' },
}))

vi.mock('vue-router', () => ({ useRoute: () => routeState }))
vi.mock('@/stores', () => ({ useAppStore: () => appState }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('@/stores/adminSettings', () => ({ useAdminSettingsStore: () => ({ customMenuItems: [] }) }))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  const messages: Record<string, string> = {
    'customPage.markdownMode': 'Markdown document',
    'customPage.embeddedMode': 'Embedded page',
    'customPage.openInNewTab': 'Open in new tab',
    'common.loadFailed': 'Failed to load document',
    'common.retry': 'Retry',
  }
  return {
    ...actual,
    useI18n: () => ({ locale: { value: 'en' }, t: (key: string) => messages[key] ?? key }),
  }
})

const menuBase = {
  id: 'docs',
  label: 'Developer Guide',
  icon_svg: '',
  visibility: 'user',
  sort_order: 1,
}

function mountView() {
  return mount(CustomPageView, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        Icon: true,
      },
    },
  })
}

describe('CustomPageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    routeState.params.id = 'docs'
    appState.publicSettingsLoaded = true
    appState.cachedPublicSettings.custom_menu_items = []
  })

  it('renders a compact embedded-page header without altering iframe content', async () => {
    appState.cachedPublicSettings.custom_menu_items = [
      { ...menuBase, url: 'https://docs.example.test/guide' },
    ]
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Developer Guide')
    expect(wrapper.text()).toContain('Embedded page')
    expect(wrapper.get('iframe').attributes('src')).toContain('https://docs.example.test/guide')
    expect(wrapper.get('a').attributes('target')).toBe('_blank')
    wrapper.unmount()
  })

  it('shows a dedicated Markdown load error state and retries in place', async () => {
    appState.cachedPublicSettings.custom_menu_items = [
      { ...menuBase, url: 'md:developer-guide', page_slug: 'developer-guide' },
    ]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, text: async () => '# Ready' })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Failed to load document')

    const retry = wrapper.get('button.btn-primary')
    expect(retry.text()).toBe('Retry')
    await retry.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Ready')
    expect(wrapper.text()).toContain('Markdown document')
    vi.unstubAllGlobals()
    wrapper.unmount()
  })
})
