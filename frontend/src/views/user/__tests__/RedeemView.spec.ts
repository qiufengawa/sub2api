import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RedeemView from '../RedeemView.vue'

const {
  getHistory,
  redeem,
  getPublicSettings,
  refreshUser,
  fetchActiveSubscriptions,
  showSuccess,
  showWarning,
  showError,
  authState,
} = vi.hoisted(() => ({
  getHistory: vi.fn(),
  redeem: vi.fn(),
  getPublicSettings: vi.fn(),
  refreshUser: vi.fn(),
  fetchActiveSubscriptions: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showError: vi.fn(),
  authState: {
    user: { balance: 82.36, concurrency: 6 },
    refreshUser: vi.fn(),
  },
}))

vi.mock('@/api', () => ({
  redeemAPI: { getHistory, redeem },
  authAPI: { getPublicSettings },
}))

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showSuccess, showWarning, showError }),
}))
vi.mock('@/stores/subscriptions', () => ({
  useSubscriptionStore: () => ({ fetchActiveSubscriptions }),
}))
vi.mock('@/utils/format', () => ({ formatDateTime: (value: string) => `date:${value}` }))
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => params ? `${key}:${JSON.stringify(params)}` : key,
    }),
  }
})

const historyRows = [
  {
    id: 1,
    code: 'TEST-UI-BALANCE-20',
    type: 'balance',
    value: 20,
    status: 'used',
    used_at: '2026-07-29T08:00:00Z',
    created_at: '2026-07-28T08:00:00Z',
    notes: 'SUB2API_TEST_UI_PREVIEW',
  },
  {
    id: 2,
    code: 'TEST-UI-SUBSCRIPTION-30',
    type: 'subscription',
    value: 1,
    status: 'used',
    used_at: '2026-07-28T08:00:00Z',
    created_at: '2026-07-27T08:00:00Z',
    validity_days: 30,
    group: { id: 3, name: 'Claude Team' },
  },
]

function mountRedeemView() {
  return mount(RedeemView, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        Icon: true,
      },
    },
  })
}

describe('user RedeemView', () => {
  beforeEach(() => {
    getHistory.mockReset()
    redeem.mockReset()
    getPublicSettings.mockReset()
    refreshUser.mockReset()
    fetchActiveSubscriptions.mockReset()
    showSuccess.mockReset()
    showWarning.mockReset()
    showError.mockReset()

    authState.refreshUser = refreshUser
    authState.user = { balance: 82.36, concurrency: 6 }
    getHistory.mockResolvedValue(historyRows)
    getPublicSettings.mockResolvedValue({ contact_info: 'support@example.com' })
    refreshUser.mockResolvedValue(undefined)
    fetchActiveSubscriptions.mockResolvedValue(undefined)
  })

  it('uses the stable activity and action workspace layout', async () => {
    const wrapper = mountRedeemView()
    await flushPromises()

    expect(wrapper.get('[data-testid="redeem-history"]').classes()).toContain('redeem-history')
    expect(wrapper.get('[data-testid="redeem-actions"]').classes()).toContain('redeem-sidebar')
    expect(wrapper.get('[data-testid="redeem-actions"]').find('[data-testid="redeem-help"]').exists()).toBe(true)
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.text()).toContain('TEST-UI-BALANCE-20')
    expect(wrapper.text()).toContain('$82.36')
  })

  it('preserves subscription redemption refresh behavior inside the compact form', async () => {
    redeem.mockResolvedValue({
      message: 'ok',
      type: 'subscription',
      value: 1,
      plan_name: 'Claude Team',
      validity_days: 30,
    })

    const wrapper = mountRedeemView()
    await flushPromises()
    await wrapper.get('#code').setValue('TEST-UI-SUBSCRIPTION-30')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(redeem).toHaveBeenCalledWith('TEST-UI-SUBSCRIPTION-30')
    expect(refreshUser).toHaveBeenCalled()
    expect(fetchActiveSubscriptions).toHaveBeenCalledWith(true)
    expect(getHistory).toHaveBeenCalledTimes(2)
    expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
    expect(wrapper.text()).toContain('redeem.redeemSuccess')
    expect(wrapper.text()).toContain('Claude Team')
  })

  it('shows stable history rows while the initial request is pending', async () => {
    let resolveHistory!: (rows: typeof historyRows) => void
    getHistory.mockImplementationOnce(() => new Promise((resolve) => {
      resolveHistory = resolve
    }))

    const wrapper = mountRedeemView()
    expect(wrapper.find('.redeem-history-skeleton').exists()).toBe(true)

    resolveHistory(historyRows)
    await flushPromises()

    expect(wrapper.find('.redeem-history-skeleton').exists()).toBe(false)
    expect(wrapper.findAll('article')).toHaveLength(2)
    wrapper.unmount()
  })

  it('queues the post-redemption history refresh behind an initial pending request', async () => {
    let resolveHistory!: (rows: typeof historyRows) => void
    getHistory.mockImplementationOnce(() => new Promise((resolve) => {
      resolveHistory = resolve
    }))
    redeem.mockResolvedValue({ message: 'ok', type: 'balance', value: 20 })

    const wrapper = mountRedeemView()
    await wrapper.get('#code').setValue('TEST-UI-BALANCE-20')
    const submit = wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(getHistory).toHaveBeenCalledTimes(1)
    resolveHistory(historyRows)
    await submit
    await flushPromises()

    expect(getHistory).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(showSuccess).toHaveBeenCalledWith('redeem.codeRedeemSuccess')
    wrapper.unmount()
  })

  it('prevents duplicate redemption submissions while one request is pending', async () => {
    let resolveRedeem!: (value: {
      message: string
      type: string
      value: number
    }) => void
    redeem.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRedeem = resolve
    }))

    const wrapper = mountRedeemView()
    await flushPromises()
    await wrapper.get('#code').setValue('TEST-UI-BALANCE-20')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(redeem).toHaveBeenCalledTimes(1)

    resolveRedeem({ message: 'ok', type: 'balance', value: 20 })
    await flushPromises()
    wrapper.unmount()
  })

  it('renders a retryable history error instead of the empty state', async () => {
    getHistory.mockRejectedValueOnce(new Error('network unavailable'))
    const wrapper = mountRedeemView()
    await flushPromises()

    expect(wrapper.text()).toContain('redeem.historyLoadFailed')
    expect(wrapper.text()).not.toContain('redeem.historyWillAppear')

    getHistory.mockResolvedValueOnce(historyRows)
    await wrapper.get('[data-testid="redeem-history"] button').trigger('click')
    await flushPromises()

    expect(getHistory).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('article')).toHaveLength(2)
    wrapper.unmount()
  })

  it('preserves existing history when a refresh fails', async () => {
    const wrapper = mountRedeemView()
    await flushPromises()
    expect(wrapper.findAll('article')).toHaveLength(2)

    getHistory.mockRejectedValueOnce(new Error('refresh unavailable'))
    await (wrapper.vm as unknown as { fetchHistory: () => Promise<void> }).fetchHistory()
    await flushPromises()

    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.text()).toContain('redeem.historyLoadFailed')

    getHistory.mockResolvedValueOnce(historyRows)
    await wrapper.get('[data-testid="redeem-history-retry"]').trigger('click')
    await flushPromises()

    expect(getHistory).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).not.toContain('redeem.historyLoadFailed')
    wrapper.unmount()
  })
})
