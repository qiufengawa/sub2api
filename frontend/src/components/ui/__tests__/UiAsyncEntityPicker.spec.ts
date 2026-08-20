import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiAsyncEntityPicker from '../UiAsyncEntityPicker.vue'

describe('UiAsyncEntityPicker', () => {
  it('can search and show suggestions when focused with an empty query', async () => {
    const wrapper = mount(UiAsyncEntityPicker, {
      props: {
        items: [{ value: 7, label: 'Account 7', description: '#7' }],
        searchOnFocus: true,
        showResultsWithoutQuery: true,
      },
    })

    await wrapper.get('input').trigger('focusin')

    expect(wrapper.emitted('search')?.at(-1)).toEqual([''])
    expect(wrapper.text()).toContain('Account 7')
  })

  it('clears the query after a multi-select style selection', async () => {
    const wrapper = mount(UiAsyncEntityPicker, {
      props: {
        items: [{ value: 7, label: 'Account 7' }],
        showResultsWithoutQuery: true,
        clearAfterSelect: true,
      },
    })

    await wrapper.get('input').trigger('focusin')
    await wrapper.get('[role="option"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([7])
    expect(wrapper.emitted('select')?.at(-1)?.[0]).toMatchObject({ value: 7 })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
  })

  it('exposes combobox semantics and supports keyboard selection', async () => {
    const wrapper = mount(UiAsyncEntityPicker, {
      props: {
        items: [
          { value: 7, label: 'Account 7' },
          { value: 8, label: 'Account 8' },
        ],
        showResultsWithoutQuery: true,
      },
    })
    const input = wrapper.get('input')
    await input.trigger('focusin')

    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(input.attributes('aria-controls')).toBe(wrapper.get('[role="listbox"]').attributes('id'))

    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toContain('option-0')
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toContain('option-1')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([8])
    expect(input.attributes('aria-expanded')).toBe('false')
  })

  it('closes the listbox on Escape without emitting a selection', async () => {
    const wrapper = mount(UiAsyncEntityPicker, {
      props: { items: [{ value: 7, label: 'Account 7' }], showResultsWithoutQuery: true },
    })
    const input = wrapper.get('input')
    await input.trigger('focusin')
    await input.trigger('keydown', { key: 'Escape' })

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(wrapper.emitted('select')).toBeUndefined()
  })
})
