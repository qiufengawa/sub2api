import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminPaymentPlansView from '../AdminPaymentPlansView.vue'
import {
  buildCatalogTemplateRoutes,
  isPaymentCatalogTemplate,
  personalizeCatalogTemplate,
} from '../catalogTemplate'
import type { PaymentCatalogImportRequest } from '@/types/payment'

const { getPlans, getConfig, getGroups } = vi.hoisted(() => ({
  getPlans: vi.fn(),
  getConfig: vi.fn(),
  getGroups: vi.fn(),
}))

vi.mock('@/api/admin/payment', () => ({
  adminPaymentAPI: {
    getPlans,
    getConfig,
  },
}))

vi.mock('@/api/admin', () => ({
  default: {
    groups: {
      getAll: getGroups,
    },
  },
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

const DataTableStub = {
  props: ['data'],
  template: `
    <div>
      <div v-for="row in data" :key="row.id">
        <slot name="cell-price" :value="row.price" :row="row" />
        <slot name="cell-validity_days" :value="row.validity_days" :row="row" />
      </div>
    </div>
  `,
}

describe('AdminPaymentPlansView', () => {
  beforeEach(() => {
    getGroups.mockResolvedValue([])
    getConfig.mockResolvedValue({ data: {} })
    getPlans.mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'CNY plan',
          group_id: 1,
          price: 499,
          original_price: 599,
          currency: 'CNY',
          validity_days: 30,
          validity_unit: 'day',
          sort_order: 0,
          for_sale: true,
          features: [],
        },
        {
          id: 2,
          name: 'Legacy plan',
          group_id: 1,
          price: 10,
          original_price: 0,
          currency: '',
          validity_days: 30,
          validity_unit: 'day',
          sort_order: 0,
          for_sale: true,
          features: [],
        },
      ],
    })
  })

  it('uses the configured currency symbol and keeps legacy prices in USD', async () => {
    const wrapper = mount(AdminPaymentPlansView, {
      global: {
        plugins: [createPinia()],
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          DataTable: DataTableStub,
          ConfirmDialog: true,
          GroupBadge: true,
          Icon: true,
          PlanEditDialog: true,
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('¥499.00CNY')
    expect(wrapper.text()).toContain('¥599.00')
    expect(wrapper.text()).toContain('$10.00')
    expect(wrapper.text()).toContain('30 payment.admin.days')
    expect(wrapper.text()).not.toContain('payment.admin.day ')
  })

  it('personalizes the template with active account groups without mutating the source', () => {
    const catalog: PaymentCatalogImportRequest = {
      schema_version: 1,
      mode: 'upsert',
      defaults: { platform: 'composite' },
      groups: [
        { key: 'lite', name: 'Lite 全模型订阅', copy_accounts_from: ['stale source'] },
        { key: 'pro', name: 'Pro 全模型订阅', copy_accounts_from: ['stale source'] },
      ],
      plans: [{ group_key: 'lite', name: 'Lite', price: 12.9 }],
    }

    const result = personalizeCatalogTemplate(catalog, [
      { id: 1, name: 'OpenAI 主池', status: 'active', account_count: 2, platform: 'openai' },
      { id: 2, name: 'Anthropic 主池', status: 'active', account_count: 1, platform: 'anthropic' },
      { id: 3, name: '停用分组', status: 'inactive', account_count: 3, platform: 'openai' },
      { id: 4, name: '空分组', status: 'active', account_count: 0, platform: 'openai' },
      { id: 5, name: 'Lite 全模型订阅', status: 'active', account_count: 4, platform: 'composite' },
      { id: 6, name: 'OpenAI 主池', status: 'active', account_count: 2, platform: 'openai' },
    ])

    expect(result.sourceCount).toBe(2)
    expect(result.catalog.groups.map(group => group.copy_accounts_from)).toEqual([
      ['OpenAI 主池', 'Anthropic 主池'],
      ['OpenAI 主池', 'Anthropic 主池'],
    ])
    expect(catalog.groups[0].copy_accounts_from).toEqual(['stale source'])
  })

  it('adds explicit routes for aliases that the composite detector cannot safely infer', () => {
    const result = buildCatalogTemplateRoutes([
      {
        group: { id: 3, name: '现有 Composite', status: 'active', account_count: 2, platform: 'composite' },
        routes: [{
          id: 9,
          group_id: 3,
          public_model: 'llama-4-maverick',
          match_type: 'exact',
          target_platform: 'openai',
          upstream_model: 'llama-4-maverick',
          endpoint: 'any',
          priority: 20,
          enabled: true,
          notes: 'existing route',
        }],
      },
      {
        group: { id: 1, name: 'OpenAI 主池', status: 'active', account_count: 2, platform: 'openai' },
        models: ['gpt-5.1', 'deepseek-v3', 'deepseek-*', 'invalid*middle'],
      },
      {
        group: { id: 2, name: 'Antigravity 主池', status: 'active', account_count: 1, platform: 'antigravity' },
        models: ['gemini-2.5-pro'],
      },
    ])

    expect(result.omittedCount).toBe(1)
    expect(result.routes.map(route => ({
      model: route.public_model,
      match: route.match_type,
      platform: route.target_platform,
    }))).toEqual([
      { model: 'llama-4-maverick', match: 'exact', platform: 'openai' },
      { model: 'deepseek-v3', match: 'exact', platform: 'openai' },
      { model: 'deepseek-', match: 'prefix', platform: 'openai' },
      { model: 'gemini-2.5-pro', match: 'exact', platform: 'antigravity' },
    ])
  })

  it('rejects malformed template payloads before download', () => {
    expect(isPaymentCatalogTemplate({ schema_version: 1, mode: 'upsert', defaults: {}, groups: [], plans: [] })).toBe(true)
    expect(isPaymentCatalogTemplate({ schema_version: 1, mode: 'upsert', defaults: {}, groups: [{}], plans: [] })).toBe(false)
    expect(isPaymentCatalogTemplate({ schema_version: 2, mode: 'upsert', defaults: {}, groups: [], plans: [] })).toBe(false)
  })
})
