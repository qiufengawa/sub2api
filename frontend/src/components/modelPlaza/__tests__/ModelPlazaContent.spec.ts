import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModelPlazaContent from '../ModelPlazaContent.vue'
import type { ModelPlazaResponse } from '@/api/modelPlaza'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, number>) =>
        key === 'modelPlaza.summary' && params
          ? `${params.models}|${params.groups}|${params.platforms}`
          : key
    })
  }
})

const response: ModelPlazaResponse = {
  description: '',
  groups: [
    {
      id: 1,
      name: 'Anthropic Standard',
      description: '',
      platform: 'anthropic',
      subscription_type: 'standard',
      rate_multiplier: 0.8,
      peak_rate_enabled: false,
      peak_start: '',
      peak_end: '',
      peak_rate_multiplier: 1,
      is_exclusive: false,
      image_rate_independent: false,
      image_rate_multiplier: 1,
      models: [
        { name: 'model-alpha', platform: 'anthropic', pricing: null, official_pricing: null },
        { name: 'model-beta', platform: 'anthropic', pricing: null, official_pricing: null }
      ]
    },
    {
      id: 2,
      name: 'OpenAI Standard',
      description: '',
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
      models: [
        { name: 'model-alpha', platform: 'openai', pricing: null, official_pricing: null }
      ]
    }
  ]
}

function mountContent(props: Partial<InstanceType<typeof ModelPlazaContent>['$props']> = {}) {
  return mount(ModelPlazaContent, {
    props: { response, loading: false, error: false, ...props },
    global: {
      stubs: {
        PlazaFilterBar: { template: '<div data-testid="filter-stub"></div>' },
        PlazaGroupSection: {
          props: ['group'],
          template: '<div class="group-stub">{{ group.name }}</div>'
        }
      }
    }
  })
}

describe('ModelPlazaContent', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('在同一概览行显示去重模型数、分组数和平台数', () => {
    const wrapper = mountContent()
    expect(wrapper.get('[data-testid="model-plaza-summary"]').text()).toBe('2|2|2')
  })

  it('顶部搜索继续使用原有模型名过滤逻辑', async () => {
    const wrapper = mountContent()
    const search = wrapper.get('input[type="search"]')

    expect(wrapper.findAll('.group-stub')).toHaveLength(2)
    await search.setValue('model-beta')

    expect(wrapper.findAll('.group-stub')).toHaveLength(1)
    expect(wrapper.get('.group-stub').text()).toBe('Anthropic Standard')
  })

  it('使用稳定骨架保留加载几何', () => {
    const wrapper = mountContent({ response: null, loading: true })
    const status = wrapper.get('[role="status"]')

    expect(status.attributes('aria-busy')).toBe('true')
    expect(status.findAll('.ui-skeleton')).toHaveLength(6)
  })

  it('加载失败时提供页面内重试操作', async () => {
    const wrapper = mountContent({ response: null, error: true })

    await wrapper.get('.ui-error-state button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('空数据使用共享空态而不是伪造模型行', () => {
    const wrapper = mountContent({ response: { description: '', groups: [] } })

    expect(wrapper.find('.ui-empty').exists()).toBe(true)
    expect(wrapper.findAll('.group-stub')).toHaveLength(0)
  })
})
