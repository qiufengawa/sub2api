import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import UserOrdersView from '../UserOrdersView.vue'
import type { PaymentOrder } from '@/types/payment'

const { getMyOrders, getOrder, getRefundEligibleProviders, requestRefund, showError } = vi.hoisted(() => ({
  getMyOrders: vi.fn(),
  getOrder: vi.fn(),
  getRefundEligibleProviders: vi.fn(),
  requestRefund: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('@/api/payment', () => ({
  paymentAPI: {
    getMyOrders,
    getOrder,
    getRefundEligibleProviders,
    cancelOrder: vi.fn(),
    requestRefund,
  },
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({ showError, showSuccess: vi.fn() }),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const order: PaymentOrder = {
  id: 1,
  user_id: 8,
  amount: 12,
  pay_amount: 12,
  currency: 'USD',
  fee_rate: 0,
  payment_type: 'stripe',
  out_trade_no: 'order-1',
  status: 'COMPLETED',
  order_type: 'balance',
  created_at: '2026-08-01T10:00:00Z',
  expires_at: '2026-08-01T10:30:00Z',
  completed_at: '2026-08-01T10:02:00Z',
  refund_amount: 0,
}

const tableWorkspace = {
  props: ['loading', 'empty'],
  template: '<section><slot name="filters"/><slot/><slot name="pagination"/></section>',
}

const selectStub = {
  props: ['modelValue', 'options'],
  emits: ['update:modelValue'],
  template: '<select data-testid="status-filter" :value="modelValue" @change="emit(\'update:modelValue\', $event.target.value)"><option v-for="option in options" :key="String(option.value)" :value="option.value">{{ option.label }}</option></select>',
  setup(_: unknown, { emit }: { emit: (event: string, value: string) => void }) { return { emit } },
}

function mountView() {
  return mount(UserOrdersView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        AppPage: { template: '<main><slot /></main>' },
        AppPageHeader: { template: '<header><slot /></header>' },
        UiServerTableWorkspace: tableWorkspace,
        UiSelect: selectStub,
        UiBadge: { template: '<span><slot /></span>' },
        UiIconButton: { template: '<button><slot /></button>' },
        UiButton: { template: '<button><slot name="icon"/><slot /></button>' },
        UiPagination: { template: '<nav />' },
        UiErrorState: { props: ['title'], template: '<div data-testid="orders-error">{{ title }}</div>' },
        UiSkeleton: { template: '<div data-testid="orders-skeleton" />' },
        UiConfirmDialog: true,
        UiDialog: { props: ['show'], template: '<div v-if="show"><slot /><slot name="footer" /></div>' },
        UiTextArea: true,
        UiDescriptionList: { template: '<dl />' },
        UiTimeline: { template: '<ol data-testid="orders-timeline" />' },
        AppStack: { template: '<div><slot /></div>' },
        AppSection: { template: '<section><slot /></section>' },
        OrderStatusBadge: true,
        OrderTable: { props: ['orders'], template: '<div data-testid="order-table">{{ orders.length }}</div>' },
        Icon: true,
      },
    },
  })
}

describe('user UserOrdersView', () => {
  beforeEach(() => {
    getMyOrders.mockReset().mockResolvedValue({ data: { items: [order], total: 1 } })
    getOrder.mockReset().mockResolvedValue({ data: order })
    getRefundEligibleProviders.mockReset().mockResolvedValue({ data: { provider_instance_ids: [] } })
    requestRefund.mockReset()
    showError.mockReset()
  })

  it('loads the first page with the server query contract', async () => {
    mountView()
    await flushPromises()

    expect(getMyOrders).toHaveBeenCalledWith({ page: 1, page_size: 20, status: undefined })
  })

  it('resets to the first page when the status filter changes', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-testid="status-filter"]').setValue('PAID')
    await flushPromises()

    expect(getMyOrders).toHaveBeenLastCalledWith({ page: 1, page_size: 20, status: 'PAID' })
  })

  it('renders a persistent retry state for an initial request failure', async () => {
    getMyOrders.mockRejectedValueOnce(new Error('offline'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="orders-error"]').exists()).toBe(true)
    expect(showError).not.toHaveBeenCalled()
  })

  it('preserves stale rows and reports a refresh failure', async () => {
    const wrapper = mountView()
    await flushPromises()
    getMyOrders.mockRejectedValueOnce(new Error('offline'))
    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="order-table"]').text()).toBe('1')
    expect(showError).toHaveBeenCalled()
  })

  it('loads order detail without changing the list query contract', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as unknown as { showOrderDetail: (value: PaymentOrder) => void }
    vm.showOrderDetail(order)
    await flushPromises()

    expect(getOrder).toHaveBeenCalledWith(1)
  })

  it('prevents duplicate refund requests while the first submission is pending', async () => {
    let finishRefund!: () => void
    requestRefund.mockReturnValueOnce(new Promise<void>((resolve) => {
      finishRefund = resolve
    }))
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      refundReason: string
      openRefundDialog: (value: PaymentOrder) => void
      confirmRefund: () => Promise<void>
    }
    vm.openRefundDialog(order)
    vm.refundReason = 'duplicate submission guard'

    const first = vm.confirmRefund()
    const second = vm.confirmRefund()
    await flushPromises()

    expect(requestRefund).toHaveBeenCalledTimes(1)
    expect(requestRefund).toHaveBeenCalledWith(1, { reason: 'duplicate submission guard' })

    finishRefund()
    await Promise.all([first, second])
  })

  it('keeps a later refund context when an older request completes', async () => {
    let finishRefund!: () => void
    requestRefund.mockReturnValueOnce(new Promise<void>((resolve) => {
      finishRefund = resolve
    }))
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      actionLoading: boolean
      refundTarget: PaymentOrder | null
      refundReason: string
      openRefundDialog: (value: PaymentOrder) => void
      closeRefundDialog: () => void
      confirmRefund: () => Promise<void>
    }
    const secondOrder = { ...order, id: 2, out_trade_no: 'order-2' }
    vm.openRefundDialog(order)
    vm.refundReason = 'first order reason'

    const first = vm.confirmRefund()
    vm.closeRefundDialog()
    vm.openRefundDialog(secondOrder)
    expect(vm.refundTarget?.id).toBe(order.id)

    vm.refundTarget = secondOrder
    vm.refundReason = 'second order reason'
    finishRefund()
    await first
    await flushPromises()

    expect(requestRefund).toHaveBeenCalledWith(1, { reason: 'first order reason' })
    expect(vm.refundTarget?.id).toBe(2)
    expect(vm.refundReason).toBe('second order reason')
    expect(vm.actionLoading).toBe(false)
  })
})
