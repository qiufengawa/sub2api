import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UiErrorState, UiPageNav } from '@/components/ui'
import LegalDocumentView from '../LegalDocumentView.vue'

const { fetchPublicSettings, push, routeState, storeState } = vi.hoisted(() => ({
  fetchPublicSettings: vi.fn(),
  push: vi.fn(),
  routeState: { params: { documentId: 'admin-compliance' } },
  storeState: {
    cachedPublicSettings: null as any,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push }),
  RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.date ? `${key}:${params.date}` : key,
  }),
}))

vi.mock('@/i18n', () => ({
  getLocale: () => 'zh',
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    get cachedPublicSettings() {
      return storeState.cachedPublicSettings
    },
    fetchPublicSettings,
  }),
}))

function mountView() {
  return mount(LegalDocumentView, {
    global: {
      stubs: { Icon: true },
    },
  })
}

describe('LegalDocumentView', () => {
  beforeEach(() => {
    routeState.params.documentId = 'admin-compliance'
    storeState.cachedPublicSettings = null
    fetchPublicSettings.mockReset()
    push.mockReset()
  })

  it('keeps the bundled admin compliance document available when settings fail', async () => {
    fetchPublicSettings.mockResolvedValue(false)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('adminCompliance.title')
    expect(wrapper.text()).not.toContain('legal.loadFailed')
    expect(wrapper.get('article').attributes('aria-label')).toBe('adminCompliance.title')
    wrapper.unmount()
  })

  it('renders a sanitized document with stable heading anchors and a contents list', async () => {
    routeState.params.documentId = 'terms'
    storeState.cachedPublicSettings = {
      site_name: 'Qiu API',
      site_logo: 'javascript:alert(1)',
      login_agreement_updated_at: '2026-08-16',
      login_agreement_documents: [
        {
          id: 'terms',
          title: 'Terms',
          content_md: '## Scope\n\nRead this.\n\n### Limits\n\n<script>alert(1)</script>\n[unsafe](javascript:alert(2))\n[docs](https://example.test/docs)',
        },
      ],
    }
    fetchPublicSettings.mockResolvedValue(true)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('h2#legal-section-1').text()).toBe('Scope')
    expect(wrapper.get('h3#legal-section-2').text()).toBe('Limits')
    expect(wrapper.get('nav[aria-label="legal.tableOfContents"] a[href="#legal-section-1"]').text()).toBe('Scope')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('a[href^="javascript:"]').exists()).toBe(false)
    const external = wrapper.get('a[href="https://example.test/docs"]')
    expect(external.attributes('target')).toBe('_blank')
    expect(external.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.find('.legal-brand img').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows a persistent retryable load failure for remote documents', async () => {
    routeState.params.documentId = 'terms'
    fetchPublicSettings.mockResolvedValue(false)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.getComponent(UiErrorState).text()).toContain('legal.loadFailed')
    await wrapper.getComponent(UiErrorState).get('button').trigger('click')
    await flushPromises()
    expect(fetchPublicSettings).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('uses the empty state when settings load but the requested document is absent', async () => {
    routeState.params.documentId = 'missing'
    storeState.cachedPublicSettings = { login_agreement_documents: [] }
    fetchPublicSettings.mockResolvedValue(true)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('legal.notFound')
    expect(wrapper.find('article').exists()).toBe(false)
    wrapper.unmount()
  })

  it('navigates between configured legal documents through the shared page navigation', async () => {
    routeState.params.documentId = 'terms'
    storeState.cachedPublicSettings = {
      login_agreement_documents: [
        { id: 'terms', title: 'Terms', content_md: 'Terms' },
        { id: 'privacy', title: 'Privacy', content_md: 'Privacy' },
      ],
    }
    fetchPublicSettings.mockResolvedValue(true)

    const wrapper = mountView()
    await flushPromises()
    const navigation = wrapper.getComponent(UiPageNav)
    expect(navigation.props('next')).toEqual({ key: 'privacy', label: 'Privacy' })
    navigation.vm.$emit('navigate', 'privacy')

    expect(push).toHaveBeenCalledWith({ name: 'LegalDocument', params: { documentId: 'privacy' } })
    wrapper.unmount()
  })
})
