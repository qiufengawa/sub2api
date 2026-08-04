import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import PlaygroundComposer from '../PlaygroundComposer.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const props = {
  modelValue: '',
  keyId: 1,
  keyOptions: [{ value: 1, label: 'Production key', group: 'OpenAI group', platform: 'openai' }],
  modelOptions: [{ value: 'gpt-test', label: 'gpt-test' }],
  selectedKey: {
    id: 1,
    name: 'Production key',
    status: 'active',
    group_id: 2,
    group_name: 'OpenAI group',
    platform: 'openai',
  },
  model: 'gpt-test',
  stream: true,
  loadingKeys: false,
  loadingModels: false,
  generating: false,
  canSend: true,
  hasMessages: true,
  optionsError: false,
  sessionStatus: 'Ready',
  parameterTitle: 'playground.parameters.title',
  enabledParameterCount: 0,
  imageMode: false,
  imageSize: '1024x1024' as const,
  imageQuality: 'auto' as const,
  imageFormat: 'png' as const,
  imageCount: 1,
}

describe('PlaygroundComposer', () => {
  it('sends with Enter and keeps Shift+Enter for a new line', async () => {
    const wrapper = mount(PlaygroundComposer, { props })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hello')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('submit')).toBeUndefined()

    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('submit')).toEqual([['hello']])
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([''])
  })

  it('shows one stop control while generation is active', async () => {
    const wrapper = mount(PlaygroundComposer, { props: { ...props, generating: true, canSend: false } })
    const stop = wrapper.find('button[aria-label="playground.actions.stop"]')
    expect(stop.exists()).toBe(true)
    await stop.trigger('click')
    expect(wrapper.emitted('stop')).toHaveLength(1)
    expect(wrapper.find('button[aria-label="playground.actions.send"]').exists()).toBe(false)
  })

  it('shows image-generation context and opens image settings', async () => {
    const wrapper = mount(PlaygroundComposer, {
      props: { ...props, imageMode: true, parameterTitle: 'playground.image.parametersTitle', enabledParameterCount: 4 },
    })
    expect(wrapper.find('textarea').attributes('placeholder')).toBe('playground.image.placeholder')
    expect(wrapper.text()).toContain('playground.image.mode')
    const settings = wrapper.get('button[aria-label="playground.image.parametersTitle"]')
    await settings.trigger('click')
    expect(wrapper.emitted('openParameters')).toHaveLength(1)
  })

  it('keeps key, group, model, mode, and utility actions inside the composer', async () => {
    const wrapper = mount(PlaygroundComposer, { props })
    const selects = wrapper.findAllComponents(Select)
    expect(selects).toHaveLength(2)
    selects[0].vm.$emit('update:modelValue', 2)
    selects[1].vm.$emit('update:modelValue', 'gpt-next')
    wrapper.getComponent(Toggle).vm.$emit('update:modelValue', false)
    await wrapper.get('button[aria-label="playground.actions.requestJson"]').trigger('click')
    await wrapper.get('button[aria-label="playground.actions.newConversation"]').trigger('click')

    expect(wrapper.text()).toContain('OpenAI group / openai')
    expect(wrapper.emitted('selectKey')).toEqual([[2]])
    expect(wrapper.emitted('selectModel')).toEqual([['gpt-next']])
    expect(wrapper.emitted('updateStream')).toEqual([[false]])
    expect(wrapper.emitted('openPreview')).toHaveLength(1)
    expect(wrapper.emitted('newConversation')).toHaveLength(1)
  })
})
