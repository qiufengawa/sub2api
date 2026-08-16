import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import type { DashboardStats } from '@/types'
import DashboardView from '../DashboardView.vue'

const { getSnapshotV2, getUserUsageTrend, getUserSpendingRanking, showError } = vi.hoisted(() => ({
  getSnapshotV2: vi.fn(),
  getUserUsageTrend: vi.fn(),
  getUserSpendingRanking: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    dashboard: {
      getSnapshotV2,
      getUserUsageTrend,
      getUserSpendingRanking
    }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError
  })
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn() })
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const createDashboardStats = (): DashboardStats => ({
  total_users: 0,
  today_new_users: 0,
  active_users: 0,
  hourly_active_users: 0,
  stats_updated_at: '',
  stats_stale: false,
  total_api_keys: 0,
  active_api_keys: 0,
  total_accounts: 0,
  normal_accounts: 0,
  error_accounts: 0,
  ratelimit_accounts: 0,
  overload_accounts: 0,
  total_requests: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_cache_creation_tokens: 0,
  total_cache_read_tokens: 0,
  total_tokens: 0,
  total_cost: 0,
  total_actual_cost: 0,
  today_requests: 0,
  today_input_tokens: 0,
  today_output_tokens: 0,
  today_cache_creation_tokens: 0,
  today_cache_read_tokens: 0,
  today_tokens: 0,
  today_cost: 0,
  today_actual_cost: 0,
  average_duration_ms: 0,
  uptime: 0,
  rpm: 0,
  tpm: 0
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function mountView() {
  return mount(DashboardView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        RouterLink: {
          props: ['to'],
          template: '<a :data-to="String(to)"><slot /></a>'
        },
        Icon: true,
        UiDateRangePicker: true,
        UiSelect: true,
        ModelDistributionChart: true,
        TokenUsageTrend: true,
        Line: true
      }
    }
  })
}

describe('admin DashboardView', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    setActivePinia(createPinia())

    getSnapshotV2.mockReset()
    getUserUsageTrend.mockReset()
    getUserSpendingRanking.mockReset()
    showError.mockReset()

    getSnapshotV2.mockResolvedValue({
      stats: createDashboardStats(),
      trend: [],
      models: []
    })
    getUserUsageTrend.mockResolvedValue({
      trend: [],
      start_date: '',
      end_date: '',
      granularity: 'hour'
    })
    getUserSpendingRanking.mockResolvedValue({
      ranking: [],
      total_actual_cost: 0,
      total_requests: 0,
      total_tokens: 0,
      start_date: '',
      end_date: ''
    })
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('uses last 24 hours as default dashboard range', async () => {
    const wrapper = mountView()

    await flushPromises()

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    expect(getSnapshotV2).toHaveBeenCalledTimes(1)
    expect(getSnapshotV2).toHaveBeenCalledWith(expect.objectContaining({
      start_date: formatLocalDate(yesterday),
      end_date: formatLocalDate(now),
      granularity: 'hour'
    }))
    expect(wrapper.find('[data-to="/admin/groups"]').exists()).toBe(true)
  })

  it('shows a persistent retry state when the initial snapshot fails', async () => {
    getSnapshotV2.mockRejectedValueOnce(new Error('snapshot failed'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="dashboard-error"]').text()).toContain('admin.dashboard.failedToLoad')
    expect(showError).toHaveBeenCalledWith('admin.dashboard.failedToLoad')
    expect(consoleError).toHaveBeenCalledOnce()

    getSnapshotV2.mockResolvedValueOnce({ stats: createDashboardStats(), trend: [], models: [] })
    await wrapper.get('[data-testid="dashboard-error"] button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="dashboard-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-to="/admin/groups"]').exists()).toBe(true)
  })

  it('keeps existing statistics visible and reports a refresh failure inline', async () => {
    const wrapper = mountView()
    await flushPromises()
    getSnapshotV2.mockRejectedValueOnce(new Error('refresh failed'))

    await (wrapper.vm as any).loadDashboardStats()
    await flushPromises()

    expect(wrapper.find('[data-testid="dashboard-error"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('admin.dashboard.failedToLoad')
    expect(wrapper.find('[data-to="/admin/groups"]').exists()).toBe(true)
    expect(consoleError).toHaveBeenCalledOnce()
  })

  it('does not let an older failed refresh replace a newer successful snapshot', async () => {
    const wrapper = mountView()
    await flushPromises()
    const older = deferred<Awaited<ReturnType<typeof getSnapshotV2>>>()
    const newerStats = { ...createDashboardStats(), total_users: 42 }
    getSnapshotV2.mockReset()
      .mockImplementationOnce(() => older.promise)
      .mockResolvedValueOnce({ stats: newerStats, trend: [], models: [] })

    const olderLoad = (wrapper.vm as any).loadDashboardStats()
    const newerLoad = (wrapper.vm as any).loadDashboardStats()
    await newerLoad
    older.reject(new Error('stale failure'))
    await olderLoad
    await flushPromises()

    expect((wrapper.vm as any).stats.total_users).toBe(42)
    expect((wrapper.vm as any).snapshotError).toBe(false)
  })
})
