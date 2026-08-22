import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ToggleSwitch from '../ToggleSwitch.vue'

describe('ToggleSwitch accessible labeling', () => {
  it('keeps the compact visible caption while exposing a contextual label', () => {
    const wrapper = mount(ToggleSwitch, {
      props: {
        label: 'Enabled',
        accessibleLabel: 'Stripe: Enabled',
        checked: true,
      },
    })

    expect(wrapper.text()).toContain('Enabled')
    expect(wrapper.get('[role="switch"]').attributes('aria-label')).toBe('Stripe: Enabled')
  })

  it('emits the toggled value from the shared switch control', async () => {
    const wrapper = mount(ToggleSwitch, {
      props: { label: 'Enabled', checked: false },
    })

    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })
})
