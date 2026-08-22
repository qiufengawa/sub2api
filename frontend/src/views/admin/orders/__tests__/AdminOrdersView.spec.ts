import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminOrdersView from '../AdminOrdersView.vue'
import type { PaymentOrder } from '@/types/payment'

const { getOrders, getOrder, cancelOrder, retryRecharge, refundOrder, queryRefund } = vi.hoisted(() => ({
  getOrders: vi.fn(),
  getOrder: vi.fn(),
  cancelOrder: vi.fn(),
  retryRecharge: vi.fn(),
  refundOrder: vi.fn(),
  queryRefund: vi.fn(),
}))

vi.mock('@/api/admin/payment', () => {
  const api = {
    getOrders,
    getOrder,
    cancelOrder,
    retryRecharge,
    refundOrder,
    queryRefund,
  }
  return { default: api, adminPaymentAPI: api }
})

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const order: PaymentOrder = {
  id: 1,
  user_id: 10,
  amount: 10,
  pay_amount: 10,
  currency: 'USD',
  fee_rate: 0,
  payment_type: 'stripe',
  out_trade_no: 'order-1',
  status: 'COMPLETED',
  order_type: 'balance',
  created_at: '2026-06-25T10:00:00Z',
  expires_at: '2026-06-25T10:30:00Z',
  refund_amount: 0,
}

const UiServerTableWorkspaceStub = {
  props: ['loading', 'empty'],
  template: '<section><slot name="filters"/><slot/><slot name="pagination"/></section>',
}

const UiSearchInputStub = {
  props: ['modelValue'],
  emits: ['update:modelValue', 'search'],
  template: '<input data-testid="order-search" :value="modelValue" @input="emit(\'update:modelValue\', $event.target.value); emit(\'search\', $event.target.value)" />',
  setup(_, { emit }: { emit: (event: string, value: string) => void }) { return { emit } },
}

const UiSelectStub = {
  props: ['modelValue', 'options'],
  emits: ['update:modelValue', 'change'],
  template: '<select :value="modelValue" @change="emit(\'update:modelValue\', $event.target.value); emit(\'change\', $event.target.value)"><option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select>',
  setup(_, { emit }: { emit: (event: string, value: string) => void }) { return { emit } },
}

const UiPaginationStub = {
  props: ['page', 'pageSize', 'total'],
  emits: ['update:page', 'update:page-size'],
  template: '<button data-testid="page-size" @click="emit(\'update:page-size\', 50)">page size</button>',
  setup(_, { emit }: { emit: (event: string, value: number) => void }) { return { emit } },
}

