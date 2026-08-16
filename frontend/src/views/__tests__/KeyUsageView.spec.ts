import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import KeyUsageView from '../KeyUsageView.vue'

const { showInfo, showSuccess, showError, fetchPublicSettings } = vi.hoisted(() => ({
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  fetchPublicSettings: vi.fn(),
}))

const messages: Record<string, string> = {
  'keyUsage.title': 'API Key Usage',
  'keyUsage.subtitle': 'Usage status',
  'keyUsage.placeholder': 'sk-test',
  'keyUsage.query': 'Query',
  'keyUsage.querying': 'Querying...',
  'keyUsage.privacyNote': 'Privacy note',
  'keyUsage.dateRange': 'Date Range:',
  'keyUsage.dateRangeToday': 'Today',
  'keyUsage.dateRange7d': '7 Days',
  'keyUsage.dateRange30d': '30 Days',
  'keyUsage.dateRange90d': '90 Days',
  'keyUsage.dateRangeCustom': 'Custom',
  'keyUsage.customStartDate': 'Custom range start date',
  'keyUsage.customEndDate': 'Custom range end date',
  'keyUsage.customRangeRequired': 'Select both dates',
  'keyUsage.customRangeInvalid': 'Start must not follow end',
  'keyUsage.apply': 'Apply',
  'keyUsage.showApiKey': 'Show API key',
  'keyUsage.hideApiKey': 'Hide API key',
  'keyUsage.used': 'Used',
  'keyUsage.detailInfo': 'Detail Information',
  'keyUsage.tokenStats': 'Token Statistics',
  'keyUsage.dailyDetail': 'Daily Detail',
  'keyUsage.date': 'Date',
  'keyUsage.requests': 'Requests',
  'keyUsage.inputTokens': 'Input Tokens',
  'keyUsage.outputTokens': 'Output Tokens',
  'keyUsage.cacheReadTokens': 'Cache Read',
  'keyUsage.cacheWriteTokens': 'Cache Write',
  'keyUsage.cost': 'Cost',
  'keyUsage.model': 'Model',
  'keyUsage.modelStats': 'Model Statistics',
  'keyUsage.cacheCreationTokens': 'Cache Creation',
  'keyUsage.totalTokens': 'Total Tokens',
  'keyUsage.noDailyUsage': 'No daily usage',
  'keyUsage.quotaMode': 'Key Quota Mode',
  'keyUsage.walletBalance': 'Wallet Balance',
  'keyUsage.statusActive': 'Active',
  'keyUsage.statusQuotaExhausted': 'Quota Exhausted',
  'keyUsage.statusExpired': 'Expired',
  'keyUsage.statusUnknown': 'Unknown',
  'keyUsage.totalQuota': 'Total Quota',
  'keyUsage.limit5h': '5-Hour Limit',
  'keyUsage.limitDaily': 'Daily Limit',
  'keyUsage.limit7d': '7-Day Limit',
  'keyUsage.limitWeekly': 'Weekly Limit',
  'keyUsage.limitMonthly': 'Monthly Limit',
  'keyUsage.remainingQuota': 'Remaining Quota',
  'keyUsage.usedQuota': 'Used Quota',
  'keyUsage.resetsIn': 'Resets in {time}',
  'keyUsage.subscriptionType': 'Subscription Type',
  'keyUsage.todayRequests': 'Today Requests',
  'keyUsage.todayInputTokens': 'Today Input',
  'keyUsage.todayOutputTokens': 'Today Output',
  'keyUsage.todayTokens': 'Today Tokens',
  'keyUsage.todayCacheCreation': 'Today Cache Creation',
  'keyUsage.todayCacheRead': 'Today Cache Read',
  'keyUsage.todayCost': 'Today Cost',
  'keyUsage.rpmTpm': 'RPM / TPM',
  'keyUsage.totalRequests': 'Total Requests',
  'keyUsage.totalInputTokens': 'Total Input',
  'keyUsage.totalOutputTokens': 'Total Output',
  'keyUsage.totalTokensLabel': 'Total Tokens',
  'keyUsage.totalCacheCreation': 'Total Cache Creation',
  'keyUsage.totalCacheRead': 'Total Cache Read',
  'keyUsage.totalCost': 'Total Cost',
  'keyUsage.avgDuration': 'Avg Duration',
  'keyUsage.querySuccess': 'Query successful',
  'keyUsage.queryFailed': 'Query failed',
  'keyUsage.queryFailedRetry': 'Query failed, please try again later',
  'home.viewDocs': 'Docs',
  'home.switchToLight': 'Light',
  'home.switchToDark': 'Dark',
  'home.footer.allRightsReserved': 'All rights reserved.',
  'nav.github': 'GitHub',
}

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => messages[key] ?? key,
      locale: { value: 'en' },
    }),
  }
})

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    cachedPublicSettings: null,
    siteName: 'Sub2API',
    siteLogo: '',
    docUrl: '',
    publicSettingsLoaded: true,
    fetchPublicSettings,
    showInfo,
    showSuccess,
    showError,
  }),
}))

