import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import type { Proxy } from '@/types'
import ProxiesView from '../ProxiesView.vue'

const {
  batchDelete,
  batchCreate,
  copyToClipboard,
  create,
  deleteProxy,
  exportData,
  getAllWithCount,
  list,
  showError,
  showSuccess
} = vi.hoisted(() => ({
  batchDelete: vi.fn(),
  batchCreate: vi.fn(),
  copyToClipboard: vi.fn(),
  create: vi.fn(),
  deleteProxy: vi.fn(),
  exportData: vi.fn(),
  getAllWithCount: vi.fn(),
  list: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    proxies: {
      batchDelete,
      batchCreate,
      create,
      delete: deleteProxy,
      exportData,
      getAllWithCount,
      list
    }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess, showInfo: vi.fn() })
}))

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard })
}))

vi.mock('@/composables/useSwipeSelect', () => ({ useSwipeSelect: vi.fn() }))

const proxy = {
  id: 9,
  name: 'Primary proxy',
  protocol: 'socks5',
  host: '127.0.0.1',
  port: 1080,
  username: '',
  password: '',
  status: 'active',
  account_count: 0,
  created_at: 1
} as Proxy

const DataTableStub = {
  props: ['data', 'columns', 'loading'],
  emits: ['sort'],
  template: `
    <div>
      <slot name="header-select" />
      <template v-if="data.length">
        <slot name="cell-select" :row="data[0]" />
        <slot name="cell-protocol" :row="data[0]" :value="data[0].protocol" />
        <slot name="cell-address" :row="data[0]" />
        <slot name="cell-status" :row="data[0]" :value="data[0].status" />
        <slot name="cell-actions" :row="data[0]" />
      </template>
    </div>
  `
}

const mountView = () => mount(ProxiesView, {
  global: {
    stubs: {
      AppLayout: { template: '<main><slot /></main>' },
      TablePageLayout: { template: '<section><slot name="filters"/><slot name="table"/><slot name="pagination"/></section>' },
      DataTable: DataTableStub,
      Pagination: true,
      BaseDialog: { props: ['show'], template: '<div v-if="show"><slot/><slot name="footer"/></div>' },
      ConfirmDialog: true,
      UiConfirmDialog: {
        props: ['show', 'pending', 'title'],
        emits: ['confirm', 'cancel'],
        template: `
          <div
            v-if="show"
            :data-test="title === 'admin.proxies.deleteProxy' ? 'confirm-delete-proxy' : 'confirm-delete-batch'"
          >
            <button data-test="confirm" :disabled="pending" @click="$emit('confirm')">confirm</button>
            <button data-test="cancel" :disabled="pending" @click="$emit('cancel')">cancel</button>
          </div>
        `
      },
      ImportDataModal: true,
      ProxyAdBanner: true,
      PlatformTypeBadge: true,
      Teleport: true
    }
  }
})

