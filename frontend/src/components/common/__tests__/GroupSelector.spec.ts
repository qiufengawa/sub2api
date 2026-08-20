import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import GroupSelector from '../GroupSelector.vue'
import type { AdminGroup } from '@/types'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: { count?: number }) =>
        key === 'common.selectedCount' ? `selected:${params?.count ?? 0}` : key
    })
  }
})

const GroupBadgeStub = defineComponent({
  props: { name: { type: String, required: true } },
  template: '<span data-testid="group-badge">{{ name }}</span>'
})

function group(id: number, name: string, platform: AdminGroup['platform'], description = ''): AdminGroup {
  return {
    id,
    name,
    platform,
    description,
    rate_multiplier: 1,
    account_count: id
  } as AdminGroup
}

function mountSelector(overrides: Partial<InstanceType<typeof GroupSelector>['$props']> = {}) {
  return mount(GroupSelector, {
    props: {
      modelValue: [1],
      groups: [
        group(1, 'Primary', 'openai', 'fast route'),
        group(2, 'Backup', 'openai', 'secondary route'),
        group(3, 'Claude', 'anthropic')
      ],
      searchable: true,
      ...overrides
    },
    global: {
      stubs: { GroupBadge: GroupBadgeStub }
    }
  })
}

describe('GroupSelector', () => {
  it('uses shared search and checkbox controls while preserving selection updates', async () => {
    const wrapper = mountSelector()

    expect(wrapper.text()).toContain('selected:1')
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(3)
    expect(wrapper.find('label.ui-check--full').exists()).toBe(true)

    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[1, 2]])
  })

  it('filters by name or description without changing the selected value', async () => {
    const wrapper = mountSelector()
    const search = wrapper.get('input[type="search"]')

    await search.setValue('secondary')
    expect(wrapper.findAll('[data-testid="group-badge"]').map((item) => item.text())).toEqual(['Backup'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('keeps composite-compatible platform filtering and antigravity mixed scheduling', () => {
    const groups = [
      group(1, 'Antigravity', 'antigravity'),
      group(2, 'Claude', 'anthropic'),
      group(3, 'Gemini', 'gemini'),
      group(4, 'OpenAI', 'openai'),
      group(5, 'Composite', 'composite')
    ]
    const wrapper = mountSelector({ groups, modelValue: [], platform: 'antigravity', mixedScheduling: true })

    expect(wrapper.findAll('[data-testid="group-badge"]').map((item) => item.text())).toEqual([
      'Antigravity',
      'Claude',
      'Gemini',
      'Composite'
    ])
  })
})
