import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PlaygroundParametersPanel from '../PlaygroundParametersPanel.vue'
import type { PlaygroundConfig } from '@/types/playground'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const config: PlaygroundConfig = {
  keyId: 1,
  model: 'gpt-test',
  systemPrompt: '',
  stream: true,
  temperature: 0.7,
  top_p: 1,
  max_tokens: 4096,
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: null,
  parameterEnabled: {
    temperature: false,
    top_p: false,
    max_tokens: false,
    frequency_penalty: false,
    presence_penalty: false,
    seed: false,
  },
}

afterEach(() => {
  document.body.classList.remove('modal-open')
  document.body.innerHTML = ''
})

describe('PlaygroundParametersPanel', () => {
  it('locks body scroll, traps focus, closes with Escape, and restores focus', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const wrapper = mount(PlaygroundParametersPanel, {
      attachTo: document.body,
      props: { show: true, modelValue: config },
    })
    await wrapper.vm.$nextTick()

    expect(document.body.classList.contains('modal-open')).toBe(true)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('common.close')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ show: false })
    expect(document.body.classList.contains('modal-open')).toBe(false)
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
  })

  it('uses real disabled fields when a parameter is not enabled', async () => {
    const wrapper = mount(PlaygroundParametersPanel, {
      attachTo: document.body,
      props: { show: true, modelValue: config },
    })
    await wrapper.vm.$nextTick()
    const fieldsets = document.body.querySelectorAll('fieldset')
    expect(fieldsets.length).toBeGreaterThan(0)
    expect(fieldsets[0].hasAttribute('disabled')).toBe(true)
    wrapper.unmount()
  })
})
