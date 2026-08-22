import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ChannelsView from '../ChannelsView.vue'

const { list, update, remove, getAllGroups, getWebSearchEmulationConfig, showError, showSuccess } = vi.hoisted(() => ({
  list: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getAllGroups: vi.fn(),
  getWebSearchEmulationConfig: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    channels: { list, update, remove },
    groups: { getAll: getAllGroups },
    settings: { getWebSearchEmulationConfig },
  },
}))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError, showSuccess }) }))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const channel = {
  id: 3,
  name: 'Primary relay',
  description: 'Main route',
  status: 'active',
  group_ids: [1, 2],
  model_pricing: [],
  created_at: '2026-08-15T00:00:00Z',
}

const mountView = () => mount(ChannelsView, {
  global: {
    stubs: {
      AppLayout: { template: '<main><slot /></main>' },
      AppPage: { template: '<section><slot /></section>' },
      AppPageHeader: { template: '<header><slot name="actions" /></header>' },
      UiButton: { template: '<button><slot name="icon"/><slot/></button>' },
      UiIconButton: { emits: ['click'], template: '<button @click="$emit(\'click\')" />' },
      UiSearchInput: { props: ['modelValue'], emits: ['update:modelValue', 'search'], template: '<input data-test="search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'search\', $event.target.value)" />' },
      UiSelect: { props: ['modelValue', 'options'], emits: ['update:modelValue', 'change'], template: '<select data-test="status" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>' },
      UiTableToolbar: { template: '<div><slot/><slot name="actions"/></div>' },
      UiServerTableWorkspace: { template: '<div><slot name="toolbar"/><slot/><slot name="pagination"/></div>' },
      UiDataTable: { props: ['columns', 'data'], template: '<div data-test="table"><div v-for="row in data" :key="row.id"><slot v-for="column in columns" :name="`cell-${column.key}`" :row="row" :value="row[column.key]" /></div><slot v-if="!data.length" name="empty"/></div>' },
      UiPagination: true,
      UiSwitch: { props: ['modelValue'], emits: ['update:modelValue'], template: '<button data-test="switch" @click="$emit(\'update:modelValue\', !modelValue)" />' },
      UiCheckbox: true,
      UiTabs: true,
      UiDialog: { props: ['show'], template: '<div v-if="show"><slot/><slot name="footer"/></div>' },
      UiConfirmDialog: {
        props: ['show', 'pending'],
        emits: ['confirm', 'cancel'],
        template: '<div v-if="show"><button data-test="confirm-delete" :disabled="pending" @click="$emit(\'confirm\')">confirm</button><button data-test="cancel-delete" :disabled="pending" @click="$emit(\'cancel\')">cancel</button></div>'
      },
      UiEmptyState: { template: '<div data-test="empty"><slot name="action"/></div>' },
      UiBadge: true,
      UiTextField: true,
      UiTextArea: true,
      PlatformIcon: true,
      PricingEntryCard: true,
      Icon: true,
    },
  },
})

describe('admin ChannelsView', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue({ items: [channel], total: 1, page: 1, page_size: 20 })
    update.mockReset().mockResolvedValue(undefined)
    remove.mockReset().mockResolvedValue(undefined)
    getAllGroups.mockReset().mockResolvedValue([])
    getWebSearchEmulationConfig.mockReset().mockResolvedValue({ enabled: false, providers: [] })
    showError.mockReset()
    showSuccess.mockReset()
  })

  it('loads channel rows with server-side sorting', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(list).toHaveBeenCalledWith(1, 20, {
      status: undefined,
      search: undefined,
      sort_by: 'created_at',
      sort_order: 'desc',
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(wrapper.get('[data-test="table"]').text()).toContain('Primary relay')
  })

  it('reloads from page one when search changes', async () => {
    vi.useFakeTimers()
    const wrapper = mountView()
    await flushPromises()
    list.mockClear()

    await wrapper.get('[data-test="search"]').setValue('secondary')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ search: 'secondary' }), expect.anything())
    vi.useRealTimers()
  })

  it('single-flight guards channel deletion and preserves confirmation on failure', async () => {
    let resolveRemove!: () => void
    remove.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveRemove = resolve }))
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.deletingChannel = channel
    vm.showDeleteDialog = true

    const first = vm.confirmDelete()
    const second = vm.confirmDelete()
    expect(remove).toHaveBeenCalledTimes(1)
    expect(vm.deletePending).toBe(true)
    resolveRemove()
    await Promise.all([first, second])
    expect(vm.deletePending).toBe(false)
    expect(vm.showDeleteDialog).toBe(false)

    remove.mockRejectedValueOnce(new Error('delete failed'))
    vm.deletingChannel = channel
    vm.showDeleteDialog = true
    await vm.confirmDelete()
    expect(vm.showDeleteDialog).toBe(true)
    expect(showError).toHaveBeenCalled()
  })

  it('single-flight guards channel status toggles and clears the pending id', async () => {
    let resolveUpdate!: () => void
    update.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveUpdate = resolve }))
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any

    const first = vm.toggleChannelStatus(channel)
    const second = vm.toggleChannelStatus(channel)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(channel.id, { status: 'disabled' })
    expect(vm.channelStatusPendingIds.has(channel.id)).toBe(true)

    resolveUpdate()
    await Promise.all([first, second])
    expect(vm.channelStatusPendingIds.has(channel.id)).toBe(false)
    expect(channel.status).toBe('disabled')
  })
})
