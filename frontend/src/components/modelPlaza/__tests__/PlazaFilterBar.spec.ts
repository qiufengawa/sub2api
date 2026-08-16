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
    const desktop = wrapper.find('.plaza-filter-desktop')

    expect(desktop.exists()).toBe(true)
    expect(desktop.findAll('.filter-row')).toHaveLength(3)
    expect(desktop.text()).toContain('Standard Group')
    expect(desktop.text()).toContain('0.8x')
  })

  it('手机端默认显示筛选摘要,点击后打开底部筛选面板', async () => {
    const wrapper = mountFilter({ platform: 'anthropic', groupId: 1, rate: 0.8 })
    const toggle = wrapper.find('button[aria-expanded]')

    expect(toggle.text()).toContain('modelPlaza.filters.filterButton')
    expect(toggle.text()).toContain('anthropic · Standard Group · 0.8x')
    expect(wrapper.find('.mobile-filter-controls').exists()).toBe(false)

    await toggle.trigger('click')

    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(wrapper.getComponent({ name: 'UiSheet' }).props('show')).toBe(true)
    expect(wrapper.findAllComponents({ name: 'UiSelect' })).toHaveLength(3)
  })

  it('继续禁用当前组合下没有结果的筛选项', () => {
    const wrapper = mountFilter({ platform: 'anthropic' })
    const openAIGroup = wrapper
      .findAll('.filter-chip')
      .find((button) => button.text() === 'OpenAI Group')

    expect(openAIGroup).toBeDefined()
    expect(openAIGroup?.attributes('disabled')).toBeDefined()
  })

  it('共享筛选栏清除操作会同时重置平台、分组和倍率', async () => {
    const wrapper = mountFilter({ platform: 'anthropic', groupId: 1, rate: 0.8 })
    const clearButton = wrapper
      .findAll('.plaza-filter-desktop button')
      .find((button) => button.text().includes('modelPlaza.filters.clear'))

    expect(clearButton).toBeDefined()
    await clearButton?.trigger('click')
    expect(wrapper.emitted('update:platform')?.at(-1)).toEqual(['all'])
    expect(wrapper.emitted('update:groupId')?.at(-1)).toEqual(['all'])
    expect(wrapper.emitted('update:rate')?.at(-1)).toEqual(['all'])
  })
})
