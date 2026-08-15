import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PromoCodesView from '../PromoCodesView.vue'

const { list, create, update, remove, getUsages, showError, showSuccess } = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getUsages: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: { promo: { list, create, update, delete: remove, getUsages } },
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError, showSuccess }) }))
vi.mock('@/composables/useClipboard', () => ({ useClipboard: () => ({ copyToClipboard: vi.fn().mockResolvedValue(true) }) }))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const code = {
  id: 1,
  code: 'WELCOME',
  bonus_amount: 12,
  max_uses: 10,
  used_count: 2,
  status: 'active',
  expires_at: null,
  notes: '',
  created_at: '2026-08-15T00:00:00Z',
}

const mountView = () => mount(PromoCodesView, {
  global: {
    stubs: {
      AppLayout: { template: '<main><slot /></main>' },
      AppPage: { template: '<section><slot /></section>' },
      AppPageHeader: { template: '<header><slot name="actions" /></header>' },
      UiButton: { template: '<button><slot name="icon"/><slot/></button>' },
      UiIconButton: { template: '<button @click="$emit(\'click\')" />', emits: ['click'] },
      UiSearchInput: { props: ['modelValue'], emits: ['update:modelValue', 'search'], template: '<input data-test="search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'search\', $event.target.value)" />' },
      UiSelect: { props: ['modelValue', 'options'], emits: ['update:modelValue', 'change'], template: '<select data-test="status" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>' },
      UiTableToolbar: { template: '<div><slot/><slot name="actions"/></div>' },
      UiServerTableWorkspace: { template: '<div><slot name="toolbar"/><slot/><slot name="pagination"/></div>' },
      UiDataTable: { props: ['columns', 'data'], template: '<div data-test="table"><div v-for="row in data" :key="row.id"><slot v-for="column in columns" :name="`cell-${column.key}`" :row="row" :value="row[column.key]" /></div><slot v-if="!data.length" name="empty"/></div>' },
      UiPagination: true,
      UiDialog: { props: ['show'], template: '<div v-if="show"><slot/><slot name="footer"/></div>' },
      UiConfirmDialog: true,
      UiEmptyState: { template: '<div data-test="empty"><slot name="action"/></div>' },
      UiBadge: true,
      UiSpinner: true,
      UiTextField: true,
      UiTextArea: true,
      Icon: true,
    },
  },
})

describe('admin PromoCodesView', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue({ items: [code], total: 1, page: 1, page_size: 20 })
    create.mockReset().mockResolvedValue({})
    update.mockReset().mockResolvedValue({})
    remove.mockReset().mockResolvedValue({})
    getUsages.mockReset().mockResolvedValue({ items: [], total: 0 })
    showError.mockReset()
    showSuccess.mockReset()
  })

  it('loads promo codes with the default server sort', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(list).toHaveBeenCalledWith(1, 20, {
      status: undefined,
      search: undefined,
      sort_by: 'created_at',
      sort_order: 'desc',
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(wrapper.get('[data-test="table"]').text()).toContain('WELCOME')
  })

  it('reloads from page one when search or status changes', async () => {
    const wrapper = mountView()
    await flushPromises()
    list.mockClear()

    await wrapper.get('[data-test="search"]').setValue('VIP')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ search: 'VIP' }), expect.anything())

    await wrapper.get('[data-test="status"]').setValue('disabled')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ status: 'disabled' }), expect.anything())
  })
})
