import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LegalDocumentView from '../LegalDocumentView.vue'

const { fetchPublicSettings } = vi.hoisted(() => ({
  fetchPublicSettings: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { documentId: 'admin-compliance' } }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/i18n', () => ({
  getLocale: () => 'zh',
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    cachedPublicSettings: null,
    fetchPublicSettings,
  }),
}))

describe('LegalDocumentView', () => {
  beforeEach(() => {
    fetchPublicSettings.mockReset()
  })

  it('keeps the bundled admin compliance document available when settings fail', async () => {
    fetchPublicSettings.mockResolvedValue(false)

    const wrapper = mount(LegalDocumentView, {
      global: {
        stubs: { Icon: true, RouterLink: { template: '<a><slot /></a>' } },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('adminCompliance.title')
    expect(wrapper.text()).not.toContain('legal.loadFailed')
  })
})
