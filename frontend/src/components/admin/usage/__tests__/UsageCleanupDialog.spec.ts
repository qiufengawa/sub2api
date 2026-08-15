import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const apiMocks = vi.hoisted(() => ({
  listCleanupTasks: vi.fn(),
  createCleanupTask: vi.fn(),
  cancelCleanupTask: vi.fn(),
}))

vi.mock('@/api/admin/usage', async () => {
  const actual = await vi.importActual<typeof import('@/api/admin/usage')>('@/api/admin/usage')
  return {
    ...actual,
    adminUsageAPI: {
      ...actual.adminUsageAPI,
      ...apiMocks,
    },
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

import UsageCleanupDialog from '../UsageCleanupDialog.vue'

const UiDialogStub = {
  name: 'UiDialog',
  props: ['show'],
  emits: ['close'],
  template: '<section v-if="show"><slot/><footer><slot name="footer"/></footer></section>',
}

const UiConfirmDialogStub = {
  name: 'UiConfirmDialog',
  props: ['show'],
  emits: ['confirm', 'cancel'],
  template: '<div v-if="show"><button data-confirm @click="$emit(\'confirm\')">confirm</button></div>',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function mountDialog() {
  return mount(UsageCleanupDialog, {
    props: {
      show: false,
      filters: {},
      startDate: '2026-08-01T00:00:00Z',
      endDate: '2026-08-02T00:00:00Z',
    },
    global: {
      stubs: {
        UsageFilters: true,
        UiDialog: UiDialogStub,
        UiConfirmDialog: UiConfirmDialogStub,
        UiDataTable: true,
        UiMobileTableScroller: true,
        UiPagination: true,
        UiAlert: true,
        UiBadge: true,
        UiButton: true,
        UiIconButton: true,
        UiDataCell: true,
        UiEmptyState: true,
      },
    },
  })
}

describe('UsageCleanupDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    apiMocks.listCleanupTasks.mockReset().mockResolvedValue({
      items: [], total: 0, page: 1, page_size: 5,
    })
    apiMocks.createCleanupTask.mockReset().mockResolvedValue({})
    apiMocks.cancelCleanupTask.mockReset().mockResolvedValue({})
  })

  it('loads immediately, polls every ten seconds, and stops after close', async () => {
    const wrapper = mountDialog()
    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(apiMocks.listCleanupTasks).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10_000)
    expect(apiMocks.listCleanupTasks).toHaveBeenCalledTimes(2)

    await wrapper.setProps({ show: false })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(apiMocks.listCleanupTasks).toHaveBeenCalledTimes(2)
  })

  it('does not apply a late task response after the dialog closes', async () => {
    const pending = deferred<{ items: Array<{ id: number }>; total: number; page: number; page_size: number }>()
    apiMocks.listCleanupTasks.mockReturnValueOnce(pending.promise)
    const wrapper = mountDialog()

    await wrapper.setProps({ show: true })
    await wrapper.setProps({ show: false })
    pending.resolve({ items: [{ id: 99 }], total: 1, page: 1, page_size: 5 })
    await flushPromises()

    expect((wrapper.vm as any).tasks).toEqual([])
    expect((wrapper.vm as any).tasksLoading).toBe(false)
  })

  it('preserves request-type compatibility and omits inactive filters', async () => {
    const wrapper = mountDialog()
    await wrapper.setProps({ show: true })
    await flushPromises()
    const vm = wrapper.vm as any
    vm.localFilters = {
      user_id: 42,
      api_key_id: 0,
      account_id: undefined,
      group_id: -1,
      model: 'gpt-5',
      request_type: 'stream',
      billing_type: 0,
    }

    await vm.submitCleanup()
    await flushPromises()

    expect(apiMocks.createCleanupTask).toHaveBeenCalledWith(expect.objectContaining({
      start_date: '2026-08-01T00:00:00Z',
      end_date: '2026-08-02T00:00:00Z',
      user_id: 42,
      model: 'gpt-5',
      request_type: 'stream',
      stream: true,
      billing_type: 0,
    }))
    const payload = apiMocks.createCleanupTask.mock.calls[0][0]
    expect(payload).not.toHaveProperty('api_key_id')
    expect(payload).not.toHaveProperty('account_id')
    expect(payload).not.toHaveProperty('group_id')
  })
})
