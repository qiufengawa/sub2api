import { defineComponent, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const copyToClipboard = vi.fn().mockResolvedValue(true)

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => (key === 'common.copy' ? '复制' : key)
    })
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn()
  })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard
  })
}))

import ModelWhitelistSelector from '../ModelWhitelistSelector.vue'

function mountSelector() {
  return mount(ModelWhitelistSelector, {
    props: {
      modelValue: [],
      platform: 'openai'
    },
    global: {
      stubs: {
        ModelIcon: true,
        teleport: true
      }
    }
  })
}

function findModelRow(wrapper: ReturnType<typeof mountSelector>, modelId: string) {
  const row = wrapper
    .findAll('[data-testid="model-option"]')
    .find(candidate => candidate.text().includes(modelId))

  if (!row) {
    throw new Error(`Model row not found: ${modelId}`)
  }

  return row
}

describe('ModelWhitelistSelector', () => {
  beforeEach(() => {
    copyToClipboard.mockClear()
  })

  it('copies a model ID without selecting the model', async () => {
    const wrapper = mountSelector()
    await wrapper.get('[data-testid="model-select-trigger"]').trigger('click')

    const row = findModelRow(wrapper, 'gpt-5.6-sol')

    const copyButton = row.get('[data-testid="copy-model-id"]')
    expect(copyButton.attributes('aria-label')).toBe('复制 gpt-5.6-sol')

    await copyButton.trigger('click')
    await flushPromises()

    expect(copyToClipboard).toHaveBeenCalledWith('gpt-5.6-sol')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps the existing model selection behavior', async () => {
    const wrapper = mountSelector()
    await wrapper.get('[data-testid="model-select-trigger"]').trigger('click')

    const row = findModelRow(wrapper, 'gpt-5.6-sol')
    await row.get('[data-testid="select-model"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[['gpt-5.6-sol']]])
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('clears the model search after the popover closes', async () => {
    const wrapper = mountSelector()
    const trigger = wrapper.get('[data-testid="model-select-trigger"]')

    await trigger.trigger('click')
    await wrapper.get('input[type="search"]').setValue('sol')
    await trigger.trigger('click')
    await trigger.trigger('click')

    expect(wrapper.get<HTMLInputElement>('input[type="search"]').element.value).toBe('')
  })

  it('prevents Enter from submitting a parent form', async () => {
    const submit = vi.fn()
    const host = defineComponent({
      components: { ModelWhitelistSelector },
      setup: () => ({ selected: ref<string[]>([]), submit }),
      template: `
        <form @submit.prevent="submit">
          <ModelWhitelistSelector v-model="selected" platform="openai" />
        </form>
      `
    })
    const wrapper = mount(host, { global: { stubs: { ModelIcon: true, teleport: true } } })

    await wrapper.get('input[type="text"]').setValue('custom-model')
    await wrapper.get('input[type="text"]').trigger('keydown', { key: 'Enter' })

    expect(submit).not.toHaveBeenCalled()
    expect(wrapper.findComponent(ModelWhitelistSelector).props('modelValue')).toEqual(['custom-model'])
  })

  it('does not add a custom model while an IME composition is active', async () => {
    const wrapper = mountSelector()
    const input = wrapper.get('input[type="text"]')

    await input.setValue('组合模型')
    await input.trigger('compositionstart')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await input.trigger('compositionend')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['组合模型']])
  })
})
