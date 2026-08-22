import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { PaymentOrder } from '@/types/payment'
import AdminOrderDetail from '../AdminOrderDetail.vue'
import AdminOrderTable from '../AdminOrderTable.vue'
import AdminRefundDialog from '../AdminRefundDialog.vue'
import OrderTable from '@/components/payment/OrderTable.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

const UiDialogStub = {
  props: ['show'],
  template: '<div v-if="show"><slot /><slot name="footer" /></div>',
}

const UiDialogPendingStub = {
  props: ['show', 'closeOnEscape', 'showCloseButton'],
  emits: ['close'],
  template: `<div v-if="show">
    <button v-if="showCloseButton" data-testid="dialog-close" type="button" @click="$emit('close')">close</button>
    <slot /><slot name="footer" />
  </div>`,
}

const DataTableStub = {
  props: ['data', 'columns', 'mobileTable'],
  template: `
    <div>
      <div v-for="row in data" :key="row.id">
        <slot name="cell-pay_amount" :value="row.pay_amount" :row="row" />
      </div>
    </div>
  `,
}

function orderFactory(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: 1,
    user_id: 10,
    amount: 100,
    pay_amount: 108,
    currency: 'USD',
    fee_rate: 8,
    payment_type: 'stripe',
    out_trade_no: 'sub2_202606250001',
    status: 'COMPLETED',
    order_type: 'subscription',
    created_at: '2026-06-25T10:00:00Z',
    expires_at: '2026-06-25T10:30:00Z',
    refund_amount: 25,
    ...overrides,
  }
}

