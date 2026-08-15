import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import type { AuditLog } from '@/api/admin'
import AuditLogView from '../AuditLogView.vue'

const { clear, get, getStatus, list, showError, showSuccess } = vi.hoisted(() => ({
  clear: vi.fn(),
  get: vi.fn(),
  getStatus: vi.fn(),
  list: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: { audit: { clear, get, list } }
}))

vi.mock('@/api', () => ({
  totpAPI: { getStatus }
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({ showError, showSuccess })
}))

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key
  })
}))

const makeLog = (id: number): AuditLog => ({
  id,
  created_at: '2026-08-15T02:00:00.000Z',
  actor_email: `admin-${id}@example.com`,
  actor_role: 'admin',
  auth_method: 'jwt',
  credential_masked: 'ey...12',
  action: `admin.test.${id}`,
  method: 'POST',
  path: `/admin/test/${id}`,
  request_id: `request-${id}`,
  client_ip: '127.0.0.1',
  user_agent: 'Vitest',
  status_code: 200,
  latency_ms: 12
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const mountView = () => mount(AuditLogView, {
  global: {
    stubs: {
      AppLayout: { template: '<main><slot /></main>' },
      UiServerTableWorkspace: {
        template: '<section><slot name="filters"/><slot/><slot name="pagination"/></section>'
      },
      UiDataTable: {
        props: ['data'],
        template: '<div><slot v-if="!data.length" name="empty"/></div>'
      },
      UiDrawer: {
        props: ['show'],
        template: '<aside v-if="show"><slot/></aside>'
      },
      UiDialog: true,
      UiConfirmDialog: true,
      UiErrorState: {
        inheritAttrs: false,
        props: ['title'],
        emits: ['retry'],
        template: '<div v-bind="$attrs">{{ title }}<button data-testid="retry" @click="$emit(\'retry\')">retry</button></div>'
      },
      Teleport: true
    }
  }
})

describe('AuditLogView contracts', () => {
  beforeEach(() => {
    for (const fn of [clear, get, getStatus, list, showError, showSuccess]) fn.mockReset()
    list.mockResolvedValue({ items: [makeLog(1)], total: 1, page: 1, page_size: 20, pages: 1 })
    getStatus.mockResolvedValue({ enabled: true })
    clear.mockResolvedValue({ deleted: 3 })
  })

  it('loads the stable server-side audit query on mount', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('main.app-page').classes()).toContain('app-page--compact')
    expect(wrapper.get('h1').text()).toBe('admin.audit.title')
    expect(list).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      q: undefined,
      actor_email: undefined,
      action: undefined,
      client_ip: undefined,
      method: undefined,
      auth_method: undefined,
      success: undefined
    })
    expect((wrapper.vm as any).authMethodOptions).toContainEqual({ value: 'passkey', label: 'Passkey' })
  })

  it('rejects an invalid custom time range before changing the applied query', async () => {
    const wrapper = mountView()
    await flushPromises()
    list.mockClear()
    const vm = wrapper.vm as any

    vm.customStartTimeInput = '2026-08-15T10:00'
    vm.customEndTimeInput = '2026-08-15T09:00'
    vm.handleCustomTimeRangeConfirm()

    expect(vm.customRangeError).toBe('invalid')
    expect(vm.timeRange).toBe('')
    expect(list).not.toHaveBeenCalled()
  })

  it('shows a retryable list error and reloads in place', async () => {
    list.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="audit-list-error"]').text()).toContain('admin.audit.loadFailed')
    expect(showError).toHaveBeenCalledWith('network')

    list.mockResolvedValueOnce({ items: [makeLog(2)], total: 1, page: 1, page_size: 20, pages: 1 })
    await wrapper.get('[data-testid="audit-list-error"] [data-testid="retry"]').trigger('click')
    await flushPromises()
    expect((wrapper.vm as any).logs[0].id).toBe(2)
  })

  it('converts the confirmed local custom range to RFC3339', async () => {
    const wrapper = mountView()
    await flushPromises()
    list.mockClear()

    const vm = wrapper.vm as any
    vm.customStartTime = '2026-08-15T08:00'
    vm.customEndTime = '2026-08-15T09:30'
    vm.timeRange = 'custom'
    await vm.search()

    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({
      start_time: new Date('2026-08-15T08:00').toISOString(),
      end_time: new Date('2026-08-15T09:30').toISOString()
    }))
  })

  it('does not let a slower detail response replace the latest selection', async () => {
    const wrapper = mountView()
    await flushPromises()
    const first = deferred<AuditLog>()
    const second = deferred<AuditLog>()
    get.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)

    const vm = wrapper.vm as any
    const firstRequest = vm.openDetail(1)
    const secondRequest = vm.openDetail(2)
    second.resolve(makeLog(2))
    await secondRequest
    first.resolve(makeLog(1))
    await firstRequest

    expect(vm.detail.id).toBe(2)
    expect(vm.detailLoading).toBe(false)
  })

  it('keeps a failed detail drawer open and retries the same log', async () => {
    const wrapper = mountView()
    await flushPromises()
    get.mockRejectedValueOnce(new Error('detail failed'))
    const vm = wrapper.vm as any

    await vm.openDetail(7)
    await flushPromises()
    expect(vm.detailVisible).toBe(true)
    expect(vm.detailError).toBe(true)
    expect(wrapper.get('[data-testid="audit-detail-error"]').text()).toContain('admin.audit.detail.loadFailed')

    get.mockResolvedValueOnce(makeLog(7))
    await wrapper.get('[data-testid="audit-detail-error"] [data-testid="retry"]').trigger('click')
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(7)
    expect(vm.detail.id).toBe(7)
  })

  it('requests exactly once when the page size changes', async () => {
    const wrapper = mountView()
    await flushPromises()
    list.mockClear()

    await (wrapper.vm as any).onPageSizeChange(50)

    expect(list).toHaveBeenCalledTimes(1)
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, page_size: 50 }))
  })

  it('keeps the TOTP gate and clear payload intact', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any

    await vm.openClearDialog()
    expect(getStatus).toHaveBeenCalledOnce()
    expect(vm.clearConfirmVisible).toBe(true)

    vm.onClearConfirmed()
    vm.clearTotpCode = '123456'
    await vm.submitClear()

    expect(clear).toHaveBeenCalledWith('123456')
    expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining('admin.audit.clearConfirm.success'))
    expect(vm.clearTotpVisible).toBe(false)
  })
})
