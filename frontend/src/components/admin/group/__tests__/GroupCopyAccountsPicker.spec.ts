import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import UiSelect from '@/components/ui/UiSelect.vue'
import GroupCopyAccountsPicker from '../GroupCopyAccountsPicker.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mountPicker = () => mount(GroupCopyAccountsPicker, {
  props: {
    selectedIds: [1],
    options: [
      { value: 1, label: 'Primary' },
      { value: 2, label: 'Fast' }
    ],
    label: 'Copy accounts',
    tooltip: 'Copies accounts after creation',
    placeholder: 'Select group',
    hint: 'Multiple groups are supported',
    removeLabel: 'Remove'
  },
  global: { stubs: { Teleport: true } }
})

describe('GroupCopyAccountsPicker', () => {
  it('emits immutable additions and removals', async () => {
    const wrapper = mountPicker()

    wrapper.findComponent(UiSelect).vm.$emit('update:modelValue', 2)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:selectedIds')?.[0]).toEqual([[1, 2]])

    await wrapper.get('button[aria-label="Remove: Primary"]').trigger('click')
    expect(wrapper.emitted('update:selectedIds')?.[1]).toEqual([[]])
  })

  it('does not offer groups that are already selected', () => {
    const wrapper = mountPicker()
    expect(wrapper.findComponent(UiSelect).props('options')).toEqual([
      { value: 2, label: 'Fast' }
    ])
  })
})