describe('AdminOrdersView', () => {
  beforeEach(() => {
    getOrders.mockReset()
    getOrder.mockReset()
    cancelOrder.mockReset()
    retryRecharge.mockReset()
    refundOrder.mockReset()
    queryRefund.mockReset()
    getOrders.mockResolvedValue({ data: { items: [order], total: 1 } })
    getOrder.mockResolvedValue({ data: { order, auditLogs: [] } })
  })

  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => { resolve = done })
    return { promise, resolve }
  }

  function mountView() {
    return mount(AdminOrdersView, {
      global: {
        plugins: [createPinia()],
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          AppPage: { template: '<main><slot /></main>' },
          AppPageHeader: { template: '<header><slot /></header>' },
          AppSection: { template: '<section><slot /></section>' },
          AppStack: { template: '<div><slot /></div>' },
          UiServerTableWorkspace: UiServerTableWorkspaceStub,
          UiSearchInput: UiSearchInputStub,
          UiSelect: UiSelectStub,
          UiPagination: UiPaginationStub,
          UiButton: { template: '<button><slot name="icon"/><slot /></button>' },
          UiIconButton: { template: '<button><slot /></button>' },
          UiBadge: { template: '<span><slot /></span>' },
          UiAlert: { template: '<div role="alert"><slot /></div>' },
          UiDescriptionList: { template: '<dl><slot /></dl>' },
          UiDialog: { props: ['show'], template: '<div v-if="show"><slot /><slot name="footer" /></div>' },
          UiTimeline: { template: '<ol />' },
          OrderTable: {
            props: ['orders'],
            template: '<div data-testid="order-rows">{{ orders.map(order => order.id).join(",") }}<slot name="actions" :row="{}" /></div>',
          },
          AdminRefundDialog: true,
          OrderStatusBadge: true,
          Icon: true,
        },
      },
    })
  }

  it('loads the first page and preserves filters in the request', async () => {
    mountView()
    await flushPromises()

    expect(getOrders).toHaveBeenCalledTimes(1)
    expect(getOrders).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      page_size: 20,
      status: undefined,
    }))
  })

  it('surfaces a retryable detail error while retaining the cached order row', async () => {
    const wrapper = mountView()
    await flushPromises()
    getOrder.mockRejectedValueOnce(new Error('detail unavailable'))

    await (wrapper.vm as any).showOrderDetail(order)
    await flushPromises()

    expect((wrapper.vm as any).orderDetailError).toContain('detail unavailable')
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="order-detail-grid"]')).toBeTruthy()
    wrapper.unmount()
  })

  it('associates the advanced filter toggle with a persistent filter region', async () => {
    const wrapper = mountView()
    await flushPromises()

    const toggle = wrapper.get('[data-testid="admin-orders-advanced-toggle"]')
    expect(toggle.attributes('aria-controls')).toBe('admin-orders-advanced-filters')
    expect(wrapper.get('#admin-orders-advanced-filters').exists()).toBe(true)
  })

  it('reloads once when page size changes', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="page-size"]').trigger('click')
    await flushPromises()

    expect(getOrders).toHaveBeenCalledTimes(2)
    expect(getOrders).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, page_size: 50 }))
  })

  it('uses the shared search input event without a second page-local debounce', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('[data-testid="order-search"]').setValue('order-1')
    await flushPromises()

    expect(getOrders).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: 'order-1' }))
  })

  it('does not let an older list response replace newer search results', async () => {
    let resolveInitial: ((value: { data: { items: PaymentOrder[]; total: number } }) => void) | undefined
    getOrders
      .mockReturnValueOnce(new Promise(resolve => { resolveInitial = resolve }))
      .mockResolvedValueOnce({ data: { items: [{ ...order, id: 7 }], total: 1 } })
    const wrapper = mountView()
    await vi.waitFor(() => expect(getOrders).toHaveBeenCalledTimes(1))

    await wrapper.get('[data-testid="order-search"]').setValue('newer')
    await vi.waitFor(() => expect(getOrders).toHaveBeenCalledTimes(2))
    resolveInitial?.({ data: { items: [{ ...order, id: 2 }], total: 1 } })
    await flushPromises()

    expect(wrapper.get('[data-testid="order-rows"]').text()).toContain('7')
    expect(wrapper.get('[data-testid="order-rows"]').text()).not.toContain('2')
  })

  it('prevents duplicate cancel and retry mutations per order', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      handleCancelOrder: (value: PaymentOrder) => Promise<void>
      handleRetryOrder: (value: PaymentOrder) => Promise<void>
    }

    const cancelPending = deferred<void>()
    cancelOrder.mockReturnValueOnce(cancelPending.promise)
    const firstCancel = vm.handleCancelOrder({ ...order, status: 'PENDING' })
    const secondCancel = vm.handleCancelOrder({ ...order, status: 'PENDING' })
    await flushPromises()
    expect(cancelOrder).toHaveBeenCalledTimes(1)
    cancelPending.resolve()
    await Promise.all([firstCancel, secondCancel])

    const retryPending = deferred<void>()
    retryRecharge.mockReturnValueOnce(retryPending.promise)
    const firstRetry = vm.handleRetryOrder({ ...order, status: 'FAILED' })
    const secondRetry = vm.handleRetryOrder({ ...order, status: 'FAILED' })
    await flushPromises()
    expect(retryRecharge).toHaveBeenCalledTimes(1)
    retryPending.resolve()
    await Promise.all([firstRetry, secondRetry])
  })

  it('prevents duplicate refund submission and status queries', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      openRefundDialog: (value: PaymentOrder) => void
      handleRefund: (data: { amount: number; reason: string; deduct_balance: boolean; force: boolean }) => Promise<void>
      handleQueryRefund: (value: PaymentOrder) => Promise<void>
    }
    const refundData = { amount: 10, reason: 'duplicate guard', deduct_balance: true, force: false }
    vm.openRefundDialog(order)
    const refundPending = deferred<{ data: { success: boolean } }>()
    refundOrder.mockReturnValueOnce(refundPending.promise)

    const firstRefund = vm.handleRefund(refundData)
    const secondRefund = vm.handleRefund(refundData)
    await flushPromises()
    expect(refundOrder).toHaveBeenCalledTimes(1)
    refundPending.resolve({ data: { success: true } })
    await Promise.all([firstRefund, secondRefund])

    const queryPending = deferred<{ data: { success: boolean } }>()
    queryRefund.mockReturnValueOnce(queryPending.promise)
    const pendingOrder = { ...order, status: 'REFUND_PENDING' as const }
    const firstQuery = vm.handleQueryRefund(pendingOrder)
    const secondQuery = vm.handleQueryRefund(pendingOrder)
    await flushPromises()
    expect(queryRefund).toHaveBeenCalledTimes(1)
    queryPending.resolve({ data: { success: true } })
    await Promise.all([firstQuery, secondQuery])
  })

  it('does not close the refund dialog while the refund request is pending', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      openRefundDialog: (value: PaymentOrder) => void
      handleRefund: (data: { amount: number; reason: string; deduct_balance: boolean; force: boolean }) => Promise<void>
      closeRefundDialog: () => void
      showRefundDialog: boolean
      refundSubmitting: boolean
    }
    vm.openRefundDialog(order)

    let resolveRefund!: (value: { data: { success: boolean; warning?: string } }) => void
    refundOrder.mockReturnValueOnce(new Promise(resolve => { resolveRefund = resolve }))
    const request = vm.handleRefund({ amount: 10, reason: 'pending close guard', deduct_balance: true, force: false })
    await flushPromises()

    expect(vm.refundSubmitting).toBe(true)
    vm.closeRefundDialog()
    expect(vm.showRefundDialog).toBe(true)

    resolveRefund({ data: { success: false, warning: 'fixture failure' } })
    await request
    expect(vm.refundSubmitting).toBe(false)
    vm.closeRefundDialog()
    expect(vm.showRefundDialog).toBe(false)
  })

  it('keeps a pending refund target stable and ignores a late replacement target', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      openRefundDialog: (value: PaymentOrder) => void
      handleRefund: (data: { amount: number; reason: string; deduct_balance: boolean; force: boolean }) => Promise<void>
      selectedOrder: PaymentOrder | null
      showRefundDialog: boolean
    }
    const secondOrder = { ...order, id: 2, out_trade_no: 'order-2' }
    vm.openRefundDialog(order)
    const refundPending = deferred<{ data: { success: boolean } }>()
    refundOrder.mockReturnValueOnce(refundPending.promise)

    const firstRefund = vm.handleRefund({ amount: 10, reason: 'first', deduct_balance: true, force: false })
    vm.openRefundDialog(secondOrder)
    expect(vm.selectedOrder?.id).toBe(order.id)
    vm.selectedOrder = secondOrder

    refundPending.resolve({ data: { success: true } })
    await firstRefund
    await flushPromises()
    expect(vm.showRefundDialog).toBe(true)
  })
})
