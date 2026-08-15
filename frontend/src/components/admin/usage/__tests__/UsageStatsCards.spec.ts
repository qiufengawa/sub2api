import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import UsageStatsCards from '../UsageStatsCards.vue'

const messages: Record<string, string> = {
  'usage.totalRequests': 'Total Requests',
  'usage.inSelectedRange': 'in selected range',
  'usage.totalTokens': 'Total Tokens',
  'usage.in': 'In',
  'usage.out': 'Out',
  'usage.cacheTotal': 'Cache',
  'usage.cacheBreakdown': 'Cache Token Breakdown',
  'usage.cacheCreationTokensLabel': 'Cache Creation',
  'usage.cacheReadTokensLabel': 'Cache Read',
  'usage.cacheHitRate': 'Cache',
  'usage.cacheHitRateShort': 'Cache',
  'usage.cacheHitRateFormula': 'Cache read / all prompt tokens',
  'usage.totalCost': 'Total Cost',
  'usage.accountCost': 'Cost',
  'usage.standardCost': 'Standard',
  'usage.avgDuration': 'Avg Duration',
}

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => messages[key] ?? key,
    }),
  }
})

const stats = {
  total_requests: 1,
  total_input_tokens: 100,
  total_output_tokens: 50,
  total_cache_tokens: 34,
  total_cache_creation_tokens: 12,
  total_cache_read_tokens: 22,
  total_tokens: 184,
  total_cost: 0.001,
  total_actual_cost: 0.001,
  total_account_cost: 0.001,
  average_duration_ms: 250,
}

describe('UsageStatsCards', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows cache token breakdown values from the keyboard-accessible tooltip', async () => {
    const wrapper = mount(UsageStatsCards, {
      attachTo: document.body,
      props: {
        stats,
      },
      global: {
        stubs: {
          Icon: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Cache: 34')
    await wrapper.get('.usage-stats__cache-trigger').trigger('focusin')

    const tooltip = document.body.querySelector('[role="tooltip"]')
    expect(tooltip?.textContent).toContain('Cache Token Breakdown')
    expect(tooltip?.textContent).toContain('Cache Creation')
    expect(tooltip?.textContent).toContain('12')
    expect(tooltip?.textContent).toContain('Cache Read')
    expect(tooltip?.textContent).toContain('22')
    expect(tooltip?.textContent).not.toContain('Cache read / all prompt tokens')
  })

  it('shows the aggregate cache token reuse rate only when explicitly enabled', async () => {
    const wrapper = mount(UsageStatsCards, {
      attachTo: document.body,
      props: {
        stats,
        showCacheHitRate: true,
        userVariant: true,
      },
      global: {
        stubs: {
          Icon: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Cache 16.4%')
    await wrapper.get('.usage-stats__cache-trigger').trigger('focusin')
    expect(document.body.querySelector('[role="tooltip"]')?.textContent)
      .toContain('Cache read / all prompt tokens')
  })

  it('preserves account cost visibility and standard-cost strike-through', () => {
    const wrapper = mount(UsageStatsCards, {
      props: {
        stats,
        showAccountCost: false,
        strikeStandardCost: true,
      },
    })

    expect(wrapper.text()).not.toContain('Cost $0.0010')
    expect(wrapper.get('.usage-stats__struck').text()).toBe('$0.0010')
  })
})
