import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import AccountsView from '../AccountsView.vue'

const { listAccounts, updateAccount, showError } = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  updateAccount: vi.fn(),
  showError: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: {
      list: listAccounts,
      listWithEtag: vi.fn().mockResolvedValue({ notModified: true, etag: null, data: null }),
      getBatchTodayStats: vi.fn().mockResolvedValue({ stats: {} }),
      getServiceStatus: vi.fn().mockResolvedValue({ enabled: true, accounts: {} }),
      getUpstreamBillingProbeSettings: vi.fn().mockResolvedValue({ enabled: true, interval_minutes: 30 }),
      update: updateAccount
    },
    proxies: { getAll: vi.fn().mockResolvedValue([]) },
    groups: { getAll: vi.fn().mockResolvedValue([]) }
  }
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess: vi.fn(), showInfo: vi.fn() })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ token: 'test-token' })
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const account = {
  id: 7,
  name: 'priority-account',
  platform: 'openai',
  type: 'apikey',
  status: 'active',
  schedulable: true,
  priority: 12,
  created_at: '2026-08-13T00:00:00Z',
  updated_at: '2026-08-13T00:00:00Z'
}

const DataTableStub = {
  props: ['data'],
  template: `
    <div>
      <div v-for="row in data" :key="row.id" data-test="priority-cell">
        <slot name="cell-priority" :row="row" :value="row.priority" />
      </div>
    </div>
  `
}

function mountView() {
  return mount(AccountsView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        TablePageLayout: { template: '<div><slot name="filters" /><slot name="table" /></div>' },
        DataTable: DataTableStub,
        Pagination: true,
        ConfirmDialog: true,
        AccountTableActions: { template: '<div><slot name="after" /></div>' },
        AccountTableFilters: true,
        AccountBulkActionsBar: true,
        AccountActionMenu: true,
        ImportDataModal: true,
        ReAuthAccountModal: true,
        AccountTestModal: true,
        AccountStatsModal: true,
        ScheduledTestsPanel: true,
        SyncFromCrsModal: true,
        TempUnschedStatusModal: true,
        ErrorPassthroughRulesModal: true,
        TLSFingerprintProfilesModal: true,
        CreateAccountModal: true,
        EditAccountModal: true,
        BulkEditAccountModal: true,
        PlatformTypeBadge: true,
        AccountCapacityCell: true,
        AccountStatusIndicator: true,
        AccountTodayStatsCell: true,
        AccountServiceStatusCell: true,
        AccountGroupsCell: true,
        AccountUsageCell: true,
        UpstreamBillingRateCell: true,
        HelpTooltip: true,
        Icon: true
      }
    }
  })
}

describe('admin AccountsView priority stepper', () => {
  beforeEach(() => {
    localStorage.clear()
    updateAccount.mockReset()
    showError.mockReset()
    listAccounts.mockResolvedValue({ items: [{ ...account }], total: 1, page: 1, page_size: 20, pages: 1 })
  })

  it('renders a neutral minus-input-plus control and saves step changes', async () => {
    updateAccount.mockResolvedValue({ ...account, priority: 13 })
    const wrapper = mountView()
    await flushPromises()

    const cell = wrapper.get('[data-test="priority-cell"]')
    expect(cell.get('input').element.value).toBe('12')
    const buttons = cell.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toBe('−')
    expect(buttons[1].text()).toBe('+')
    expect(cell.html()).not.toContain('primary-')

    await buttons[1].trigger('click')
    await flushPromises()

    expect(updateAccount).toHaveBeenCalledWith(7, { priority: 13 })
    expect(updateAccount).toHaveBeenCalledTimes(1)
    expect(cell.get('input').element.value).toBe('13')
  })

  it('disables the control while saving and keeps the server-confirmed value', async () => {
    let resolveUpdate!: (value: typeof account) => void
    updateAccount.mockReturnValue(new Promise((resolve) => { resolveUpdate = resolve }))
    const wrapper = mountView()
    await flushPromises()

    const cell = wrapper.get('[data-test="priority-cell"]')
    await cell.findAll('button')[1].trigger('click')
    await wrapper.vm.$nextTick()

    const stepper = cell.get('[aria-busy="true"]')
    expect(stepper.get('input').attributes('disabled')).toBeDefined()
    expect(stepper.findAll('button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)

    listAccounts.mockResolvedValue({
      items: [{ ...account, priority: 13 }],
      total: 1,
      page: 1,
      page_size: 20,
      pages: 1
    })
    resolveUpdate({ ...account, priority: 13 })
    await flushPromises()

    expect(cell.get('[aria-busy="false"]').exists()).toBe(true)
    expect(cell.get('input').element.value).toBe('13')
  })

  it('restores the prior value when saving fails', async () => {
    updateAccount.mockRejectedValue(new Error('save failed'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-test="priority-cell"] input').setValue('20')
    await wrapper.get('[data-test="priority-cell"] input').trigger('blur')
    await flushPromises()

    expect(updateAccount).toHaveBeenCalledWith(7, { priority: 20 })
    expect(wrapper.get('[data-test="priority-cell"] input').element.value).toBe('12')
    expect(showError).toHaveBeenCalledWith('save failed')
  })
})
