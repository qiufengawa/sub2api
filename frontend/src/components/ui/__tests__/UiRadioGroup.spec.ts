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
          { value: 1, label: 'Primary', description: 'Stable route' },
          { value: 2, label: 'Fast' }
        ]
      }
    })

    expect(wrapper.classes()).toContain('ui-radio-group--stacked')
    expect(wrapper.text()).toContain('Stable route')
    await wrapper.findAll('input')[1].setValue(true)
    expect(wrapper.emitted('update:modelValue')).toEqual([[2]])
  })

  it('supports compact grid layout for described choices', () => {
    const wrapper = mount(UiRadioGroup, {
      props: {
        modelValue: 'all',
        name: 'scope',
        layout: 'grid',
        options: [
          { value: 'all', label: 'All', description: 'Every route' },
          { value: 'selected', label: 'Selected', description: 'Chosen routes' }
        ]
      }
    })

    expect(wrapper.classes()).toContain('ui-radio-group--grid')
    expect(wrapper.text()).toContain('Every route')
  })

  it('preserves option metadata and custom option content through the shared slot', () => {
    const wrapper = mount(UiRadioGroup, {
      props: {
        modelValue: 1,
        name: 'routing-group',
        ariaLabel: 'Routing group',
        options: [{ value: 1, label: 'GPT-1', title: 'Primary route' }],
      },
      slots: {
        option: '<span data-custom-option>GPT-1 ×0.1</span>',
      },
    })

    expect(wrapper.get('fieldset').attributes('aria-label')).toBe('Routing group')
    expect(wrapper.get('label').attributes('title')).toBe('Primary route')
    expect(wrapper.get('[data-custom-option]').text()).toBe('GPT-1 ×0.1')
  })
})
