import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminAffiliateRecordsTable from '../AdminAffiliateRecordsTable.vue'

const {
  getUserOverview,
  listInviteRecords,
  listRebateRecords,
  listTransferRecords,
  showError,
} = vi.hoisted(() => ({
  getUserOverview: vi.fn(),
  listInviteRecords: vi.fn(),
  listRebateRecords: vi.fn(),
  listTransferRecords: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/admin/affiliates', () => {
  const api = {
    getUserOverview,
    listInviteRecords,
    listRebateRecords,
    listTransferRecords,
  }
  return { affiliatesAPI: api, default: api }
})

vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError }) }))

vi.mock('vue-i18n', async () => ({
  ...(await vi.importActual<typeof import('vue-i18n')>('vue-i18n')),
  useI18n: () => ({ t: (key: string) => key }),
}))

const invite = {
  inviter_id: 1,
  inviter_email: 'inviter@example.com',
  inviter_username: 'inviter',
  invitee_id: 2,
  invitee_email: 'invitee@example.com',
  invitee_username: 'invitee',
  aff_code: 'WELCOME',
  total_rebate: 12,
  created_at: '2026-08-15T00:00:00Z',
}

const rebate = {
  order_id: 8,
  out_trade_no: 'ORDER-8',
  inviter_id: 1,
  inviter_email: 'inviter@example.com',
  inviter_username: 'inviter',
  invitee_id: 2,
  invitee_email: 'invitee@example.com',
  invitee_username: 'invitee',
  order_amount: 20,
  pay_amount: 20,
  rebate_amount: 4,
  payment_type: 'stripe',
  order_status: 'COMPLETED',
  created_at: '2026-08-15T00:00:00Z',
}

const transfer = {
  ledger_id: 9,
  user_id: 1,
  user_email: 'user@example.com',
  username: 'user',
  amount: 5,
  balance_after: 15,
  available_quota_after: 4,
  frozen_quota_after: 0,
  history_quota_after: 25,
  snapshot_available: true,
  created_at: '2026-08-15T00:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function mountView(type: 'invites' | 'rebates' | 'transfers' = 'invites') {
  return mount(AdminAffiliateRecordsTable, {
    props: { type },
    global: {
      stubs: {
        AppLayout: { template: '<div><slot/></div>' },
        UiServerTableWorkspace: {
          template: '<section><slot name="toolbar"/><slot name="filters"/><slot/><slot name="pagination"/></section>',
        },
        UiDataTable: {
          props: ['data'],
          template: '<div><slot v-if="!data.length" name="empty"/></div>',
        },
        UiDialog: {
          props: ['show'],
          template: '<aside v-if="show"><slot/><slot name="footer"/></aside>',
        },
        UiErrorState: {
          inheritAttrs: false,
          props: ['title'],
          emits: ['retry'],
          template: '<div v-bind="$attrs">{{ title }}<button data-testid="retry" @click="$emit(\'retry\')">retry</button></div>',
        },
        UiDescriptionList: { props: ['items'], template: '<dl><div v-for="item in items" :key="item.label">{{ item.label }} {{ item.value }}</div></dl>' },
        OrderStatusBadge: true,
        UiPagination: true,
        Teleport: true,
      },
    },
  })
}

