import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminOrdersView from '../AdminOrdersView.vue'
import type { PaymentOrder } from '@/types/payment'

const { getOrders } = vi.hoisted(() => ({ getOrders: vi.fn() }))

vi.mock('@/api/admin/payment', () => {
  const api = {
    getOrders,
    getOrder: vi.fn(),
    cancelOrder: vi.fn(),
    retryRecharge: vi.fn(),
    refundOrder: vi.fn(),
    queryRefund: vi.fn(),
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
    getOrders.mockResolvedValue({ data: { items: [order], total: 1 } })
  })

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
          UiDescriptionList: { template: '<dl><slot /></dl>' },
          UiDialog: { props: ['show'], template: '<div v-if="show"><slot /><slot name="footer" /></div>' },
          UiTimeline: { template: '<ol />' },
          OrderTable: { template: '<div><slot name="actions" :row="{}" /></div>' },
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
})
