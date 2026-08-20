import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import UiSlider from '../UiSlider.vue'

describe('UiSlider', () => {
  it('forwards accessible naming to the range input', () => {
    const wrapper = mount(UiSlider, {
      props: { modelValue: 0.5, ariaLabel: 'Temperature', min: 0, max: 2, step: 0.1 }
    })
    expect(wrapper.get('input[type="range"]').attributes('aria-label')).toBe('Temperature')
  })
})
