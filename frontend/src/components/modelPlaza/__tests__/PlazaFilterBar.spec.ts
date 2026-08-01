import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PlazaFilterBar from '../PlazaFilterBar.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const groups = [
  { id: 1, name: 'Standard Group', platform: 'anthropic', rate: 0.8 },
  { id: 2, name: 'OpenAI Group', platform: 'openai', rate: 1 }
]

function mountFilter(overrides: Record<string, unknown> = {}) {
  return mount(PlazaFilterBar, {
    props: {
      platforms: ['anthropic', 'openai'],
      groups,
      rates: [0.8, 1],
      platform: 'all',
      groupId: 'all',
      rate: 'all',
      ...overrides
    }
  })
}

describe('PlazaFilterBar', () => {
  it('桌面保留平台、分组、倍率三组联动筛选', () => {
    const wrapper = mountFilter()
    const desktop = wrapper.find('.desktop-filter-list')

    expect(desktop.exists()).toBe(true)
    expect(desktop.findAll('.filter-row')).toHaveLength(3)
    expect(desktop.text()).toContain('Standard Group')
    expect(desktop.text()).toContain('0.8x')
  })

  it('手机端默认显示筛选摘要,点击后在原位展开三个选择器', async () => {
    const wrapper = mountFilter({ platform: 'anthropic', groupId: 1, rate: 0.8 })
    const toggle = wrapper.find('button[aria-expanded]')

    expect(toggle.text()).toContain('modelPlaza.filters.filterButton')
    expect(toggle.text()).toContain('anthropic · Standard Group · 0.8x')
    expect(wrapper.find('.mobile-filter-controls').exists()).toBe(false)

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('.mobile-filter-controls').exists()).toBe(true)
    expect(wrapper.findAll('.mobile-filter-field')).toHaveLength(3)
  })

  it('继续禁用当前组合下没有结果的筛选项', () => {
    const wrapper = mountFilter({ platform: 'anthropic' })
    const openAIGroup = wrapper
      .findAll('.filter-chip')
      .find((button) => button.text() === 'OpenAI Group')

    expect(openAIGroup).toBeDefined()
    expect(openAIGroup?.attributes('disabled')).toBeDefined()
  })
})
