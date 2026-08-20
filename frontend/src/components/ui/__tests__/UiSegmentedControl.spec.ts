import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import UiSegmentedControl from '../UiSegmentedControl.vue'

describe('UiSegmentedControl', () => {
  const options = [
    { value: 'anthropic', label: 'Anthropic', title: 'Anthropic platform' },
    { value: 'openai', label: 'OpenAI', title: 'OpenAI platform' },
  ]

  it('renders radio semantics, option metadata and custom option content', () => {
    const wrapper = mount(UiSegmentedControl, {
      props: { modelValue: 'anthropic', options, label: 'Platform' },
      slots: { option: '<span class="option-content">{{ option.label }} icon</span>' },
    })

    expect(wrapper.get('[role="radiogroup"]').attributes('aria-label')).toBe('Platform')
    const buttons = wrapper.findAll<HTMLButtonElement>('[role="radio"]')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].attributes('aria-checked')).toBe('true')
    expect(buttons[0].attributes('title')).toBe('Anthropic platform')
    expect(buttons[0].find('.option-content').text()).toContain('Anthropic icon')
    expect(buttons[1].attributes('aria-checked')).toBe('false')
  })

  it('updates with click and arrow-key navigation', async () => {
    const wrapper = mount(UiSegmentedControl, {
      props: { modelValue: 'anthropic', options, label: 'Platform' },
    })
    const buttons = wrapper.findAll<HTMLButtonElement>('[role="radio"]')

    await buttons[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['openai'])

    await buttons[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['openai'])
  })
})
