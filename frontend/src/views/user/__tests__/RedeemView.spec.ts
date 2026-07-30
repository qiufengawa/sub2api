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

  it('uses the full-width activity and compact action layout in stable responsive order', async () => {
    const wrapper = mountRedeemView()
    await flushPromises()

    expect(wrapper.get('[data-testid="redeem-history"]').classes()).toEqual(expect.arrayContaining([
      'order-2',
      'md:order-1',
      'md:col-span-8',
    ]))
    expect(wrapper.get('[data-testid="redeem-actions"]').classes()).toEqual(expect.arrayContaining([
      'order-1',
      'md:order-2',
      'md:col-span-4',
    ]))
    expect(wrapper.get('[data-testid="redeem-actions"]').find('[data-testid="redeem-help"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="redeem-actions"]').classes()).toContain('card')
    expect(wrapper.findAll('article')).toHaveLength(2)
    expect(wrapper.text()).toContain('TEST-UI-BALANCE-20')
    expect(wrapper.text()).toContain('$82.36')
  })

  it('preserves subscription redemption refresh behavior inside the compact form', async () => {
    redeem.mockResolvedValue({
      message: 'ok',
      type: 'subscription',
      value: 1,
      group_name: 'Claude Team',
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
  })
})
