import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SubscriptionsView from '../SubscriptionsView.vue'
import type { UserSubscription } from '@/types'

const { getMySubscriptions, routerPush, showError } = vi.hoisted(() => ({
  getMySubscriptions: vi.fn(),
  routerPush: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/subscriptions', () => ({
  default: { getMySubscriptions },
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: routerPush }),
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    cachedPublicSettings: { server_utc_offset: 8 },
    showError,
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => params
        ? `${key}:${JSON.stringify(params)}`
        : key,
    }),
  }
})

vi.mock('@/utils/format', () => ({
  formatDateTimeToMinute: (value: Date) => `date:${value.toISOString()}`,
}))

vi.mock('@/utils/peak-rate', () => ({
  hasPeakRate: (group: { peak_rate_enabled?: boolean }) => Boolean(group?.peak_rate_enabled),
  serverTimezoneLabel: () => 'UTC+08:00',
}))

vi.mock('@/utils/platformColors', () => ({
  platformBadgeClass: (platform: string) => `badge-${platform}`,
  platformLabel: (platform: string) => `platform:${platform}`,
}))

const baseGroup = {
  id: 11,
  name: 'TEST-UI-SUB-企业版',
  description: '接近日额度上限',
  platform: 'openai',
  rate_multiplier: 1,
  daily_limit_usd: 10,
  weekly_limit_usd: 45,
  monthly_limit_usd: 160,
  peak_rate_enabled: true,
  peak_start: '09:00',
  peak_end: '18:00',
  peak_rate_multiplier: 1.15,
}

const subscriptionFixtures = [
  {
    id: 1,
    user_id: 13,
    group_id: 11,
    status: 'active',
    starts_at: '2026-07-01T00:00:00Z',
    expires_at: '2099-08-05T00:00:00Z',
    daily_usage_usd: 9.25,
    weekly_usage_usd: 31.8,
    monthly_usage_usd: 86.4,
    daily_window_start: '2099-08-04T16:00:00Z',
    weekly_window_start: '2099-08-01T00:00:00Z',
    monthly_window_start: '2099-07-15T00:00:00Z',
    group: baseGroup,
  },
  {
    id: 2,
    user_id: 13,
    group_id: 12,
    status: 'active',
    starts_at: '2026-07-01T00:00:00Z',
    expires_at: '2099-08-25T00:00:00Z',
    daily_usage_usd: 6.2,
    weekly_usage_usd: 24.5,
    monthly_usage_usd: 112,
    daily_window_start: null,
    weekly_window_start: null,
    monthly_window_start: null,
    group: {
      ...baseGroup,
      id: 12,
      name: 'TEST-UI-SUB-稳定版',
      platform: 'anthropic',
      daily_limit_usd: 20,
      weekly_limit_usd: 80,
      monthly_limit_usd: 300,
      peak_rate_enabled: false,
    },
  },
  {
    id: 3,
    user_id: 13,
    group_id: 13,
    status: 'active',
    starts_at: '2026-07-01T00:00:00Z',
    expires_at: '2099-09-23T00:00:00Z',
    daily_usage_usd: 0,
    weekly_usage_usd: 0,
    monthly_usage_usd: 0,
    daily_window_start: null,
    weekly_window_start: null,
    monthly_window_start: null,
    group: {
      ...baseGroup,
      id: 13,
      name: 'TEST-UI-SUB-无限版',
      platform: 'gemini',
      daily_limit_usd: null,
      weekly_limit_usd: null,
      monthly_limit_usd: null,
      peak_rate_enabled: false,
    },
  },
] as unknown as UserSubscription[]

function mountSubscriptionsView() {
  return mount(SubscriptionsView, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        BaseDialog: {
          props: ['show', 'title'],
          template: '<section v-if="show" data-testid="base-dialog"><h2>{{ title }}</h2><slot /><slot name="footer" /></section>',
        },
        Icon: true,
        PlatformIcon: {
          props: ['platform'],
          template: '<i data-platform-icon :data-platform="platform" />',
        },
      },
    },
  })
}

