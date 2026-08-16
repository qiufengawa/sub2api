import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaGroupSection from '../PlazaGroupSection.vue'
import type { ModelPlazaGroup } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, string | number>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
    }),
  }
})

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ cachedPublicSettings: { server_utc_offset: 8 } }),
}))

function makeGroup(overrides: Partial<ModelPlazaGroup> = {}): ModelPlazaGroup {
  return {
    id: 1,
    name: 'OpenAI Primary',
    description: 'Primary production group',
    platform: 'openai',
    subscription_type: 'standard',
    rate_multiplier: 1,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    is_exclusive: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    models: [{ name: 'gpt-test', platform: 'openai', pricing: null, official_pricing: null }],
    ...overrides,
  }
}

function mountSection(group: ModelPlazaGroup) {
  return mount(PlazaGroupSection, {
    props: { group },
    global: {
      stubs: {
        Icon: true,
        PlatformIcon: true,
        PlazaModelPricingTable: {
          name: 'PlazaModelPricingTable',
          props: [
            'models',
            'platform',
            'rateMultiplier',
            'userRateMultiplier',
            'imageRateIndependent',
            'imageRateMultiplier',
          ],
          template: '<div data-testid="pricing-table-stub" />',
        },
      },
    },
  })
}

describe('PlazaGroupSection', () => {
  it('完整传递分组倍率、图片倍率和模型数据', () => {
    const wrapper = mountSection(makeGroup({
      user_rate_multiplier: 0.75,
      image_rate_independent: true,
      image_rate_multiplier: 0.5,
    }))
    const pricing = wrapper.getComponent({ name: 'PlazaModelPricingTable' })

    expect(pricing.props('platform')).toBe('openai')
    expect(pricing.props('rateMultiplier')).toBe(1)
    expect(pricing.props('userRateMultiplier')).toBe(0.75)
    expect(pricing.props('imageRateIndependent')).toBe(true)
    expect(pricing.props('imageRateMultiplier')).toBe(0.5)
    expect(pricing.props('models')).toHaveLength(1)
  })

  it('展示专属倍率、专属分组和高峰说明且不再渲染彩色标题条', () => {
    const wrapper = mountSection(makeGroup({
      rate_multiplier: 1,
      user_rate_multiplier: 0.8,
      is_exclusive: true,
      peak_rate_enabled: true,
      peak_start: '09:00',
      peak_end: '18:00',
      peak_rate_multiplier: 1.2,
    }))

    expect(wrapper.text()).toContain('1x')
    expect(wrapper.text()).toContain('0.8x')
    expect(wrapper.text()).toContain('modelPlaza.badges.exclusive')
    expect(wrapper.text()).toContain('modelPlaza.detail.peakNote')
    expect(wrapper.find('.group-accent').exists()).toBe(false)
  })

  it('空模型分组保留明确空态', () => {
    const wrapper = mountSection(makeGroup({ models: [] }))

    expect(wrapper.get('.plaza-group-empty').text()).toBe('modelPlaza.detail.noModels')
    expect(wrapper.find('[data-testid="pricing-table-stub"]').exists()).toBe(false)
  })
})
