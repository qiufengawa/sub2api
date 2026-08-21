import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import OpsSystemLogTable from '../OpsSystemLogTable.vue'
import enLocale from '@/i18n/locales/en'
import zhLocale from '@/i18n/locales/zh'

const mockListSystemLogs = vi.fn()
const mockCleanupSystemLogs = vi.fn()
const mockGetSystemLogSinkHealth = vi.fn()
const mockGetRuntimeLogConfig = vi.fn()
const mockResetRuntimeLogConfig = vi.fn()
const mockShowError = vi.fn()
const mockShowSuccess = vi.fn()

vi.mock('@/api/admin/ops', () => ({
  opsAPI: {
    listSystemLogs: (...args: any[]) => mockListSystemLogs(...args),
    cleanupSystemLogs: (...args: any[]) => mockCleanupSystemLogs(...args),
    getSystemLogSinkHealth: (...args: any[]) => mockGetSystemLogSinkHealth(...args),
    getRuntimeLogConfig: (...args: any[]) => mockGetRuntimeLogConfig(...args),
    resetRuntimeLogConfig: (...args: any[]) => mockResetRuntimeLogConfig(...args),
  },
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const SelectStub = defineComponent({
  name: 'SelectControlStub',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
  },
  emits: ['update:modelValue'],
  template: '<div class="select-stub" />',
})

const PaginationStub = defineComponent({
  name: 'PaginationStub',
  template: '<div class="pagination-stub" />',
})

const runtimeConfig = {
  level: 'info',
  enable_sampling: false,
  sampling_initial: 100,
  sampling_thereafter: 100,
  caller: true,
  stacktrace_level: 'error',
  retention_days: 30,
}

const sinkHealth = {
  queue_depth: 0,
  queue_capacity: 5000,
  dropped_count: 0,
  write_failed_count: 0,
  written_count: 1,
  avg_write_delay_ms: 0,
}

describe('OpsSystemLogTable host support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockListSystemLogs.mockResolvedValue({
      items: [
        {
          id: 1,
          created_at: '2026-07-14T00:10:01Z',
          host: 'api-node-1',
          level: 'warn',
          component: 'app',
          message: 'request failed',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    })
    mockCleanupSystemLogs.mockResolvedValue({ deleted: 1 })
    mockGetSystemLogSinkHealth.mockResolvedValue(sinkHealth)
    mockGetRuntimeLogConfig.mockResolvedValue(runtimeConfig)
    mockResetRuntimeLogConfig.mockResolvedValue(runtimeConfig)
  })

  it('renders the host and sends it with list and cleanup filters', async () => {
    const wrapper = mount(OpsSystemLogTable, {
      global: {
        stubs: {
          Select: SelectStub,
          Pagination: PaginationStub,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('api-node-1')
    expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toContain('admin.ops.systemLogs.queue')

    const advancedFiltersButton = wrapper.findAll('button').find((button) =>
      button.text().includes('admin.ops.systemLogs.advancedFilters')
    )
    expect(advancedFiltersButton).toBeDefined()
    expect(advancedFiltersButton!.attributes('aria-expanded')).toBe('false')
    expect(advancedFiltersButton!.attributes('aria-controls')).toBe('ops-system-log-advanced-filters')
    await advancedFiltersButton!.trigger('click')
    expect(advancedFiltersButton!.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#ops-system-log-advanced-filters')).toBeTruthy()

    const hostLabel = wrapper.findAll('label').find((label) => label.text() === 'admin.ops.systemLogs.host')
    expect(hostLabel).toBeDefined()
    await wrapper.get(`#${hostLabel!.attributes('for')}`).setValue(' api-node-2 ')

    const searchButton = wrapper.findAll('button').find((button) => button.text() === 'admin.ops.systemLogs.search')
    expect(searchButton).toBeDefined()
    await searchButton!.trigger('click')
    await flushPromises()

    expect(mockListSystemLogs).toHaveBeenLastCalledWith(expect.objectContaining({ host: 'api-node-2' }))

    const cleanupButton = wrapper.findAll('button').find((button) => button.text() === 'admin.ops.systemLogs.cleanCurrentFilters')
    expect(cleanupButton).toBeDefined()
    await cleanupButton!.trigger('click')
    expect(document.body.textContent).toContain('admin.ops.systemLogs.cleanupConfirm')
    const confirmButton = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '确认'
    )
    expect(confirmButton).toBeDefined()
    confirmButton!.click()
    await flushPromises()

    expect(mockCleanupSystemLogs).toHaveBeenCalledWith(expect.objectContaining({ host: 'api-node-2' }))
  })

  it('keeps runtime settings collapsed until explicitly opened', async () => {
    const wrapper = mount(OpsSystemLogTable, {
      global: {
        stubs: {
          Select: SelectStub,
          Pagination: PaginationStub,
        },
      },
    })
    await flushPromises()

    const runtimeButton = wrapper.findAll('button').find((button) =>
      button.text().includes('admin.ops.systemLogs.runtimeConfigShort')
    )
    expect(runtimeButton).toBeDefined()
    expect(runtimeButton!.attributes('aria-expanded')).toBe('false')
    expect(runtimeButton!.attributes('aria-controls')).toBe('ops-system-log-runtime-config')
    expect(wrapper.text()).not.toContain('admin.ops.systemLogs.samplingInitial')

    await runtimeButton!.trigger('click')

    expect(runtimeButton!.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('#ops-system-log-runtime-config')).toBeTruthy()
    expect(wrapper.text()).toContain('admin.ops.systemLogs.samplingInitial')
  })

  it('keeps the cleanup confirmation open after a failed mutation so it can be retried', async () => {
    mockCleanupSystemLogs
      .mockRejectedValueOnce(new Error('temporary cleanup failure'))
      .mockResolvedValueOnce({ deleted: 2 })

    const wrapper = mount(OpsSystemLogTable, {
      global: {
        stubs: {
          Select: SelectStub,
          Pagination: PaginationStub,
        },
      },
    })
    await flushPromises()

    const cleanupButton = wrapper.findAll('button').find((button) =>
      button.text() === 'admin.ops.systemLogs.cleanCurrentFilters'
    )
    expect(cleanupButton).toBeDefined()
    await cleanupButton!.trigger('click')
    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    const confirm = Array.from(dialog!.querySelectorAll('button')).find((button) => button.textContent?.trim() === '确认')
    expect(confirm).toBeDefined()
    confirm!.click()
    await flushPromises()

    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()
    expect(mockShowError).toHaveBeenCalled()

    const retry = Array.from(document.body.querySelector('[role="dialog"]')!.querySelectorAll('button')).find((button) => button.textContent?.trim() === '确认')
    expect(retry).toBeDefined()
    retry!.click()
    await flushPromises()

    expect(mockCleanupSystemLogs).toHaveBeenCalledTimes(2)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('locks cleanup confirmation controls while the mutation is pending', async () => {
    let resolveCleanup!: (value: { deleted: number }) => void
    mockCleanupSystemLogs.mockImplementationOnce(() => new Promise((resolve) => {
      resolveCleanup = resolve
    }))

    const wrapper = mount(OpsSystemLogTable, {
      global: {
        stubs: {
          Select: SelectStub,
          Pagination: PaginationStub,
        },
      },
    })
    await flushPromises()

    const cleanupButton = wrapper.findAll('button').find((button) =>
      button.text() === 'admin.ops.systemLogs.cleanCurrentFilters'
    )
    expect(cleanupButton).toBeDefined()
    await cleanupButton!.trigger('click')
    let dialog = document.body.querySelector('[role="dialog"]')!
    const buttons = Array.from(dialog.querySelectorAll('button'))
    const confirm = buttons.find((button) => button.textContent?.trim() === '确认')!
    confirm.click()
    confirm.click()
    await nextTick()

    expect(mockCleanupSystemLogs).toHaveBeenCalledTimes(1)
    dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.querySelector('button.ui-button--danger')?.hasAttribute('disabled')).toBe(true)
    expect(Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.trim() === '取消')?.hasAttribute('disabled')).toBe(true)

    resolveCleanup({ deleted: 1 })
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it('keeps the runtime reset confirmation open after a failed mutation', async () => {
    document.body.querySelectorAll('.ui-dialog__overlay').forEach((node) => node.remove())
    mockResetRuntimeLogConfig
      .mockRejectedValueOnce(new Error('temporary reset failure'))
      .mockResolvedValueOnce(runtimeConfig)

    const wrapper = mount(OpsSystemLogTable, {
      global: {
        stubs: {
          Select: SelectStub,
          Pagination: PaginationStub,
        },
      },
    })
    await flushPromises()

    const runtimeButton = wrapper.findAll('button').find((button) =>
      button.text().includes('admin.ops.systemLogs.runtimeConfigShort')
    )
    expect(runtimeButton).toBeDefined()
    await runtimeButton!.trigger('click')
    const resetButton = wrapper.findAll('button').find((button) =>
      button.text() === 'admin.ops.systemLogs.resetDefaults'
    )
    expect(resetButton).toBeDefined()
    await resetButton!.trigger('click')
    let dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    let confirm = Array.from(dialog!.querySelectorAll('button')).find((button) => button.textContent?.trim() === '确认')
    expect(confirm).toBeDefined()
    confirm!.click()
    await flushPromises()
    await nextTick()

    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()

    dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    confirm = Array.from(dialog!.querySelectorAll('button')).find((button) => button.textContent?.trim() === '确认')
    expect(confirm).toBeDefined()
    confirm!.click()
    await flushPromises()

    expect(mockResetRuntimeLogConfig).toHaveBeenCalledTimes(2)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    wrapper.unmount()
  })

  it.each([
    ['zh', zhLocale],
    ['en', enLocale],
  ])('defines the Host translation for %s', (_name, locale) => {
    expect(locale.admin.ops.systemLogs.host).toBe('Host')
  })
})
