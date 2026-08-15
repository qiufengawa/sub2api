import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import GroupExclusiveField from '../GroupExclusiveField.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('GroupExclusiveField', () => {
  it('emits the next exclusivity value through the shared switch', async () => {
    const wrapper = mount(GroupExclusiveField, {
      props: { modelValue: false },
      global: { stubs: { Teleport: true } }
    })

    expect(wrapper.text()).toContain('admin.groups.public')
    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('exposes the complete explanation through field help', () => {
    const wrapper = mount(GroupExclusiveField, {
      props: { modelValue: true },
      global: { stubs: { Teleport: true } }
    })

    const help = wrapper.get('button[aria-label]')
    expect(help.attributes('aria-label')).toContain('admin.groups.exclusiveTooltip.description')
    expect(help.attributes('aria-label')).toContain('admin.groups.exclusiveTooltip.exampleContent')
  })
})