describe('AdminAffiliateRecordsTable', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const fn of [getUserOverview, listInviteRecords, listRebateRecords, listTransferRecords, showError]) fn.mockReset()
    listInviteRecords.mockResolvedValue({ items: [invite], total: 1 })
    listRebateRecords.mockResolvedValue({ items: [rebate], total: 1 })
    listTransferRecords.mockResolvedValue({ items: [transfer], total: 1 })
    getUserOverview.mockResolvedValue({
      user_id: 1,
      email: 'user@example.com',
      username: 'user',
      aff_code: 'WELCOME',
      rebate_rate_percent: 20,
      invited_count: 3,
      rebated_invitee_count: 2,
      available_quota: 4,
      history_quota: 25,
    })
  })

  it.each([
    ['invites', listInviteRecords, 'nav.affiliateInviteRecords', 'inviter'],
    ['rebates', listRebateRecords, 'nav.affiliateRebateRecords', 'order'],
    ['transfers', listTransferRecords, 'nav.affiliateTransferRecords', 'user'],
  ] as const)('loads the %s route with its own server columns', async (type, api, title, firstColumn) => {
    const wrapper = mountView(type)
    await flushPromises()

    expect(wrapper.get('main.app-page').classes()).toContain('app-page--compact')
    expect(wrapper.get('h1').text()).toBe(title)
    expect(api).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      page_size: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
      timezone: expect.any(String),
    }))
    expect((wrapper.vm as any).columns[0].key).toBe(firstColumn)
  })

  it('restores only a valid persisted server sort', async () => {
    localStorage.setItem('admin-affiliate-invites-table-sort', JSON.stringify({ key: 'total_rebate', order: 'asc' }))
    mountView('invites')
    await flushPromises()

    expect(listInviteRecords).toHaveBeenCalledWith(expect.objectContaining({
      sort_by: 'total_rebate',
      sort_order: 'asc',
    }))
  })

  it('blocks a reversed date range before issuing a request', async () => {
    const wrapper = mountView()
    await flushPromises()
    listInviteRecords.mockClear()
    const vm = wrapper.vm as any

    vm.filters.start_at = '2026-08-16'
    vm.filters.end_at = '2026-08-15'
    vm.reloadFromFirstPage()
    await flushPromises()

    expect(vm.dateRangeError).toBe('admin.affiliates.records.invalidDateRange')
    expect(listInviteRecords).not.toHaveBeenCalled()
  })

  it('does not let an older list response replace a newer filter result', async () => {
    const first = deferred<{ items: Array<typeof invite>; total: number }>()
    const second = deferred<{ items: Array<typeof invite>; total: number }>()
    listInviteRecords.mockReset()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const wrapper = mountView()
    const vm = wrapper.vm as any
    vm.filters.search = 'newer'
    vm.reloadFromFirstPage()
    second.resolve({ items: [{ ...invite, invitee_id: 22 }], total: 1 })
    await flushPromises()
    first.resolve({ items: [{ ...invite, invitee_id: 11 }], total: 1 })
    await flushPromises()

    expect(vm.records[0].invitee_id).toBe(22)
  })

  it('keeps overview failures visible and retries the same user', async () => {
    getUserOverview.mockRejectedValueOnce(new Error('overview failed'))
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any

    await vm.openUserOverview(7)
    await flushPromises()
    expect(vm.overviewDialog).toBe(true)
    expect(vm.overviewError).toBe(true)
    expect(wrapper.get('[data-testid="affiliate-overview-error"]').text()).toContain('admin.affiliates.overview.loadFailed')

    getUserOverview.mockResolvedValueOnce({
      user_id: 7,
      email: 'seven@example.com',
      username: 'seven',
      aff_code: 'SEVEN',
      rebate_rate_percent: 10,
      invited_count: 1,
      rebated_invitee_count: 1,
      available_quota: 2,
      history_quota: 3,
    })
    await wrapper.get('[data-testid="affiliate-overview-error"] [data-testid="retry"]').trigger('click')
    await flushPromises()
    expect(getUserOverview).toHaveBeenLastCalledWith(7)
    expect(vm.selectedOverview.user_id).toBe(7)
  })

  it('keeps list failures visible and retries the current query', async () => {
    listInviteRecords.mockRejectedValueOnce(new Error('list failed'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="affiliate-records-error"]').text()).toContain('admin.affiliates.errors.loadFailed')
    expect(showError).toHaveBeenCalledOnce()

    listInviteRecords.mockResolvedValueOnce({ items: [invite], total: 1 })
    await wrapper.get('[data-testid="affiliate-records-error"] [data-testid="retry"]').trigger('click')
    await flushPromises()

    expect(listInviteRecords).toHaveBeenCalledTimes(2)
    expect((wrapper.vm as any).loadError).toBe(false)
    expect((wrapper.vm as any).records).toEqual([invite])
  })

  it('ignores an overview response that arrives after the dialog closes', async () => {
    const pending = deferred<{
      user_id: number
      email: string
      username: string
      aff_code: string
      rebate_rate_percent: number
      invited_count: number
      rebated_invitee_count: number
      available_quota: number
      history_quota: number
    }>()
    getUserOverview.mockReturnValueOnce(pending.promise)
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any

    const request = vm.openUserOverview(7)
    vm.closeOverview()
    pending.resolve({
      user_id: 7,
      email: 'seven@example.com',
      username: 'seven',
      aff_code: 'SEVEN',
      rebate_rate_percent: 10,
      invited_count: 1,
      rebated_invitee_count: 1,
      available_quota: 2,
      history_quota: 3,
    })
    await request
    await flushPromises()

    expect(vm.overviewDialog).toBe(false)
    expect(vm.selectedOverview).toBeNull()
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('resets pagination once for page-size and sorting changes', async () => {
    const wrapper = mountView('transfers')
    await flushPromises()
    listTransferRecords.mockClear()
    const vm = wrapper.vm as any

    vm.pagination.page = 4
    vm.handlePageSizeChange(50)
    await flushPromises()
    expect(listTransferRecords).toHaveBeenCalledTimes(1)
    expect(listTransferRecords).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 50 }))

    listTransferRecords.mockClear()
    vm.handleSort('amount', 'asc')
    await flushPromises()
    expect(listTransferRecords).toHaveBeenCalledTimes(1)
    expect(listTransferRecords).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort_by: 'amount', sort_order: 'asc' }))
  })
})
