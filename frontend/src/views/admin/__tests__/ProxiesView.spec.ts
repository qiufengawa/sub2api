import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import type { Proxy } from '@/types'
import ProxiesView from '../ProxiesView.vue'

const { create, getAllWithCount, list, showError, showSuccess } = vi.hoisted(() => ({
  create: vi.fn(),
  getAllWithCount: vi.fn(),
  list: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    proxies: {
      create,
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
  useClipboard: () => ({ copyToClipboard: vi.fn() })
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
    create.mockReset()
    getAllWithCount.mockReset()
    showError.mockReset()
    showSuccess.mockReset()
    list.mockResolvedValue({ items: [proxy], total: 1, pages: 1, page: 1, page_size: 20 })
    getAllWithCount.mockResolvedValue([proxy])
    create.mockResolvedValue(proxy)
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
})