describe('KeyUsageView daily detail', () => {
  beforeEach(() => {
    showInfo.mockReset()
    showSuccess.mockReset()
    showError.mockReset()
    fetchPublicSettings.mockReset()
    localStorage.clear()

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: 'quota_limited',
        isValid: true,
        status: 'active',
        quota: {
          limit: 10,
          used: 1,
          remaining: 9,
          unit: 'USD',
        },
        usage: {
          today: {
            requests: 1,
            input_tokens: 10,
            output_tokens: 20,
            cache_creation_tokens: 0,
            cache_read_tokens: 0,
            total_tokens: 30,
            actual_cost: 0.01,
          },
          total: {
            requests: 12,
            input_tokens: 100,
            output_tokens: 200,
            cache_creation_tokens: 10,
            cache_read_tokens: 30,
            total_tokens: 340,
            actual_cost: 0.12,
          },
          rpm: 0,
          tpm: 0,
        },
        daily_usage: [
          {
            date: '2026-05-19',
            requests: 12,
            input_tokens: 100,
            output_tokens: 200,
            cache_read_tokens: 30,
            cache_write_tokens: 10,
            total_tokens: 340,
            cost: 0.15,
            actual_cost: 0.12,
          },
        ],
      }),
    }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders daily usage detail rows after a successful query', async () => {
    const wrapper = mount(KeyUsageView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          Icon: true,
        },
      },
    })

    await wrapper.find('input').setValue('sk-test-key')
    await wrapper.find('input').trigger('keydown.enter')
    await flushPromises()
    await nextTick()

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/usage?'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-test-key' },
      })
    )
    expect(String(fetchMock.mock.calls[0][0])).toContain('days=30')

    const text = wrapper.text()
    expect(text).toContain('Daily Detail')
    expect(text).toContain('Date')
    expect(text).toContain('Cache Read')
    expect(text).toContain('Cache Write')
    expect(text).toContain('2026-05-19')
    expect(text).toContain('12')
    expect(text).toContain('100')
    expect(text).toContain('200')
    expect(text).toContain('30')
    expect(text).toContain('10')
    expect(text).toContain('$0.12')
    expect(text).toContain('Active')

    const dailyTable = wrapper.get('[role="region"][aria-label="Daily Detail"]')
    expect(dailyTable.exists()).toBe(true)

    const dailyRange = wrapper.get('[role="radiogroup"][aria-label="Daily Detail"]')
    expect(dailyRange.get('button[aria-checked="true"]').text()).toBe('30 Days')

    wrapper.unmount()
  })

  it('stacks the query controls on small screens and labels the visibility toggle', () => {
    const wrapper = mount(KeyUsageView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          Icon: true,
        },
      },
    })

    expect(wrapper.get('[data-testid="key-query-row"]').classes()).toContain('key-usage-query__row')
    expect(wrapper.get('[data-testid="key-visibility-toggle"]').attributes('aria-label')).toBe('Show API key')
    expect(wrapper.get('button[aria-busy]').attributes('aria-busy')).toBe('false')

    wrapper.unmount()
  })

  it('queries the current local calendar date near midnight', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 13, 0, 30))

    const wrapper = mount(KeyUsageView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          Icon: true,
        },
      },
    })

    await wrapper.find('input').setValue('sk-test-key')
    await wrapper.find('input').trigger('keydown.enter')
    await flushPromises()

    const requestUrl = String(vi.mocked(fetch).mock.calls[0][0])
    expect(requestUrl).toContain('start_date=2026-07-13')
    expect(requestUrl).toContain('end_date=2026-07-13')

    wrapper.unmount()
  })

  it('does not request when the API key is empty', async () => {
    const wrapper = mount(KeyUsageView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          Icon: true,
        },
      },
    })

    await wrapper.find('button[aria-busy]').trigger('click')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(showInfo).toHaveBeenCalledWith('keyUsage.enterApiKey')
    wrapper.unmount()
  })

  it('blocks incomplete or reversed custom ranges and queries a valid range', async () => {
    const wrapper = mount(KeyUsageView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          Icon: true,
        },
      },
    })

    await wrapper.find('input').setValue('sk-test-key')
    await wrapper.find('input').trigger('keydown.enter')
    await flushPromises()
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)

    const customButton = wrapper.findAll('button').find(button => button.text() === 'Custom')
    expect(customButton).toBeDefined()
    await customButton!.trigger('click')
    await wrapper.findAll('[data-testid="custom-date-range"] button').at(-1)!.trigger('click')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Select both dates')

    const dateInputs = wrapper.findAll('[data-testid="custom-date-range"] input')
    await dateInputs[0].setValue('2026-08-20')
    await dateInputs[1].setValue('2026-08-10')
    await wrapper.findAll('[data-testid="custom-date-range"] button').at(-1)!.trigger('click')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Start must not follow end')

    await dateInputs[0].setValue('2026-08-01')
    await dateInputs[1].setValue('2026-08-10')
    await wrapper.findAll('[data-testid="custom-date-range"] button').at(-1)!.trigger('click')
    await flushPromises()

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
    const requestUrl = String(vi.mocked(fetch).mock.calls.at(-1)?.[0])
    expect(requestUrl).toContain('start_date=2026-08-01')
    expect(requestUrl).toContain('end_date=2026-08-10')
    wrapper.unmount()
  })

  it('keeps the result surface stable while loading and hides it after a failed request', async () => {
    let resolveRequest!: (response: Response) => void
    const pendingRequest = new Promise<Response>(resolve => { resolveRequest = resolve })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingRequest))

    const wrapper = mount(KeyUsageView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          Icon: true,
        },
      },
    })

    await wrapper.find('input').setValue('sk-test-key')
    await wrapper.find('input').trigger('keydown.enter')
    await nextTick()
    expect(wrapper.get('.key-usage-results').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.key-usage-loading').exists()).toBe(true)

    resolveRequest({
      ok: false,
      status: 503,
      json: async () => ({ message: 'upstream unavailable' }),
    } as Response)
    await flushPromises()
    expect(wrapper.find('.key-usage-results').exists()).toBe(false)
    expect(showError).toHaveBeenCalledWith('upstream unavailable')
    wrapper.unmount()
  })

  it('renders wallet subscription data and model statistics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: 'wallet',
        planName: 'Starter',
        balance: 12.5,
        remaining: 8.25,
        subscription: {
          daily_usage_usd: 1,
          daily_limit_usd: 5,
          weekly_usage_usd: 2,
          weekly_limit_usd: 15,
          monthly_usage_usd: 4,
          monthly_limit_usd: 60,
          expires_at: '2026-08-30T00:00:00Z',
        },
        usage: { today: {}, total: {}, rpm: 1, tpm: 2 },
        model_stats: [{ model: 'gpt-test', requests: 2, total_tokens: 42, cost: 0.2 }],
      }),
    }))

    const wrapper = mount(KeyUsageView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          Icon: true,
        },
      },
    })

    await wrapper.find('input').setValue('sk-test-key')
    await wrapper.find('input').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('Starter')
    expect(wrapper.text()).toContain('$8.25')
    expect(wrapper.text()).toContain('gpt-test')
    expect(wrapper.get('[role="region"][aria-label="Model Statistics"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows an empty daily usage section and refetches when its range changes', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        mode: 'quota_limited',
        isValid: true,
        status: 'active',
        quota: { limit: 10, used: 0, remaining: 10 },
        usage: { today: {}, total: {} },
        daily_usage: [],
      }),
    } as Response)

    const wrapper = mount(KeyUsageView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          LocaleSwitcher: true,
          Icon: true,
        },
      },
    })

    await wrapper.find('input').setValue('sk-test-key')
    await wrapper.find('input').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('No daily usage')

    await wrapper.get('[role="radiogroup"][aria-label="Daily Detail"] button').trigger('click')
    await flushPromises()
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('days=7')
    wrapper.unmount()
  })
})
