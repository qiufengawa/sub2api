import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AccountTodayStatsCell from '../AccountTodayStatsCell.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/utils/format', () => ({
  formatNumber: (value: number) => `n:${value}`,
  formatCurrency: (value: number) => `$${value.toFixed(2)}`,
}))

describe('AccountTodayStatsCell', () => {
  it('renders all available metrics and preserves compact token formatting', () => {
    const wrapper = mount(AccountTodayStatsCell, {
      props: { stats: { requests: 12, tokens: 1_234_567, cost: 1.25, user_cost: 0 } },
    })

    expect(wrapper.text()).toContain('n:12')
    expect(wrapper.text()).toContain('1.23M')
    expect(wrapper.text()).toContain('$1.25')
    expect(wrapper.text()).toContain('$0.00')
  })

  it('keeps existing data visible while a refresh is loading or errors', () => {
    const wrapper = mount(AccountTodayStatsCell, {
      props: {
        stats: { requests: 1, tokens: 999, cost: 0.5 },
        loading: true,
        error: 'Failed',
      },
    })

    expect(wrapper.text()).toContain('999')
    expect(wrapper.text()).not.toContain('Failed')
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
  })

  it('keeps loading, error, and empty states distinct', async () => {
    const wrapper = mount(AccountTodayStatsCell, { props: { loading: true } })
    expect(wrapper.get('[aria-busy="true"]').exists()).toBe(true)

    await wrapper.setProps({ loading: false, error: 'Failed' })
    expect(wrapper.text()).toContain('Failed')

    await wrapper.setProps({ error: null })
    expect(wrapper.text()).toBe('-')
  })
})
