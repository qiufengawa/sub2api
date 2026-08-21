import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiCheckbox from '../UiCheckbox.vue'

describe('UiCheckbox', () => {
  it('emits both the model value and native change event for controlled validation', async () => {
    const wrapper = mount(UiCheckbox, {
      props: {
        modelValue: true,
        label: 'Capability',
      },
    })

    await wrapper.get('input[type="checkbox"]').setValue(false)

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    const change = wrapper.emitted('change')?.[0]
    expect(change?.[0]).toBe(false)
    expect(change?.[1]).toBeInstanceOf(Event)
  })

  it('mirrors its visible label onto the native input accessible name', () => {
    const labeled = mount(UiCheckbox, {
      props: { modelValue: false, label: 'Capability' },
    })
    expect(labeled.get('input').attributes('aria-label')).toBe('Capability')

    const ariaOnly = mount(UiCheckbox, {
      props: { modelValue: false },
      attrs: { 'aria-label': 'Select all capabilities' },
    })
    expect(ariaOnly.get('input').attributes('aria-label')).toBe('Select all capabilities')
  })
})
