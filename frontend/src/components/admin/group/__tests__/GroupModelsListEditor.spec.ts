import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import type { ModelsListState } from '@/views/admin/groupsModelsList'
import GroupModelsListEditor from '../GroupModelsListEditor.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  })
}))

const makeState = (): ModelsListState => ({
  enabled: true,
  savedModels: ['gpt-4.1', 'gpt-4.1-mini'],
  items: [
    { id: 'gpt-4.1', selected: true },
    { id: 'gpt-4.1-mini', selected: false }
  ]
})

describe('GroupModelsListEditor', () => {
  it('preserves selection and ordering mutations on the supplied form state', async () => {
    const state = makeState()
    const wrapper = mount(GroupModelsListEditor, { props: { state } })

    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    const selectedState = wrapper.emitted('update:state')?.at(-1)?.[0] as ModelsListState
    expect(selectedState.items.every(item => item.selected)).toBe(true)

    await wrapper.setProps({ state: selectedState })
    await wrapper.findAll('button[aria-label="admin.groups.modelsList.moveUp"]')[1].trigger('click')
    const reorderedState = wrapper.emitted('update:state')?.at(-1)?.[0] as ModelsListState
    expect(reorderedState.items.map(item => item.id)).toEqual(['gpt-4.1-mini', 'gpt-4.1'])
  })

  it('uses the shared switch without discarding saved selections', async () => {
    const state = makeState()
    const wrapper = mount(GroupModelsListEditor, { props: { state } })

    await wrapper.get('[role="switch"]').trigger('click')

    const nextState = wrapper.emitted('update:state')?.at(-1)?.[0] as ModelsListState
    expect(nextState.enabled).toBe(false)
    expect(nextState.savedModels).toEqual(['gpt-4.1', 'gpt-4.1-mini'])
    expect(nextState.items).toHaveLength(2)
  })
})
