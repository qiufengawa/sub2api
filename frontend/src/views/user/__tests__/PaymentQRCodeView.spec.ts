import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import PaymentQRCodeView from '../PaymentQRCodeView.vue'

const pollOrderStatus = vi.fn().mockResolvedValue(null)
const push = vi.fn()
const routeQuery = {
  order_id: '42',
  pay_url: 'https://pay.example.test/order/42',
  payment_type: 'alipay',
  amount: '103',
  currency: 'CNY',
  expires_at: '2099-01-01T00:30:00Z',
}

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeQuery,
  }),
  useRouter: () => ({ push }),
}))

vi.mock('@/stores/payment', () => ({ usePaymentStore: () => ({ pollOrderStatus }) }))
vi.mock('@/stores', () => ({ useAppStore: () => ({ showError: vi.fn() }) }))
vi.mock('@/api/payment', () => ({ paymentAPI: { cancelOrder: vi.fn() } }))
vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn() } }))
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  const messages: Record<string, string> = {
    'payment.actualPay': 'Actual payment',
    'payment.orders.orderId': 'Order ID',
    'payment.orders.paymentMethod': 'Payment method',
    'payment.orders.status': 'Status',
  }
  return { ...actual, useI18n: () => ({ t: (key: string) => messages[key] ?? key }) }
})

describe('PaymentQRCodeView', () => {
  it('shows the payment amount beside order and status details', async () => {
    const wrapper = mount(PaymentQRCodeView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Actual payment')
    expect(wrapper.text()).toContain('¥103.00')
    expect(wrapper.text()).toContain('#42')
    expect(wrapper.get('[data-testid="qr-order-details"]').classes()).toContain('divide-y')
    expect(pollOrderStatus).toHaveBeenCalledWith(42)
    wrapper.unmount()
  })

  it('does not render unsafe payment links from route query parameters', async () => {
    routeQuery.pay_url = 'javascript:alert(1)'
    const wrapper = mount(PaymentQRCodeView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.find('a[href]').exists()).toBe(false)
    routeQuery.pay_url = 'https://pay.example.test/order/42'
    wrapper.unmount()
  })
})
