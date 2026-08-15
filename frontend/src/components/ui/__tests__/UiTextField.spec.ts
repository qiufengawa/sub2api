import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiTextField from '../UiTextField.vue'

describe('UiTextField model modifiers', () => {
  it('emits numbers for v-model.number values', async () => {
    const wrapper = mount(UiTextField, {
      props: {
        modelValue: 1,
        type: 'number',
        modelModifiers: { number: true },
      },
    })

    await wrapper.get('input').setValue('2.75')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2.75])
    expect(wrapper.emitted('change')?.at(-1)).toEqual([2.75])
  })

  it('keeps an empty number field empty so nullable forms can clear it', async () => {
    const wrapper = mount(UiTextField, {
      props: {
        modelValue: 1,
        type: 'number',
        modelModifiers: { number: true },
      },
    })

    await wrapper.get('input').setValue('')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })

  it('trims text when v-model.trim is used', async () => {
    const wrapper = mount(UiTextField, {
      props: {
        modelValue: '',
        modelModifiers: { trim: true },
      },
    })

    await wrapper.get('input').setValue('  model-id  ')

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['model-id'])
  })

  it('forwards composition lifecycle events for IME-aware consumers', async () => {
    const wrapper = mount(UiTextField, { props: { modelValue: '' } })
    const input = wrapper.get('input')

    await input.trigger('compositionstart')
    await input.trigger('compositionend')

    expect(wrapper.emitted('compositionstart')).toHaveLength(1)
    expect(wrapper.emitted('compositionend')).toHaveLength(1)
  })

  it('can prevent Enter from submitting a parent form', async () => {
    const wrapper = mount(UiTextField, {
      props: { modelValue: '', preventEnterDefault: true }
    })

    await wrapper.get('input').trigger('keydown', { key: 'Enter' })

    const event = wrapper.emitted('enter')?.[0]?.[0] as KeyboardEvent
    expect(event.defaultPrevented).toBe(true)
  })
})
