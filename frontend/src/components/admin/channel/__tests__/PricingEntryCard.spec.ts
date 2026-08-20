import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PricingFormEntry } from '../types'
import PricingEntryCard from '../PricingEntryCard.vue'

const { getModelDefaultPricing } = vi.hoisted(() => ({
  getModelDefaultPricing: vi.fn(),
}))

vi.mock('@/api/admin/channels', () => ({
  default: { getModelDefaultPricing },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const createEntry = (overrides: Partial<PricingFormEntry> = {}): PricingFormEntry => ({
  models: [],
  billing_mode: 'token',
  input_price: null,
  output_price: null,
  cache_write_price: null,
  cache_read_price: null,
  image_input_price: null,
  image_output_price: null,
  per_request_price: null,
  intervals: [],
  ...overrides,
})

const mountCard = (entry = createEntry()) => mount(PricingEntryCard, {
  props: { entry, platform: 'openai' },
  global: {
    stubs: {
      Icon: true,
      IntervalRow: true,
      ModelTagInput: {
        emits: ['update:models'],
        template: '<button data-test="add-model" @click="$emit(\'update:models\', [\'gpt-test\'])" />',
      },
      UiBadge: true,
      UiButton: { template: '<button><slot name="icon"/><slot/></button>' },
      UiEmptyState: true,
      UiSelect: true,
      UiTextField: true,
    },
  },
})

describe('PricingEntryCard', () => {
  beforeEach(() => {
    getModelDefaultPricing.mockReset().mockResolvedValue({ found: false })
  })

  it('uses separate keyboard-accessible controls for collapse and delete', async () => {
    const wrapper = mountCard()
    const collapse = wrapper.get('button[aria-label="common.collapse"]')

    expect(collapse.attributes('aria-expanded')).toBe('true')
    const bodyId = collapse.attributes('aria-controls')
    expect(bodyId).toBeTruthy()
    await collapse.trigger('click')

    const expand = wrapper.get('button[aria-label="common.expand"]')
    expect(expand.attributes('aria-expanded')).toBe('false')
    expect(expand.attributes('aria-controls')).toBe(bodyId)
    expect(wrapper.get(`#${bodyId}`).exists()).toBe(true)

    await wrapper.get('button[aria-label="common.delete"]').trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('prefills empty token prices when the first model is added', async () => {
    getModelDefaultPricing.mockResolvedValue({
      found: true,
      input_price: 0.000001,
      output_price: 0.000002,
      cache_write_price: 0.000003,
      cache_read_price: 0.0000005,
      image_input_price: null,
      image_output_price: null,
    })
    const wrapper = mountCard()

    await wrapper.get('[data-test="add-model"]').trigger('click')
    await flushPromises()

    expect(getModelDefaultPricing).toHaveBeenCalledWith('gpt-test')
    expect(wrapper.emitted('update')?.at(-1)?.[0]).toEqual(expect.objectContaining({
      models: ['gpt-test'],
      input_price: 1,
      output_price: 2,
      cache_write_price: 3,
      cache_read_price: 0.5,
    }))
  })

  it('does not overwrite an existing token price', async () => {
    const wrapper = mountCard(createEntry({ input_price: 7 }))

    await wrapper.get('[data-test="add-model"]').trigger('click')
    await flushPromises()

    expect(getModelDefaultPricing).not.toHaveBeenCalled()
    expect(wrapper.emitted('update')).toEqual([[expect.objectContaining({ models: ['gpt-test'], input_price: 7 })]])
  })
})