describe('ProxiesView workspace', () => {
  beforeEach(() => {
    list.mockReset()
    batchDelete.mockReset()
    batchCreate.mockReset()
    create.mockReset()
    deleteProxy.mockReset()
    exportData.mockReset()
    getAllWithCount.mockReset()
    showError.mockReset()
    showSuccess.mockReset()
    copyToClipboard.mockReset()
    list.mockResolvedValue({ items: [proxy], total: 1, pages: 1, page: 1, page_size: 20 })
    getAllWithCount.mockResolvedValue([proxy])
    create.mockResolvedValue(proxy)
    deleteProxy.mockResolvedValue(undefined)
    batchDelete.mockResolvedValue({ deleted_ids: [proxy.id], skipped: [] })
    batchCreate.mockResolvedValue({ created: 1, skipped: 0 })
    exportData.mockResolvedValue({ items: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps compact table selection connected to batch actions', async () => {
    const wrapper = mountView()
    await flushPromises()

    const batchDelete = wrapper.get('[data-test="batch-delete-proxies"]')
    expect(batchDelete.attributes('disabled')).toBeDefined()

    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    expect(batchDelete.attributes('disabled')).toBeUndefined()
  })

  it('preserves the existing debounced server-side search contract', async () => {
    vi.useFakeTimers()
    const wrapper = mountView()
    await flushPromises()
    list.mockClear()

    await wrapper.get('input[type="search"]').setValue('edge')
    await vi.advanceTimersByTimeAsync(301)
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(
      1,
      expect.any(Number),
      expect.objectContaining({ search: 'edge', sort_by: 'id', sort_order: 'desc' }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('submits the compact create form with the existing API payload', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-test="create-proxy"]').trigger('click')

    const form = wrapper.get('#create-proxy-form')
    const inputs = form.findAll('input')
    await inputs[0].setValue('Edge proxy')
    await inputs[1].setValue('proxy.internal')
    await inputs[2].setValue('1080')
    await form.trigger('submit')
    await flushPromises()

    expect(create).toHaveBeenCalledWith({
      name: 'Edge proxy',
      protocol: 'http',
      host: 'proxy.internal',
      port: 1080,
      username: null,
      password: null,
      expires_at: null,
      fallback_mode: 'none',
      backup_proxy_id: null,
      expiry_warn_days: 7
    })
  })

  it('copies the selected proxy format from the shared dropdown menu', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('button[aria-label="admin.proxies.copyFormats"]').trigger('click')
    await flushPromises()

    const items = wrapper.findAll<HTMLButtonElement>('[role="menuitem"]')
    expect(items.map((item) => item.text())).toContain('127.0.0.1:1080')
    await items.find((item) => item.text() === '127.0.0.1:1080')?.trigger('click')

    expect(copyToClipboard).toHaveBeenCalledWith('127.0.0.1:1080', 'admin.proxies.urlCopied')
    wrapper.unmount()
  })

  it('single-flight guards proxy deletion and keeps the confirmation locked while pending', async () => {
    let resolveDelete!: () => void
    deleteProxy.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveDelete = resolve }))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button[aria-label="common.delete"]').trigger('click')
    const dialog = wrapper.get('[data-test="confirm-delete-proxy"]')
    const confirm = dialog.get('[data-test="confirm"]')
    const cancel = dialog.get('[data-test="cancel"]')

    await confirm.trigger('click')
    await confirm.trigger('click')
    expect(deleteProxy).toHaveBeenCalledTimes(1)
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(cancel.attributes('disabled')).toBeDefined()

    resolveDelete()
    await flushPromises()
    expect(wrapper.find('[data-test="confirm-delete-proxy"]').exists()).toBe(false)
  })

  it('keeps a failed proxy deletion confirmation open for retry', async () => {
    deleteProxy.mockRejectedValueOnce(new Error('delete failed'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button[aria-label="common.delete"]').trigger('click')
    await wrapper.get('[data-test="confirm-delete-proxy"] [data-test="confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="confirm-delete-proxy"]').exists()).toBe(true)
    expect(showError).toHaveBeenCalled()
  })

  it('keeps the export confirmation open after a failed export', async () => {
    exportData.mockRejectedValueOnce(new Error('export failed'))
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.showExportDataDialog = true

    await vm.handleExportData()

    expect(vm.showExportDataDialog).toBe(true)
    expect(vm.exportingData).toBe(false)
    expect(showError).toHaveBeenCalledWith('export failed')
    wrapper.unmount()
  })

  it('single-flight guards batch proxy deletion and keeps failed selection context', async () => {
    let resolveDelete!: (value: { deleted_ids: number[]; skipped: unknown[] }) => void
    batchDelete.mockImplementationOnce(() => new Promise((resolve) => { resolveDelete = resolve }))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    await wrapper.get('[data-test="batch-delete-proxies"]').trigger('click')
    const dialog = wrapper.get('[data-test="confirm-delete-batch"]')
    const confirm = dialog.get('[data-test="confirm"]')
    const cancel = dialog.get('[data-test="cancel"]')

    await confirm.trigger('click')
    await confirm.trigger('click')
    expect(batchDelete).toHaveBeenCalledTimes(1)
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(cancel.attributes('disabled')).toBeDefined()

    resolveDelete({ deleted_ids: [proxy.id], skipped: [] })
    await flushPromises()
    expect(wrapper.find('[data-test="confirm-delete-batch"]').exists()).toBe(false)
  })

  it('retains skipped proxy IDs after a partial batch delete', async () => {
    batchDelete.mockResolvedValueOnce({
      deleted_ids: [10],
      skipped: [{ id: proxy.id, reason: 'proxy in use' }],
    })
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.setSelectedIds([proxy.id, 10])
    vm.showBatchDeleteDialog = true

    await vm.confirmBatchDelete()
    await flushPromises()

    expect(batchDelete).toHaveBeenCalledWith([proxy.id, 10])
    expect(vm.selectedCount).toBe(1)
    expect(Array.from(vm.selectedProxyIds as Set<number>)).toEqual([proxy.id])
    expect(vm.showBatchDeleteDialog).toBe(false)
    wrapper.unmount()
  })

  it('guards create and update mutations at the function boundary', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.submitting = true

    await vm.handleBatchCreate()
    await vm.handleCreateProxy()
    vm.editingProxy = proxy
    await vm.handleUpdateProxy()

    expect(batchCreate).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
