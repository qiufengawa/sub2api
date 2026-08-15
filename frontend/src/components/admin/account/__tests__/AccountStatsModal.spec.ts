import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, AccountUsageStatsResponse } from '@/types'

const { getStatsMock } = vi.hoisted(() => ({
  getStatsMock: vi.fn()
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    accounts: { getStats: getStatsMock }
  }
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${Object.values(params).join(',')}` : key
    })
  }
})

vi.mock('vue-chartjs', () => ({ Line: defineComponent({ template: '<div data-testid="line-chart" />' }) }))

import AccountStatsModal from '../AccountStatsModal.vue'

const UiDialogStub = defineComponent({
  props: { show: Boolean },
  emits: ['close'],
  template: '<div v-if="show"><slot /><slot name="footer" /></div>'
})

function makeAccount(id: number, name: string): Account {
  return {
    id,
    name,
    platform: 'openai',
    type: 'apikey',
    status: 'active'
  } as Account
}

function makeStats(totalCost: number): AccountUsageStatsResponse {
  return {
    history: [
      {
        date: '2026-08-15',
        label: '08-15',
        requests: 10,
        tokens: 100,
        cost: totalCost,
        actual_cost: totalCost,
        user_cost: totalCost * 2
      }
    ],
    summary: {
      days: 30,
      actual_days_used: 1,
      total_cost: totalCost,
      total_user_cost: totalCost * 2,
      total_standard_cost: totalCost * 3,
      total_requests: 10,
      total_tokens: 100,
      avg_daily_cost: totalCost,
      avg_daily_user_cost: totalCost * 2,
      avg_daily_requests: 10,
      avg_daily_tokens: 100,
      avg_duration_ms: 250,
      today: {
        date: '2026-08-15',
        cost: totalCost,
        user_cost: totalCost * 2,
        requests: 10,
        tokens: 100
      },
      highest_cost_day: {
        date: '2026-08-15',
        label: '08-15',
        cost: totalCost,
        user_cost: totalCost * 2,
        requests: 10
      },
      highest_request_day: {
        date: '2026-08-15',
        label: '08-15',
        requests: 10,
        cost: totalCost,
        user_cost: totalCost * 2
      }
    },
    models: [],
    endpoints: [],
    upstream_endpoints: []
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function mountModal(account = makeAccount(1, 'Account A')) {
  return mount(AccountStatsModal, {
    props: { show: true, account },
    global: {
      stubs: {
        UiDialog: UiDialogStub,
        ModelDistributionChart: true,
        EndpointDistributionChart: true
      }
    }
  })
}

describe('AccountStatsModal', () => {
  beforeEach(() => {
    getStatsMock.mockReset()
  })

  it('loads the selected account and renders the complete 30-day summary', async () => {
    getStatsMock.mockResolvedValue(makeStats(12))
    const wrapper = mountModal()
    await flushPromises()

    expect(getStatsMock).toHaveBeenCalledWith(1, 30)
    expect(wrapper.text()).toContain('Account A')
    expect(wrapper.text()).toContain('$12.00')
    expect(wrapper.text()).toContain('admin.accounts.stats.todayOverview')
    expect(wrapper.find('[data-testid="line-chart"]').exists()).toBe(true)
  })

  it('distinguishes load failure from empty data and retries the same account', async () => {
    getStatsMock
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(makeStats(3))

    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toContain('network unavailable')
    expect(wrapper.text()).not.toContain('admin.accounts.stats.noData')

    const retry = wrapper.findAll('button').find(button => button.text() === 'common.retry')
    expect(retry).toBeDefined()
    await retry?.trigger('click')
    await flushPromises()
    expect(getStatsMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('$3.00')
  })

  it('ignores a stale response after switching accounts', async () => {
    const accountA = deferred<AccountUsageStatsResponse>()
    const accountB = deferred<AccountUsageStatsResponse>()
    getStatsMock.mockReturnValueOnce(accountA.promise).mockReturnValueOnce(accountB.promise)

    const wrapper = mountModal()
    await wrapper.setProps({ account: makeAccount(2, 'Account B') })
    accountB.resolve(makeStats(2))
    await flushPromises()
    expect(wrapper.text()).toContain('Account B')
    expect(wrapper.text()).toContain('$2.00')

    accountA.resolve(makeStats(99))
    await flushPromises()
    expect(wrapper.text()).toContain('$2.00')
    expect(wrapper.text()).not.toContain('$99.00')
  })
})
