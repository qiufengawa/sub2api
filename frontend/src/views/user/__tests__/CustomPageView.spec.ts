import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import CustomPageView from '../CustomPageView.vue'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../CustomPageView.vue')
const componentSource = readFileSync(componentPath, 'utf8')

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
    'common.collapse': 'Collapse',
    'customPage.tableOfContents': 'Table of contents',
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
    appState.fetchPublicSettings.mockReset()
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
    expect(wrapper.get('iframe').attributes('src')).not.toContain('token=')
    expect(wrapper.get('a').attributes('target')).toBe('_blank')
    wrapper.unmount()
  })

  it('shows a retryable settings error instead of a false not-found state', async () => {
    appState.publicSettingsLoaded = false
    appState.fetchPublicSettings.mockResolvedValue(null)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Failed to load document')
    expect(wrapper.text()).not.toContain('customPage.notFoundTitle')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(appState.fetchPublicSettings).toHaveBeenNthCalledWith(1, false)
    expect(appState.fetchPublicSettings).toHaveBeenNthCalledWith(2, true)
    wrapper.unmount()
  })

  it('renders an explicit empty state for an empty Markdown document', async () => {
    appState.cachedPublicSettings.custom_menu_items = [
      { ...menuBase, url: 'md:developer-guide', page_slug: 'developer-guide' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '' }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('customPage.emptyTitle')
    expect(wrapper.find('article').exists()).toBe(false)
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('keeps visual-only Markdown HTML instead of treating it as empty', async () => {
    appState.cachedPublicSettings.custom_menu_items = [
      { ...menuBase, url: 'md:developer-guide', page_slug: 'developer-guide' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>',
    }))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('article').exists()).toBe(true)
    expect(wrapper.find('article svg').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('customPage.emptyTitle')
    vi.unstubAllGlobals()
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

    const retry = wrapper.get('.ui-error-state button')
    expect(retry.text()).toBe('Retry')
    await retry.trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Ready')
    expect(wrapper.text()).toContain('Markdown document')
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('keeps desktop and compact TOC disclosure relationships addressable', async () => {
    appState.cachedPublicSettings.custom_menu_items = [
      { ...menuBase, url: 'md:developer-guide', page_slug: 'developer-guide' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '# Ready\n\n## Details',
    }))

    window.innerWidth = 1024
    const desktop = mountView()
    await flushPromises()
    const desktopToc = desktop.get('#custom-page-toc')
    const collapse = desktopToc.get('button')
    expect(collapse.attributes('aria-controls')).toBe('custom-page-toc')
    expect(collapse.attributes('aria-expanded')).toBe('true')
    await collapse.trigger('click')
    const desktopOpen = desktop.get('button.custom-toc-toggle')
    expect(desktopOpen.attributes('aria-controls')).toBe('custom-page-toc')
    expect(desktopOpen.attributes('aria-expanded')).toBe('false')
    desktop.unmount()

    window.innerWidth = 390
    const compact = mountView()
    await flushPromises()
    const compactOpen = compact.get('button.custom-toc-toggle')
    expect(compactOpen.attributes('aria-controls')).toBe('custom-page-toc')
    await compactOpen.trigger('click')
    await flushPromises()
    expect(document.body.querySelector('#custom-page-toc')).toBeTruthy()
    compact.unmount()
    window.innerWidth = 1024
    vi.unstubAllGlobals()
  })

  it('aborts an in-flight Markdown request when the page unmounts', async () => {
    appState.cachedPublicSettings.custom_menu_items = [
      { ...menuBase, url: 'md:developer-guide', page_slug: 'developer-guide' },
    ]
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mountView()
    await flushPromises()
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined

    expect(requestInit?.signal?.aborted).toBe(false)
    wrapper.unmount()
    expect(requestInit?.signal?.aborted).toBe(true)
    vi.unstubAllGlobals()
  })

  it('uses shared UI contracts without legacy control or palette classes', () => {
    expect(componentSource).not.toMatch(/class="[^"]*\b(?:btn|input|card)\b/)
    expect(componentSource).not.toContain('dark:')
    expect(componentSource).not.toContain('@apply')
    expect(componentSource).not.toContain(':deep(')
    expect(componentSource).not.toContain('!important')
  })
})
