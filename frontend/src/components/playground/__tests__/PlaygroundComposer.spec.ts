import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PlaygroundComposer from '../PlaygroundComposer.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const props = {
  modelValue: '',
  model: 'gpt-test',
  stream: true,
  generating: false,
  canSend: true,
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
    const wrapper = mount(PlaygroundComposer, { props: { ...props, imageMode: true } })
    expect(wrapper.find('textarea').attributes('placeholder')).toBe('playground.image.placeholder')
    expect(wrapper.text()).toContain('playground.image.mode')
    const settings = wrapper.get('button[aria-label="playground.image.parametersTitle"]')
    await settings.trigger('click')
    expect(wrapper.emitted('openParameters')).toHaveLength(1)
  })
})