describe('admin order currency display', () => {
  it('uses order currency for paid/base/fee amounts and USD for credited/refund amounts', () => {
    const wrapper = mount(AdminOrderDetail, {
      props: {
        show: true,
        order: orderFactory({ currency: 'CNY' }),
      },
      global: {
        stubs: {
          UiDialog: UiDialogStub,
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('¥100.00')
    expect(text).toContain('¥8.00')
    expect(text).toContain('¥108.00')
    expect(text).toContain('$100.00')
    expect(text).toContain('$25.00')
  })

  it('uses order currency for pay_amount and USD for refundable balance amounts', () => {
    const wrapper = mount(AdminRefundDialog, {
      props: {
        show: true,
        order: orderFactory({
          currency: 'USD',
          status: 'PARTIALLY_REFUNDED',
          refund_amount: 20,
        }),
        userBalance: 200,
      },
      global: {
        stubs: {
          UiDialog: UiDialogStub,
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('$108.00')
    expect(text).toContain('$100.00')
    expect(text).toContain('$20.00')
    expect(text).toContain('$80.00')
    expect(text).toContain('$200.00')
  })

  it('preserves refund request defaults and emits a numeric payload', async () => {
    const wrapper = mount(AdminRefundDialog, {
      props: {
        show: true,
        order: orderFactory({
          status: 'REFUND_REQUESTED',
          refund_amount: 24.5,
          refund_request_reason: 'Customer requested a refund',
        }),
      },
      global: { stubs: { UiDialog: UiDialogStub } },
    })

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    expect(wrapper.find('input[type="number"]').element).toHaveProperty('value', '24.5')
    expect(wrapper.text()).toContain('Customer requested a refund')

    await wrapper.find('input[type="number"]').setValue('12.25')
    await wrapper.find('textarea').setValue('Approved after review')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('confirm')).toEqual([[
      { amount: 12.25, reason: 'Approved after review', deduct_balance: true, force: false },
    ]])
  })

  it('blocks zero and over-limit refund submissions', async () => {
    const wrapper = mount(AdminRefundDialog, {
      props: {
        show: true,
        order: orderFactory({ status: 'PARTIALLY_REFUNDED', refund_amount: 80 }),
      },
      global: { stubs: { UiDialog: UiDialogStub } },
    })

    await wrapper.find('input[type="number"]').setValue('21')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('confirm')).toBeUndefined()

    await wrapper.find('input[type="number"]').setValue('0')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('resets the refund form when the open dialog receives a different order', async () => {
    const wrapper = mount(AdminRefundDialog, {
      props: {
        show: true,
        order: orderFactory({
          id: 1,
          status: 'REFUND_REQUESTED',
          refund_amount: 24.5,
          refund_request_reason: 'First order reason',
        }),
      },
      global: { stubs: { UiDialog: UiDialogStub } },
    })

    await wrapper.find('input[type="number"]').setValue('12.25')
    await wrapper.find('textarea').setValue('Edited first order')
    await wrapper.setProps({
      order: orderFactory({ id: 2, amount: 70, pay_amount: 70, status: 'COMPLETED', refund_amount: 0 }),
    })

    expect(wrapper.find('input[type="number"]').element).toHaveProperty('value', '70')
    expect(wrapper.find('textarea').element).toHaveProperty('value', '')
  })

  it('requires force confirmation when the backend requests it', async () => {
    const wrapper = mount(AdminRefundDialog, {
      props: {
        show: true,
        order: orderFactory(),
        requireForce: true,
        warning: 'Balance check required',
      },
      global: { stubs: { UiDialog: UiDialogStub } },
    })

    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('confirm')).toBeUndefined()

    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    expect(checkboxes).toHaveLength(2)
    await checkboxes[1].setValue(true)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('locks cancel and dialog close while a refund request is submitting', async () => {
    const wrapper = mount(AdminRefundDialog, {
      props: {
        show: true,
        order: orderFactory(),
        submitting: true,
      },
      global: { stubs: { UiDialog: UiDialogPendingStub } },
    })

    const dialog = wrapper.findComponent(UiDialogPendingStub)
    expect(dialog.props('closeOnEscape')).toBe(false)
    expect(dialog.props('showCloseButton')).toBe(false)

    const cancelButton = wrapper.findAll('button').find((node) => node.text() === 'common.cancel')
    expect(cancelButton).toBeDefined()
    expect(cancelButton?.attributes('disabled')).toBeDefined()
    await cancelButton?.trigger('click')
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.find('[data-testid="dialog-close"]').exists()).toBe(false)
  })

  it('renders payment currency consistently in the shared order table', () => {
    const wrapper = mount(OrderTable, {
      props: {
        orders: [
          orderFactory({ id: 1, currency: 'USD', amount: 100, pay_amount: 108 }),
          orderFactory({ id: 2, currency: 'CNY', amount: 100, pay_amount: 108 }),
        ],
        loading: false,
        showUser: true,
      },
      global: {
        stubs: {
          UiDataTable: DataTableStub,
          OrderStatusBadge: true,
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('$108.00')
    expect(text).toContain('¥108.00')
    expect(text).toContain('$100.00')
    expect(wrapper.findComponent(DataTableStub).props('columns')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'order_type' })])
    )
  })

  it('adds the order type column only when the user table requests it', () => {
    const wrapper = mount(OrderTable, {
      props: {
        orders: [orderFactory()],
        loading: false,
        showOrderType: true,
      },
      global: { stubs: { UiDataTable: DataTableStub, OrderStatusBadge: true } },
    })

    expect(wrapper.findComponent(DataTableStub).props('columns')).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'order_type' })])
    )
  })

  it('forwards the opt-in mobile table mode without changing the default', () => {
    const defaultWrapper = mount(OrderTable, {
      props: { orders: [orderFactory()], loading: false },
      global: { stubs: { UiDataTable: DataTableStub, OrderStatusBadge: true } },
    })
    const mobileWrapper = mount(OrderTable, {
      props: { orders: [orderFactory()], loading: false, mobileTable: true },
      global: { stubs: { UiDataTable: DataTableStub, OrderStatusBadge: true } },
    })

    expect(defaultWrapper.findComponent(DataTableStub).props('mobileTable')).toBe(false)
    expect(mobileWrapper.findComponent(DataTableStub).props('mobileTable')).toBe(true)
  })

  it('renders payment currency consistently in the admin order table', () => {
    const wrapper = mount(AdminOrderTable, {
      props: {
        orders: [
          orderFactory({ id: 1, currency: 'USD', amount: 100, pay_amount: 108 }),
          orderFactory({ id: 2, currency: 'CNY', amount: 100, pay_amount: 108 }),
        ],
        loading: false,
        page: 1,
        pageSize: 20,
        total: 2,
      },
      global: {
        stubs: {
          UiDataTable: DataTableStub,
          Icon: true,
          Pagination: true,
          Select: true,
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('$108.00')
    expect(text).toContain('¥108.00')
    expect(text).toContain('$100.00')
  })
})
