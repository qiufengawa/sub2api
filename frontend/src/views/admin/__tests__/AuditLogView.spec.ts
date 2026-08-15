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
      UiDataTable: true,
      UiDrawer: true,
      UiDialog: true,
      UiConfirmDialog: true,
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
    mountView()
    await flushPromises()

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
