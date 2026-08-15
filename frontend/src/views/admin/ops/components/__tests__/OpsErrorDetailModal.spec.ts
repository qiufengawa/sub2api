import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OpsErrorDetailModal from '../OpsErrorDetailModal.vue'

const {
  getRequestErrorDetail,
  getUpstreamErrorDetail,
  listRequestErrorUpstreamErrors,
  showError,
} = vi.hoisted(() => ({
  getRequestErrorDetail: vi.fn(),
  getUpstreamErrorDetail: vi.fn(),
  listRequestErrorUpstreamErrors: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    getRequestErrorDetail,
    getUpstreamErrorDetail,
    listRequestErrorUpstreamErrors,
  },
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({ showError }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const requestDetail = {
  id: 9,
  created_at: '2026-08-16T09:00:00Z',
  request_id: 'req-main',
  client_request_id: 'client-main',
  phase: 'request',
  error_owner: 'client',
  status_code: 500,
  platform: 'openai',
  requested_model: 'gpt-5',
  upstream_model: 'gpt-5-mini',
  group_name: 'primary',
  user_email: 'user@example.com',
  message: 'request failed',
  error_body: '{"error":{"message":"request failed"}}',
  is_business_limited: false,
}

const upstreamDetail = {
  ...requestDetail,
  id: 11,
  request_id: 'req-upstream',
  phase: 'upstream',
  error_owner: 'provider',
  account_name: 'provider-account',
  upstream_error_detail: '{"detail":"provider response"}',
}

describe('OpsErrorDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRequestErrorDetail.mockResolvedValue(requestDetail)
    getUpstreamErrorDetail.mockResolvedValue(upstreamDetail)
    listRequestErrorUpstreamErrors.mockResolvedValue({
      items: [upstreamDetail],
      total: 1,
    })
  })

  it('loads request detail and expands the correlated upstream response', async () => {
    const wrapper = mount(OpsErrorDetailModal, {
      attachTo: document.body,
      props: { show: true, errorId: 9, errorType: 'request' },
    })
    await flushPromises()

    expect(getRequestErrorDetail).toHaveBeenCalledWith(9)
    expect(listRequestErrorUpstreamErrors).toHaveBeenCalledWith(
      9,
      { page: 1, page_size: 100, view: 'all' },
      { include_detail: true }
    )
    expect(document.body.textContent).toContain('req-main')
    expect(document.body.textContent).toContain('req-upstream')

    const expand = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.includes('admin.ops.errorDetail.responsePreview.expand')
    )
    expand?.click()
    await flushPromises()
    expect(document.body.textContent).toContain('provider response')

    wrapper.unmount()
  })

  it('loads upstream detail without requesting correlated request errors', async () => {
    const wrapper = mount(OpsErrorDetailModal, {
      attachTo: document.body,
      props: { show: true, errorId: 11, errorType: 'upstream' },
    })
    await flushPromises()

    expect(getUpstreamErrorDetail).toHaveBeenCalledWith(11)
    expect(getRequestErrorDetail).not.toHaveBeenCalled()
    expect(listRequestErrorUpstreamErrors).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('provider-account')

    wrapper.unmount()
  })
})
