import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import EndpointDistributionChart from '../EndpointDistributionChart.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  const messages: Record<string, string> = {
    'usage.endpointDistribution': 'Endpoint Distribution',
    'usage.endpoint': 'Endpoint',
    'usage.rankingOther': 'Others',
    'admin.dashboard.requests': 'Requests',
    'admin.dashboard.tokens': 'Tokens',
    'admin.dashboard.actual': 'Actual',
    'admin.dashboard.standard': 'Standard',
    'admin.dashboard.noDataAvailable': 'No data available',
  }
  return { ...actual, useI18n: () => ({ t: (key: string) => messages[key] ?? key }) }
})

vi.mock('vue-chartjs', () => ({
  Doughnut: { props: ['data'], template: '<div class="chart-data">{{ JSON.stringify(data) }}</div>' },
}))

const endpointStats = [
  { endpoint: '/v1/messages', requests: 9, total_tokens: 1200, cost: 1.8, actual_cost: 0.9 },
  { endpoint: '/v1/responses', requests: 5, total_tokens: 700, cost: 1.1, actual_cost: 0.6 },
  { endpoint: '/v1/chat/completions', requests: 2, total_tokens: 200, cost: 0.3, actual_cost: 0.2 },
]

describe('EndpointDistributionChart', () => {
  it('preserves the doughnut default', () => {
    const wrapper = mount(EndpointDistributionChart, {
      props: { endpointStats },
      global: { stubs: { LoadingSpinner: true } },
    })
    const chartData = JSON.parse(wrapper.get('.chart-data').text())
    expect(chartData.labels).toEqual(['/v1/messages', '/v1/responses', '/v1/chat/completions'])
    expect(chartData.datasets[0].backgroundColor[0]).toBe('#366ef4')
  })

  it('supports a capped blue ranking with an aggregated Others row', () => {
    const wrapper = mount(EndpointDistributionChart, {
      props: {
        endpointStats,
        displayMode: 'ranking',
        colorScheme: 'blue',
        maxItems: 2,
        aggregateOther: true,
        enableBreakdown: false,
      },
      global: { stubs: { LoadingSpinner: true } },
    })
    const ranking = wrapper.get('[data-testid="endpoint-distribution-ranking"]')
    expect(ranking.text()).toContain('/v1/messages')
    expect(ranking.text()).toContain('/v1/responses')
    expect(ranking.text()).toContain('Others')
    expect(ranking.text()).not.toContain('/v1/chat/completions')
  })
})
