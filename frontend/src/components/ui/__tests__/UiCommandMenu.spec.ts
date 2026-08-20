import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiCommandMenu from '../UiCommandMenu.vue'

describe('UiCommandMenu', () => {
  it('exposes listbox semantics and skips disabled options during keyboard navigation', async () => {
    const wrapper = mount(UiCommandMenu, {
      props: { items: [{ key: 'disabled', label: 'Disabled', disabled: true }, { key: 'run', label: 'Run' }] }
    })
    const input = wrapper.get('input[role="combobox"]')
    const list = wrapper.get('[role="listbox"]')
    expect(input.attributes('aria-controls')).toBe(list.attributes('id'))
    await input.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.vm.$nextTick()
    const option = wrapper.get('[role="option"]#' + list.attributes('id') + '-option-run')
    expect(option.attributes('aria-selected')).toBe('true')
    expect(option.attributes('tabindex')).toBe('0')
    expect(input.attributes('aria-activedescendant')).toBe(option.attributes('id'))
  })

  it('emits the active command on Enter', async () => {
    const wrapper = mount(UiCommandMenu, { props: { items: [{ key: 'run', label: 'Run' }] } })
    await wrapper.get('input[role="combobox"]').trigger('keydown', { key: 'ArrowDown' })
    await wrapper.get('input[role="combobox"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('select')).toEqual([[{ key: 'run', label: 'Run' }]])
  })
})
