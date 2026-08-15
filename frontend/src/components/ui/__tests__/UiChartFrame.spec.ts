import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiChartFrame from '../UiChartFrame.vue'

describe('UiChartFrame', () => {
  it('uses consumer-provided loading and empty copy', async () => {
    const wrapper = mount(UiChartFrame, {
      props: {
        title: 'Latency',
        loading: true,
        loadingLabel: 'Loading latency',
        emptyTitle: 'No latency data',
        emptyDescription: 'No requests in this range',
      },
    })

    expect(wrapper.text()).toContain('Loading latency')
    await wrapper.setProps({ loading: false, empty: true })
    expect(wrapper.text()).toContain('No latency data')
    expect(wrapper.text()).toContain('No requests in this range')
  })

  it('keeps chart content mounted only in the ready state', () => {
    const wrapper = mount(UiChartFrame, {
      props: { title: 'Traffic' },
      slots: { default: '<div data-test="chart-content">chart</div>' },
    })

    expect(wrapper.get('[data-test="chart-content"]').exists()).toBe(true)
    expect(wrapper.get('section').attributes('aria-busy')).toBeUndefined()
  })
})
