import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import UserDashboardCharts from '../UserDashboardCharts.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      locale: { value: 'en-US' },
      t: (key: string) => key,
    }),
  }
})

vi.mock('vue-chartjs', () => ({
  Chart: {
    props: ['data', 'options'],
    template: '<div class="chart-stub" :data-chart="JSON.stringify({ data, options })" />',
  },
}))

const trend = [{
  date: '2026-08-19',
  requests: 4,
  input_tokens: 10,
  output_tokens: 5,
  cache_creation_tokens: 0,
  cache_read_tokens: 0,
  total_tokens: 15,
  cost: 0.2,
  actual_cost: 0.1,
}]

const mountChart = () => mount(UserDashboardCharts, {
  props: { loading: false, rangeDays: 7, trend },
  global: {
    stubs: {
      Icon: true,
      UiButton: { template: '<button><slot /></button>' },
      UiSegmentedControl: { template: '<div />' },
      UiSpinner: true,
    },
  },
})

const readChart = (wrapper: ReturnType<typeof mountChart>) => JSON.parse(
  wrapper.get('.chart-stub').attributes('data-chart') as string,
)

describe('UserDashboardCharts', () => {
  afterEach(() => document.documentElement.classList.remove('dark'))

  it('uses readable light theme colors and an accessible chart region', () => {
    const wrapper = mountChart()
    const chart = readChart(wrapper)

    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('dashboard.overview.usageTrend')
    expect(chart.options.plugins.legend.labels.color).toBe('#374151')
    expect(chart.data.datasets[0].borderColor).toBe('#366ef4')
  })

  it('reacts to document dark theme changes without changing data', async () => {
    const wrapper = mountChart()
    const initial = readChart(wrapper)

    document.documentElement.classList.add('dark')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    const dark = readChart(wrapper)
    expect(dark.options.plugins.legend.labels.color).toBe('#d7deed')
    expect(dark.data.datasets[0].borderColor).toBe('#8db2ff')
    expect(dark.data.labels).toEqual(initial.data.labels)
  })
})
