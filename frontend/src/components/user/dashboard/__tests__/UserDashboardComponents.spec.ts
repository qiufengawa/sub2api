import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UserDashboardModelBreakdown from '../UserDashboardModelBreakdown.vue'
import UserDashboardStats from '../UserDashboardStats.vue'
import type { ModelStat } from '@/types'
import type { UserDashboardStats } from '@/api/usage'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'zh-CN' },
      t: (key: string, params?: Record<string, unknown>) => {
        if (key === 'dashboard.overview.otherModels') return '其他模型'
        if (key === 'dashboard.overview.keysAvailable') return `${params?.active} / ${params?.total}`
        return key
      },
    }),
  }
})

const global = {
  stubs: {
    Icon: true,
    LoadingSpinner: true,
    RouterLink: { props: ['to'], template: '<a :data-to="String(to)"><slot /></a>' },
  },
}

const model = (name: string, actualCost: number, tokens: number): ModelStat => ({
  model: name,
  requests: 1,
  input_tokens: tokens,
  output_tokens: 0,
  cache_creation_tokens: 0,
  cache_read_tokens: 0,
  total_tokens: tokens,
  cost: actualCost,
  actual_cost: actualCost,
})

const dashboardStats = (overrides: Partial<UserDashboardStats> = {}): UserDashboardStats => ({
  total_api_keys: 0,
  active_api_keys: 0,
  total_requests: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cache_creation_tokens: 0,
  total_cache_read_tokens: 0,
  total_tokens: 0,
  total_cost: 0,
  total_actual_cost: 0,
  today_requests: 0,
  today_input_tokens: 0,
  today_output_tokens: 0,
  today_cache_creation_tokens: 0,
  today_cache_read_tokens: 0,
  today_tokens: 0,
  today_cost: 0,
  today_actual_cost: 0,
  average_duration_ms: 0,
  rpm: 0,
  tpm: 0,
  ...overrides,
})

describe('UserDashboardModelBreakdown', () => {
  it('ranks by actual cost and limits the result to five rows including other models', () => {
    const wrapper = mount(UserDashboardModelBreakdown, {
      props: {
        loading: false,
        models: [
          model('token-heavy-cheap', 1, 1_000_000),
          model('highest-cost', 10, 1),
          model('second-cost', 8, 2),
          model('third-cost', 6, 3),
          model('fourth-cost', 4, 4),
          model('fifth-cost', 2, 5),
          model('sixth-cost', 0.5, 6),
        ],
      },
      global,
    })

    const rows = wrapper.findAll('[data-testid="model-cost-row"]')
    expect(rows).toHaveLength(5)
    expect(rows.map((row) => row.attributes('data-model'))).toEqual([
      'highest-cost',
      'second-cost',
      'third-cost',
      'fourth-cost',
      '其他模型',
    ])
    expect(rows[0].text()).toContain('$10.00')
    expect(rows[4].text()).toContain('$3.50')
  })
})

describe('UserDashboardStats', () => {
  it('keeps three core cards in stable responsive order and turns access into an action without a key', () => {
    const wrapper = mount(UserDashboardStats, {
      props: {
        stats: dashboardStats(),
        balance: 20,
        isSimple: false,
      },
      global,
    })

    const cards = [
      wrapper.find('[data-testid="dashboard-balance-card"]'),
      wrapper.find('[data-testid="dashboard-today-card"]'),
      wrapper.find('[data-testid="dashboard-access-card"]'),
    ]
    expect(cards.every((card) => card.exists())).toBe(true)
    expect(cards[2].classes()).toContain('sm:col-span-2')
    expect(cards[2].classes()).toContain('lg:col-span-1')
    expect(cards[2].text()).toContain('dashboard.overview.noApiKeyTitle')
    expect(cards[2].find('a').attributes('data-to')).toBe('/keys')
  })
})
