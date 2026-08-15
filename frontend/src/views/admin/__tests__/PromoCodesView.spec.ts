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
      UiErrorState: { props: ['title'], emits: ['retry'], template: '<div data-test="error-state">{{ title }}<button data-test="retry" @click="$emit(\'retry\')">retry</button></div>' },
      UiDataCell: { props: ['value', 'meta'], template: '<div>{{ value }} {{ meta }}</div>' },
      UiBadge: true,
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

  it('keeps sorting on the server and resets to the first page', async () => {
    const wrapper = mountView()
    await flushPromises()
    list.mockClear()
    const vm = wrapper.vm as any

    vm.pagination.page = 4
    await vm.handleSort('bonus_amount', 'asc')

    expect(list).toHaveBeenLastCalledWith(
      1,
      20,
      expect.objectContaining({ sort_by: 'bonus_amount', sort_order: 'asc' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('shows a retryable error instead of treating a failed initial load as an empty collection', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    list.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-test="error-state"]').text()).toContain('admin.promo.failedToLoad')
    expect(showError).toHaveBeenCalledWith('admin.promo.failedToLoad')

    list.mockResolvedValueOnce({ items: [code], total: 1, page: 1, page_size: 20 })
    await wrapper.get('[data-test="retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-test="table"]').text()).toContain('WELCOME')
    consoleError.mockRestore()
  })

  it('preserves create and update timestamp payload semantics', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any

    Object.assign(vm.createForm, {
      code: '',
      bonus_amount: 8.5,
      max_uses: 3,
      expires_at_str: '2026-09-01T12:30',
      notes: '',
    })
    await vm.handleCreate()
    expect(create).toHaveBeenCalledWith({
      code: undefined,
      bonus_amount: 8.5,
      max_uses: 3,
      expires_at: Math.floor(new Date('2026-09-01T12:30').getTime() / 1000),
      notes: undefined,
    })

    vm.editingCode = code
    Object.assign(vm.editForm, {
      code: 'WELCOME-2',
      bonus_amount: 10,
      max_uses: 0,
      status: 'disabled',
      expires_at_str: '',
      notes: 'paused',
    })
    await vm.handleUpdate()
    expect(update).toHaveBeenCalledWith(code.id, {
      code: 'WELCOME-2',
      bonus_amount: 10,
      max_uses: 0,
      status: 'disabled',
      expires_at: 0,
      notes: 'paused',
    })
  })

  it('keeps usage pagination server-side and ignores stale code responses', async () => {
    let resolveFirst!: (value: { items: any[]; total: number }) => void
    let resolveSecond!: (value: { items: any[]; total: number }) => void
    const first = new Promise<{ items: any[]; total: number }>((resolve) => { resolveFirst = resolve })
    const second = new Promise<{ items: any[]; total: number }>((resolve) => { resolveSecond = resolve })
    getUsages.mockImplementation((id: number) => id === 1 ? first : second)

    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any
    const secondCode = { ...code, id: 2, code: 'SECOND' }

    void vm.handleViewUsages(code)
    void vm.handleViewUsages(secondCode)
    resolveSecond({
      items: [{ id: 22, promo_code_id: 2, user_id: 9, bonus_amount: 4, used_at: '2026-08-15T08:00:00Z' }],
      total: 41,
    })
    await flushPromises()
    resolveFirst({
      items: [{ id: 11, promo_code_id: 1, user_id: 8, bonus_amount: 3, used_at: '2026-08-15T07:00:00Z' }],
      total: 1,
    })
    await flushPromises()

    expect(vm.usages.map((usage: any) => usage.id)).toEqual([22])
    expect(vm.usagesTotal).toBe(41)

    getUsages.mockResolvedValue({ items: [], total: 41 })
    vm.handleUsagesPageChange(2)
    await flushPromises()
    expect(getUsages).toHaveBeenLastCalledWith(2, 2, 20)

    vm.handleUsagesPageSizeChange(50)
    await flushPromises()
    expect(getUsages).toHaveBeenLastCalledWith(2, 1, 50)
  })
})
