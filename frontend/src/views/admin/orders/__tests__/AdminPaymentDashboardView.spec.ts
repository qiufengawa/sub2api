import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OrderStatsCards from '@/components/admin/payment/OrderStatsCards.vue'
import AdminPaymentDashboardView from '../AdminPaymentDashboardView.vue'

const { getDashboard, showError } = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin/payment', () => {
  const api = { getDashboard }
  return { default: api, adminPaymentAPI: api }
})
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError }) }))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

const stats = {
  today_amount: { CNY: 12 },
  total_amount: { CNY: 120 },
  today_count: 2,
  total_count: 20,
  avg_amount: { CNY: 6 },
  daily_series: [],
  payment_methods: [],
  top_users: {},
}

describe('admin payment dashboard', () => {
  beforeEach(() => {
    getDashboard.mockReset().mockResolvedValue({ data: stats })
    showError.mockReset()
  })

  function mountView() {
    return mount(AdminPaymentDashboardView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          AppPage: { template: '<section><slot /></section>' },
          AppPageHeader: { template: '<header><slot name="actions" /></header>' },
          UiSegmentedControl: {
            props: ['modelValue', 'options'],
            emits: ['update:modelValue'],
            template: '<div data-test="days"><button v-for="option in options" :key="option.value" :data-test="`day-${option.value}`" @click="$emit(\'update:modelValue\', option.value)">{{ option.label }}</button></div>',
          },
          UiIconButton: true,
          UiSkeleton: true,
          UiEmptyState: true,
          UiBadge: true,
          OrderStatsCards: { props: ['stats'], template: '<div data-test="stats">{{ stats.today_count }}</div>' },
          DailyRevenueChart: { props: ['data', 'loading'], template: '<div data-test="chart">{{ data.length }}</div>' },
        },
      },
    })
  }

  it('loads the default 30-day range and renders the dashboard data', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(getDashboard).toHaveBeenCalledWith(30)
    expect(wrapper.get('[data-test="stats"]').text()).toBe('2')
    expect(wrapper.get('[data-test="chart"]').text()).toBe('0')
  })

  it('reloads when the selected day range changes', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="day-7"]').trigger('click')
    await flushPromises()

    expect(getDashboard).toHaveBeenLastCalledWith(7)
  })

  it('keeps the newest range when an older request completes last', async () => {
    let resolveInitial: ((value: { data: typeof stats }) => void) | undefined
    getDashboard
      .mockReturnValueOnce(new Promise(resolve => { resolveInitial = resolve }))
      .mockResolvedValueOnce({ data: { ...stats, today_count: 7 } })
    const wrapper = mountView()
    await vi.waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(1))

    await wrapper.get('[data-test="day-7"]').trigger('click')
    await vi.waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2))
    resolveInitial?.({ data: { ...stats, today_count: 30 } })
    await flushPromises()

    expect(wrapper.get('[data-test="stats"]').text()).toBe('7')
  })

  it('ignores an older request rejection after a newer range succeeds', async () => {
    let rejectInitial: ((reason?: unknown) => void) | undefined
    getDashboard
      .mockReturnValueOnce(new Promise((_resolve, reject) => { rejectInitial = reject }))
      .mockResolvedValueOnce({ data: { ...stats, today_count: 7 } })
    const wrapper = mountView()
    await vi.waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(1))

    await wrapper.get('[data-test="day-7"]').trigger('click')
    await vi.waitFor(() => expect(getDashboard).toHaveBeenCalledTimes(2))
    await flushPromises()
    rejectInitial?.(new Error('stale network'))
    await flushPromises()

    expect(wrapper.get('[data-test="stats"]').text()).toBe('7')
    expect(showError).not.toHaveBeenCalledWith('stale network')
  })

  it('keeps the error feedback contract when loading fails', async () => {
    getDashboard.mockRejectedValueOnce(new Error('network'))
    mountView()
    await flushPromises()

    expect(showError).toHaveBeenCalledWith('network')
  })

  it('preserves every currency in multi-currency revenue metrics', () => {
    const wrapper = mount(OrderStatsCards, {
      props: {
        stats: {
          ...stats,
          today_amount: { CNY: 12, USD: 3 },
        },
      },
      global: {
        stubs: {
          AppGrid: { template: '<div><slot /></div>' },
          UiStatMetric: {
            props: ['label', 'value', 'context'],
            template: '<div data-test="metric" :data-value="value" />',
          },
        },
      },
    })

    const value = wrapper.get('[data-test="metric"]').attributes('data-value')
    expect(value).toContain(' · ')
    expect(value).toContain('12')
    expect(value).toContain('3')
  })
})
