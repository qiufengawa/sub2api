import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import UiRadioGroup from '../UiRadioGroup.vue'

describe('UiRadioGroup', () => {
  it('renders a stacked option list and emits the selected value', async () => {
    const wrapper = mount(UiRadioGroup, {
      props: {
        modelValue: 1,
        name: 'group',
        layout: 'stacked',
        options: [
          { value: 1, label: 'Primary' },
          { value: 2, label: 'Fast' }
        ]
      }
    })

    expect(wrapper.classes()).toContain('ui-radio-group--stacked')
    await wrapper.findAll('input')[1].setValue(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
  })
})
