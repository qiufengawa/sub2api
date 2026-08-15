import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ModelRestrictionEditor from '../ModelRestrictionEditor.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const ModelWhitelistSelectorStub = defineComponent({
  name: 'ModelWhitelistSelector',
  props: ['modelValue'],
  template: '<div data-testid="whitelist">{{ modelValue.length }}</div>'
})

describe('ModelRestrictionEditor', () => {
  it('edits mappings and prevents duplicate presets', async () => {
    const wrapper = mount(ModelRestrictionEditor, {
      props: {
        platform: 'openai',
        mode: 'whitelist',
        allowedModels: [],
        modelMappings: [],
        supportsAll: true,
        presets: [{ label: 'Default', from: 'gpt-request', to: 'gpt-upstream' }],
        'onUpdate:mode': (value: string) => wrapper.setProps({ mode: value as 'whitelist' | 'mapping' }),
        'onUpdate:modelMappings': (value: Array<{ from: string; to: string }>) =>
          wrapper.setProps({ modelMappings: value })
      },
      global: {
        stubs: { ModelWhitelistSelector: ModelWhitelistSelectorStub }
      }
    })

    expect(wrapper.text()).toContain('admin.accounts.supportsAllModels')
    await wrapper.findAll('button').find((button) => button.text().includes('admin.accounts.modelMapping'))!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Default'))!.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Default'))!.trigger('click')

    expect(wrapper.props('modelMappings')).toEqual([
      { from: 'gpt-request', to: 'gpt-upstream' }
    ])
    expect(wrapper.emitted('duplicatePreset')).toEqual([
      [{ label: 'Default', from: 'gpt-request', to: 'gpt-upstream' }]
    ])

    await wrapper.get('button[aria-label="common.delete"]').trigger('click')
    expect(wrapper.props('modelMappings')).toEqual([])
  })

  it('preserves provider-specific mapping placeholders', async () => {
    const wrapper = mount(ModelRestrictionEditor, {
      props: {
        platform: 'anthropic',
        mode: 'mapping',
        allowedModels: [],
        modelMappings: [{ from: '', to: '' }],
        fromPlaceholder: 'From model',
        toPlaceholder: 'To model'
      },
      global: {
        stubs: { ModelWhitelistSelector: ModelWhitelistSelectorStub }
      }
    })

    const inputs = wrapper.findAll('input')
    expect(inputs.map((input) => input.attributes('placeholder'))).toEqual([
      'From model',
      'To model'
    ])
  })
})
