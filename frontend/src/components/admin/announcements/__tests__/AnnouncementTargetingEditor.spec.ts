import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import AnnouncementTargetingEditor from '../AnnouncementTargetingEditor.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const mountEditor = (modelValue: any = { any_of: [] }) => mount(AnnouncementTargetingEditor, {
  props: { modelValue, groups: [] },
  global: {
    stubs: {
      Icon: true,
      GroupSelector: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: '<button data-test="group-selector" @click="$emit(\'update:modelValue\', [7])" />',
      },
    },
  },
})

describe('AnnouncementTargetingEditor', () => {
  it('switches from all users to a default custom subscription condition', async () => {
    const wrapper = mountEditor()

    await wrapper.get('input[value="custom"]').trigger('change')

    expect(wrapper.emitted('update:modelValue')).toEqual([[
      {
        any_of: [{
          all_of: [{ type: 'subscription', operator: 'in', group_ids: [] }],
        }],
      },
    ]])
  })

  it('updates a balance condition through the shared numeric field', async () => {
    const wrapper = mountEditor({
      any_of: [{ all_of: [{ type: 'balance', operator: 'gte', value: 10 }] }],
    })

    await wrapper.get('input[type="number"]').setValue('75')

    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({
      any_of: [{ all_of: [{ type: 'balance', operator: 'gte', value: 75 }] }],
    })
  })

  it('adds another AND condition without mutating the input prop', async () => {
    const modelValue = {
      any_of: [{ all_of: [{ type: 'balance', operator: 'gte', value: 10 }] }],
    }
    const wrapper = mountEditor(modelValue)
    const addButton = wrapper.findAll('button').find((button) => (
      button.text().includes('admin.announcements.form.addAndCondition')
    ))

    await addButton!.trigger('click')

    expect(modelValue.any_of[0].all_of).toHaveLength(1)
    expect((wrapper.emitted('update:modelValue')?.at(-1)?.[0] as any).any_of[0].all_of).toHaveLength(2)
  })
})
