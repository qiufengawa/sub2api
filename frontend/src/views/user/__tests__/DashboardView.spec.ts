import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import DashboardView from '../DashboardView.vue'

const mocks = vi.hoisted(() => ({
  refreshUser: vi.fn(),
  fetchPublicSettings: vi.fn(),
  getDashboardStats: vi.fn(),
  getDashboardTrend: vi.fn(),
  getDashboardModels: vi.fn(),
  queryUsage: vi.fn(),
  listErrors: vi.fn(),
  getPlatformQuotas: vi.fn(),
  getSubscriptionSummary: vi.fn(),
}))

const authStore = reactive({
  user: {
    id: 2,
    username: 'test',
    email: 'test@example.com',
    role: 'user',
    balance: 20,
    frozen_balance: 0,
    status: 'active',
  },
  isSimpleMode: false,
  refreshUser: mocks.refreshUser,
})

const appStore = reactive({
  apiBaseUrl: 'https://api.example.com',
  docUrl: 'https://docs.example.com',
  cachedPublicSettings: {
    payment_enabled: false,
    allow_user_view_error_requests: false,
  },
  fetchPublicSettings: mocks.fetchPublicSettings,
})

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStore }))
vi.mock('@/stores/app', () => ({ useAppStore: () => appStore }))
vi.mock('@/api/usage', () => ({
  usageAPI: {
    getDashboardStats: mocks.getDashboardStats,
    getDashboardTrend: mocks.getDashboardTrend,
    getDashboardModels: mocks.getDashboardModels,
    query: mocks.queryUsage,
    listMyErrorRequests: mocks.listErrors,
  },
}))
vi.mock('@/api/user', () => ({ getMyPlatformQuotas: mocks.getPlatformQuotas }))
vi.mock('@/api/subscriptions', () => ({
  default: { getSubscriptionSummary: mocks.getSubscriptionSummary },
}))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const stats = (overrides: Record<string, number> = {}) => ({
  total_api_keys: 0,
  active_api_keys: 0,
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
  rpm: 0,
  tpm: 0,
  ...overrides,
})

const componentStub = (name: string) => ({
  name,
  inheritAttrs: false,
  template: `<div data-test="${name}"></div>`,
})
const gettingStartedStub = {
  name: 'UserDashboardGettingStarted',
  inheritAttrs: false,
  props: ['hasApiKey'],
  template: '<div data-test="getting-started" :data-has-key="String(hasApiKey)"></div>',
}

async function mountDashboard() {
  const wrapper = mount(DashboardView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        LoadingSpinner: true,
        Icon: true,
        RouterLink: { template: '<a><slot /></a>' },
        UserDashboardStats: componentStub('stats'),
        UserDashboardGettingStarted: gettingStartedStub,
        UserDashboardCharts: componentStub('charts'),
        UserDashboardQuickActions: componentStub('allowance'),
        UserDashboardModelBreakdown: componentStub('breakdown'),
        UserDashboardRecentUsage: componentStub('activity'),
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('user DashboardView stages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authStore.user.balance = 20
    authStore.user.status = 'active'
    appStore.cachedPublicSettings.allow_user_view_error_requests = false
    mocks.refreshUser.mockResolvedValue(undefined)
    mocks.fetchPublicSettings.mockResolvedValue(appStore.cachedPublicSettings)
    mocks.getDashboardTrend.mockResolvedValue({ trend: [] })
    mocks.getDashboardModels.mockResolvedValue({ models: [] })
    mocks.queryUsage.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 8, pages: 1 })
    mocks.getPlatformQuotas.mockResolvedValue({ platform_quotas: [] })
    mocks.getSubscriptionSummary.mockResolvedValue({ active_count: 0, total_used_usd: 0, subscriptions: [] })
  })

  it('shows onboarding instead of empty analytics when the user has no API key', async () => {
    mocks.getDashboardStats.mockResolvedValue(stats())
    const wrapper = await mountDashboard()

    expect(wrapper.find('[data-test="stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="getting-started"]').attributes('data-has-key')).toBe('false')
    expect(wrapper.find('[data-test="charts"]').exists()).toBe(false)
    expect(mocks.getDashboardModels).not.toHaveBeenCalled()
    expect(mocks.queryUsage).not.toHaveBeenCalled()
  })

  it('shows the first-request guide when a key exists without usage', async () => {
    mocks.getDashboardStats.mockResolvedValue(stats({ total_api_keys: 1, active_api_keys: 1 }))
    const wrapper = await mountDashboard()

    expect(wrapper.find('[data-test="getting-started"]').attributes('data-has-key')).toBe('true')
    expect(wrapper.find('[data-test="charts"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="breakdown"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="allowance"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="activity"]').exists()).toBe(false)
    expect(mocks.getDashboardModels).not.toHaveBeenCalled()
  })

  it('shows the complete analytics overview after the user has usage data', async () => {
    mocks.getDashboardStats.mockResolvedValue(stats({ total_api_keys: 2, active_api_keys: 2, total_requests: 12 }))
    const wrapper = await mountDashboard()

    expect(wrapper.find('[data-test="getting-started"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="charts"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="allowance"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="breakdown"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="activity"]').exists()).toBe(true)
    const contentGrid = wrapper.get('[data-testid="dashboard-content-grid"]')
    expect(contentGrid.classes()).toContain('xl:grid-cols-2')
    expect(contentGrid.element.children).toHaveLength(4)
    expect(Array.from(contentGrid.element.children).map((node) => (node as HTMLElement).dataset.test)).toEqual([
      'charts',
      'allowance',
      'breakdown',
      'activity',
    ])
    expect(mocks.getDashboardModels).toHaveBeenCalledTimes(1)
    expect(mocks.queryUsage).toHaveBeenCalledTimes(1)
  })

  it('shows an actionable balance warning for an abnormal account', async () => {
    authStore.user.balance = 0
    mocks.getDashboardStats.mockResolvedValue(stats({ total_api_keys: 1, active_api_keys: 1, total_requests: 3 }))
    const wrapper = await mountDashboard()

    expect(wrapper.text()).toContain('dashboard.overview.alertLowBalance')
    expect(wrapper.find('[data-test="charts"]').exists()).toBe(true)
  })
})
