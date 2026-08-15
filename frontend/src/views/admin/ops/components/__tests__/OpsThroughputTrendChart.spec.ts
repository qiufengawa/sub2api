import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import OpsThroughputTrendChart from '../OpsThroughputTrendChart.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('vue-chartjs', () => ({
  Line: {
    props: ['data', 'options'],
    template: '<div class="line-chart" />',
  },
}))

describe('OpsThroughputTrendChart', () => {
  it('uses the shared chart frame and compact toolbar controls', () => {
    const wrapper = mount(OpsThroughputTrendChart, {
      props: {
        points: [],
        loading: false,
        timeRange: '1h',
      },
      global: {
        stubs: {
          UiEmptyState: true,
          UiFieldHelp: true,
        },
      },
    })

    const header = wrapper.get('[data-testid="throughput-chart-header"]')
    expect(header.classes()).toContain('ui-chart-frame')

    const toolbar = wrapper.get('[data-testid="throughput-chart-toolbar"]')
    expect(toolbar.classes()).toContain('app-inline')
    expect(toolbar.findAll('button')).toHaveLength(3)
    toolbar.findAll('button').forEach((button) => {
      expect(button.classes()).toContain('ui-icon-button--dense')
    })
    expect(wrapper.find('svg path[d^="M13 7"]').exists()).toBe(false)
  })
})
