import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import PaymentQRCodeView from '../PaymentQRCodeView.vue'

const pollOrderStatus = vi.fn().mockResolvedValue(null)
const push = vi.fn()
let resolvePoll: (value: { status: string } | null) => void = () => undefined
const routeQuery = {
  order_id: '42',
  qr: '',
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
    'payment.qr.cancelled': 'Order Cancelled',
    'payment.qr.cancelledDesc': 'You have cancelled this payment.',
    'payment.qr.qrCodeLabel': 'Payment QR code',
    'payment.qr.openPayWindow': 'Reopen Payment Page',
    'payment.qr.expired': 'Order Expired',
    'payment.qr.expiredDesc': 'This order has expired. Please create a new one.',
    'payment.qr.waitingPayment': 'Waiting for payment...',
    'payment.result.failed': 'Payment Failed',
    'payment.result.failedHint': 'This payment has not been confirmed. You can retry or review the order status.',
  }
  return { ...actual, useI18n: () => ({ t: (key: string) => messages[key] ?? key }) }
})

describe('PaymentQRCodeView', () => {
  beforeEach(() => {
    pollOrderStatus.mockReset().mockResolvedValue(null)
    push.mockClear()
    routeQuery.pay_url = 'https://pay.example.test/order/42'
    routeQuery.qr = ''
    routeQuery.expires_at = '2099-01-01T00:30:00Z'
    delete routeQuery.resume_token
    delete routeQuery.out_trade_no
  })

  afterEach(() => vi.useRealTimers())

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

  it('exposes an accessible QR name and keyboard payment fallback', async () => {
    routeQuery.qr = 'https://pay.example.test/qr/42'
    const wrapper = mount(PaymentQRCodeView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.get('canvas').attributes('role')).toBe('img')
    expect(wrapper.get('canvas').attributes('aria-label')).toBe('Payment QR code')
    expect(wrapper.get('a[href="https://pay.example.test/order/42"]').text()).toBe('Reopen Payment Page')
    wrapper.unmount()
    routeQuery.qr = ''
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

  it('treats RECHARGING as a successful terminal state and preserves signed result context', async () => {
    routeQuery.resume_token = 'resume-42'
    routeQuery.out_trade_no = 'trade-42'
    pollOrderStatus.mockResolvedValueOnce({
      status: 'RECHARGING',
      pay_amount: 103,
      amount: 103,
      currency: 'CNY'
    })

    const wrapper = mount(PaymentQRCodeView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      path: '/payment/result',
      query: {
        order_id: '42',
        status: 'success',
        resume_token: 'resume-42',
        out_trade_no: 'trade-42'
      }
    })
    wrapper.unmount()
    delete routeQuery.resume_token
    delete routeQuery.out_trade_no
  })

  it('treats malformed or expired timestamps as terminal without starting polling', async () => {
    routeQuery.expires_at = 'not-a-date'
    const wrapper = mount(PaymentQRCodeView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Order Expired')
    expect(pollOrderStatus).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([
    ['CANCELLED', 'Order Cancelled', 'You have cancelled this payment.'],
    ['FAILED', 'Payment Failed', 'This payment has not been confirmed. You can retry or review the order status.'],
  ])('keeps %s distinct from an expired order', async (status, label, description) => {
    pollOrderStatus.mockResolvedValueOnce({ status })

    const wrapper = mount(PaymentQRCodeView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain(label)
    expect(wrapper.text()).toContain(description)
    expect(wrapper.text()).not.toContain('Order Expired')
    expect(wrapper.find('a[href]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="qr-order-details"]').text()).toContain(label)
    wrapper.unmount()
  })

  it('keeps polling after a transient status request failure', async () => {
    vi.useFakeTimers()
    pollOrderStatus
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({
        status: 'PAID',
        pay_amount: 103,
        amount: 103,
        currency: 'CNY'
      })

    const wrapper = mount(PaymentQRCodeView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
    await flushPromises()
    expect(push).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    expect(pollOrderStatus).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenCalledWith({
      path: '/payment/result',
      query: { order_id: '42', status: 'success' }
    })
    wrapper.unmount()
  })

  it('ignores a late polling response after the view is unmounted', async () => {
    pollOrderStatus.mockImplementationOnce(() => new Promise<{ status: string } | null>((resolve) => {
      resolvePoll = resolve
    }))

    const wrapper = mount(PaymentQRCodeView, {
      global: {
        stubs: {
          AppLayout: { template: '<main><slot /></main>' },
          Icon: true,
        },
      },
    })
    await flushPromises()

    wrapper.unmount()
    resolvePoll({ status: 'PAID' })
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
  })
})
