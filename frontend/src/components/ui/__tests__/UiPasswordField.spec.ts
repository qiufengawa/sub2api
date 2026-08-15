import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiPasswordField from '../UiPasswordField.vue'

describe('UiPasswordField', () => {
  it('preserves autocomplete, input attributes, labels, and model updates', async () => {
    const wrapper = mount(UiPasswordField, {
      props: {
        modelValue: '',
        autocomplete: 'new-password',
        revealLabel: 'Show secret',
        hideLabel: 'Hide secret',
        inputAttrs: {
          'data-1p-ignore': true,
          'data-lpignore': 'true'
        },
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value })
      }
    })

    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('password')
    expect(input.attributes('autocomplete')).toBe('new-password')
    expect(input.attributes('data-1p-ignore')).toBe('true')
    expect(input.attributes('data-lpignore')).toBe('true')

    await input.setValue('TOKEN')
    expect(wrapper.props('modelValue')).toBe('TOKEN')

    const toggle = wrapper.get('button')
    expect(toggle.attributes('aria-label')).toBe('Show secret')
    await toggle.trigger('click')
    expect(wrapper.get('input').attributes('type')).toBe('text')
    expect(toggle.attributes('aria-label')).toBe('Hide secret')
  })
})
