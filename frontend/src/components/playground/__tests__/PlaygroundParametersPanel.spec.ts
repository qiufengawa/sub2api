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
  document.body.style.overflow = ''
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function mockViewport(matches: boolean): void {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

describe('PlaygroundParametersPanel', () => {
  it('uses the shared desktop drawer lifecycle', async () => {
    mockViewport(false)
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const wrapper = mount(PlaygroundParametersPanel, {
      attachTo: document.body,
      props: { show: true, modelValue: config },
    })
    await wrapper.vm.$nextTick()

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.querySelector('.ui-drawer')).not.toBeNull()
    expect(document.body.querySelector('.ui-sheet')).toBeNull()
    expect(document.body.querySelector('[aria-label="common.close"]')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ show: false })
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
  })

  it('uses the shared sheet on narrow viewports', async () => {
    mockViewport(true)
    const wrapper = mount(PlaygroundParametersPanel, {
      attachTo: document.body,
      props: { show: true, imageMode: true, modelValue: config },
    })
    await wrapper.vm.$nextTick()

    expect(document.body.querySelector('.ui-sheet')).not.toBeNull()
    expect(document.body.querySelector('.ui-drawer')).toBeNull()
    expect(document.body.querySelector('[aria-label="common.close"]')).not.toBeNull()
    expect(document.body.textContent).toContain('playground.image.parametersTitle')
    wrapper.unmount()
  })

  it('uses real disabled fields when a parameter is not enabled', async () => {
    mockViewport(false)
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
