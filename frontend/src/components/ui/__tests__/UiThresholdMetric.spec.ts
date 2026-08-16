import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiThresholdMetric from '../UiThresholdMetric.vue'

describe('UiThresholdMetric', () => {
  it('keeps an unavailable value neutral and omits its unit', () => {
    const wrapper = mount(UiThresholdMetric, {
      props: {
        label: 'SLA',
        value: null,
        threshold: 99,
        unit: '%',
        thresholdLabel: 'Limit',
        noDataLabel: 'Unavailable',
      },
    })

    expect(wrapper.get('.ui-threshold__value').text()).toBe('-')
    expect(wrapper.get('.ui-status').text()).toContain('Unavailable')
    expect(wrapper.get('footer').text()).toContain('Limit 99%')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })

  it('uses caller-provided status labels for available values', () => {
    const wrapper = mount(UiThresholdMetric, {
      props: {
        label: 'Error rate',
        value: 8,
        threshold: 5,
        unit: '%',
        normalLabel: 'Good',
        nearLabel: 'Close',
        breachedLabel: 'Too high',
      },
    })

    expect(wrapper.get('.ui-status').text()).toContain('Too high')
    expect(wrapper.get('.ui-threshold__value').text()).toContain('8%')
  })
})
