import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ModelMappingEditor from '../ModelMappingEditor.vue'

const baseProps = {
  modelValue: [{ from: 'claude-*', to: 'claude-sonnet' }],
  fromPlaceholder: 'Request model',
  toPlaceholder: 'Actual model',
  addLabel: 'Add mapping',
  removeLabel: 'Remove mapping'
}

describe('ModelMappingEditor', () => {
  it('adds, updates, and removes rows without mutating the input array', async () => {
    const original = [{ ...baseProps.modelValue[0] }]
    const wrapper = mount(ModelMappingEditor, { props: { ...baseProps, modelValue: original } })

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('gpt-*')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual([{ from: 'gpt-*', to: 'claude-sonnet' }])
    expect(original).toEqual(baseProps.modelValue)

    await wrapper.findAll('button').at(-1)?.trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      { from: 'claude-*', to: 'claude-sonnet' },
      { from: '', to: '' }
    ])

    await wrapper.find('button[aria-label="Remove mapping"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([])
  })

  it('shows wildcard validation through shared field errors', () => {
    const wrapper = mount(ModelMappingEditor, {
      props: {
        ...baseProps,
        modelValue: [{ from: 'bad*pattern', to: 'target-*' }],
        validateWildcards: true,
        wildcardSourceError: 'Wildcard must be last',
        wildcardTargetError: 'Target cannot use wildcard'
      }
    })
    expect(wrapper.text()).toContain('Wildcard must be last')
    expect(wrapper.text()).toContain('Target cannot use wildcard')
  })
})