describe('user SubscriptionsView', () => {
  beforeEach(() => {
    getMySubscriptions.mockReset().mockResolvedValue([...subscriptionFixtures].reverse())
    routerPush.mockReset()
    showError.mockReset()
  })

  it('shows a compact summary and caps subscription records at two columns', async () => {
    const wrapper = mountSubscriptionsView()
    await flushPromises()

    expect(wrapper.get('[data-testid="subscription-summary"]').text()).toContain('3')
    expect(wrapper.get('[data-testid="subscription-summary"]').text()).toContain('93%')
    expect(wrapper.get('[data-testid="subscription-summary"]').classes()).toEqual(expect.arrayContaining([
      'grid-cols-1',
      'sm:grid-cols-3',
    ]))
    expect(wrapper.get('[data-testid="subscriptions-grid"]').classes()).toEqual(expect.arrayContaining([
      'md:grid-cols-2',
    ]))
    expect(wrapper.get('[data-testid="subscriptions-grid"]').classes()).not.toContain('xl:grid-cols-3')
    expect(wrapper.findAll('[data-testid="subscription-card"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="unlimited-quota"]')).toHaveLength(1)
    const firstCard = wrapper.findAll('[data-testid="subscription-card"]')[0]
    expect(firstCard.text()).toContain('TEST-UI-SUB-企业版')
    expect(firstCard.get('[data-testid="platform-badge"]').classes()).toContain('badge-openai')
    expect(firstCard.get('[data-platform-icon]').attributes('data-platform')).toBe('openai')
  })

  it('sorts quota rows by risk and preserves the renewal route', async () => {
    const wrapper = mountSubscriptionsView()
    await flushPromises()

    const firstCard = wrapper.findAll('[data-testid="subscription-card"]')[0]
    const quotaRows = firstCard.findAll('[data-testid="quota-row"]')
    expect(quotaRows[0].text()).toContain('userSubscriptions.daily')
    expect(quotaRows[0].text()).toContain('93%')
    expect(quotaRows[1].text()).toContain('userSubscriptions.weekly')
    expect(firstCard.get('[data-testid="base-rate"]').text()).toBe('×1')
    expect(firstCard.get('[data-testid="peak-rate"]').text()).toBe('×1.15')
    expect(firstCard.get('[data-testid="peak-window"]').text()).toContain('09:00-18:00 · UTC+08:00')
    expect(firstCard.get('[data-testid="peak-window"]').text()).not.toContain('×1.15')
    expect(firstCard.get('[data-testid="expiration-remaining"]').text()).toContain('userSubscriptions.daysCompact')
    expect(firstCard.get('[data-testid="expiration-date"]').text()).toContain('2099-08-05')

    await firstCard.get('button').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/purchase',
      query: { tab: 'subscription', group: '11' },
    })
  })

  it('opens the create and bind key flows for the selected active subscription', async () => {
    const wrapper = mountSubscriptionsView()
    await flushPromises()

    const firstCard = wrapper.findAll('[data-testid="subscription-card"]')[0]
    expect(firstCard.get('[data-testid="subscription-key-actions"]').exists()).toBe(true)

    await firstCard.get('[data-testid="create-subscription-key"]').trigger('click')
    expect(routerPush).toHaveBeenLastCalledWith({
      path: '/keys',
      query: { action: 'create', group_id: '11', source: 'subscription' },
    })

    await firstCard.get('[data-testid="bind-subscription-key"]').trigger('click')
    expect(routerPush).toHaveBeenLastCalledWith({
      path: '/keys',
      query: { action: 'bind', group_id: '11', source: 'subscription' },
    })
  })

  it('asks for a real routing group when a subscription includes multiple groups', async () => {
    getMySubscriptions.mockResolvedValueOnce([{
      ...subscriptionFixtures[0],
      included_groups: [
        { ...baseGroup, id: 201, name: 'GPT-1', rate_multiplier: 0.1 },
        { ...baseGroup, id: 202, name: 'GPT-2', platform: 'anthropic', rate_multiplier: 0.2 },
      ],
    }])
    const wrapper = mountSubscriptionsView()
    await flushPromises()

    await wrapper.get('[data-testid="create-subscription-key"]').trigger('click')
    expect(routerPush).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="subscription-key-group-dialog"]').text()).toContain('GPT-1')
    expect(wrapper.get('[data-testid="subscription-key-group-dialog"]').text()).toContain('GPT-2')

    await wrapper.get('input[value="202"]').setValue(true)
    await wrapper.get('[data-testid="confirm-subscription-key-group"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/keys',
      query: { action: 'create', group_id: '202', source: 'subscription' },
    })
    expect(wrapper.find('[data-testid="subscription-key-group-dialog"]').exists()).toBe(false)
  })

  it('counts pending settlement in cycle capacity without calling it used', async () => {
    getMySubscriptions.mockResolvedValueOnce([{
      ...subscriptionFixtures[0],
      cycle_quota_usd: 10,
      cycle_usage_usd: 7,
      cycle_reserved_usd: 2,
      reset_interval_seconds: 604800,
      cycle_started_at: '2099-08-01T00:00:00Z',
    }])
    const wrapper = mountSubscriptionsView()
    await flushPromises()

    const quota = wrapper.get('[data-testid="quota-row"]')
    expect(quota.text()).toContain('90%')
    expect(quota.text()).toContain('$7.00 / $10.00')
    expect(quota.get('[data-testid="quota-reserved"]').text()).toContain('"amount":"2.00"')
    expect(quota.get('.h-full').attributes('style')).toContain('width: 90%')
  })

  it('caps an over-limit cycle bar while preserving the real percentage', async () => {
    getMySubscriptions.mockResolvedValueOnce([{
      ...subscriptionFixtures[0],
      cycle_quota_usd: 10,
      cycle_usage_usd: 9,
      cycle_reserved_usd: 3,
      reset_interval_seconds: 604800,
      cycle_started_at: '2099-08-01T00:00:00Z',
    }])
    const wrapper = mountSubscriptionsView()
    await flushPromises()

    const quota = wrapper.get('[data-testid="quota-row"]')
    expect(quota.text()).toContain('120%')
    expect(quota.get('.h-full').attributes('style')).toContain('width: 100%')
  })

  it('does not offer subscription key actions for an inactive subscription', async () => {
    getMySubscriptions.mockResolvedValueOnce([{ ...subscriptionFixtures[0], status: 'expired' }])
    const wrapper = mountSubscriptionsView()
    await flushPromises()

    expect(wrapper.find('[data-testid="subscription-key-actions"]').exists()).toBe(false)
  })

  it('uses a full-width card for one subscription and handles empty and error states', async () => {
    getMySubscriptions.mockResolvedValueOnce([subscriptionFixtures[0]])
    const singleWrapper = mountSubscriptionsView()
    await flushPromises()
    expect(singleWrapper.get('[data-testid="subscriptions-grid"]').classes()).toContain('grid-cols-1')

    getMySubscriptions.mockResolvedValueOnce([])
    const emptyWrapper = mountSubscriptionsView()
    await flushPromises()
    expect(emptyWrapper.text()).toContain('userSubscriptions.noActiveSubscriptions')

    getMySubscriptions.mockRejectedValueOnce(new Error('network'))
    mountSubscriptionsView()
    await flushPromises()
    expect(showError).toHaveBeenCalledWith('userSubscriptions.failedToLoad')
  })
})
