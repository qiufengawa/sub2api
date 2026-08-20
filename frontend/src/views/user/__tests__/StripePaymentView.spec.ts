import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'

const routeState = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
}))
const routerPush = vi.hoisted(() => vi.fn())
const getOrder = vi.hoisted(() => vi.fn())
const paymentStore = vi.hoisted(() => ({
  config: { stripe_publishable_key: 'pk_test' } as { stripe_publishable_key?: string },
  fetchConfig: vi.fn(),
  pollOrderStatus: vi.fn(),
}))
const loadStripe = vi.hoisted(() => vi.fn())
const stripeElements = vi.hoisted(() => ({
  create: vi.fn(),
}))
const stripePaymentElement = vi.hoisted(() => ({
  mount: vi.fn(),
  on: vi.fn(),
}))
const stripeInstance = vi.hoisted(() => ({
  elements: vi.fn(),
  confirmPayment: vi.fn(),
  confirmAlipayPayment: vi.fn(),
  confirmWechatPayPayment: vi.fn(),
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRoute: () => routeState,
    useRouter: () => ({ push: routerPush }),
  }
})

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      locale: { value: 'zh-CN' },
    }),
  }
})

vi.mock('@/stores/payment', () => ({
  usePaymentStore: () => paymentStore,
}))

vi.mock('@/api/payment', () => ({
  paymentAPI: {
    getOrder,
  },
}))

vi.mock('@stripe/stripe-js/pure', () => ({
  loadStripe,
}))

import StripePaymentView from '../StripePaymentView.vue'
import { formatPaymentAmount } from '@/components/payment/currency'
import type { PaymentOrder } from '@/types/payment'

function orderFactory(overrides: Partial<PaymentOrder> = {}): PaymentOrder {
  return {
    id: 42,
    user_id: 7,
    amount: 100,
    pay_amount: 103,
    currency: 'CNY',
    fee_rate: 0.03,
    payment_type: 'stripe',
    out_trade_no: 'sub2_stripe_42',
    status: 'PENDING',
    order_type: 'balance',
    created_at: '2026-04-20T12:00:00Z',
    expires_at: '2026-04-20T12:30:00Z',
    refund_amount: 0,
    ...overrides,
  }
}

function mountView() {
  return shallowMount(StripePaymentView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Icon: true,
        AppPage: { template: '<main><slot /></main>' },
        AppPageHeader: {
          props: ['title', 'description'],
          template: '<header><h1>{{ title }}</h1><p>{{ description }}</p><slot name="status"/><slot name="actions"/></header>',
        },
        AppGrid: { template: '<div><slot /></div>' },
        AppSection: { template: '<section><slot /></section>' },
        UiDescriptionList: {
          props: ['items'],
          template: '<dl><div v-for="item in items" :key="item.label">{{ item.value }}</div></dl>',
        },
      },
    },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('StripePaymentView', () => {
  beforeEach(() => {
    routeState.query = {
      order_id: '42',
      client_secret: 'pi_secret_42',
    }
    routerPush.mockReset()
    getOrder.mockReset()
    paymentStore.config = { stripe_publishable_key: 'pk_test' }
    paymentStore.fetchConfig.mockReset().mockResolvedValue(undefined)
    paymentStore.pollOrderStatus.mockReset()
    loadStripe.mockReset().mockResolvedValue(stripeInstance)
    stripeElements.create.mockReset().mockReturnValue(stripePaymentElement)
    stripePaymentElement.mount.mockReset()
    stripePaymentElement.on.mockReset().mockImplementation((event: string, callback: () => void) => {
      if (event === 'ready') callback()
    })
    stripeInstance.elements.mockReset().mockReturnValue(stripeElements)
    stripeInstance.confirmPayment.mockReset()
    stripeInstance.confirmAlipayPayment.mockReset()
    stripeInstance.confirmWechatPayPayment.mockReset()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('本地恢复快照缺失时使用订单接口返回的 Stripe 币种展示金额', async () => {
    getOrder.mockResolvedValue({
      data: orderFactory({ currency: 'HKD', pay_amount: 103 }),
    })

    const wrapper = mountView()
    await flushPromises()
    await flushPromises()

    expect(getOrder).toHaveBeenCalledWith(42)
    expect(loadStripe).toHaveBeenCalledWith('pk_test')
    expect(wrapper.text()).toContain(formatPaymentAmount(103, 'HKD', 'zh-CN'))
  })

  it('carries signed resume context and order number into Stripe return URLs', async () => {
    routeState.query = {
      order_id: '42',
      client_secret: 'pi_secret_42',
      resume_token: 'resume-stripe-42',
      out_trade_no: 'sub2_route_42',
    }
    getOrder.mockResolvedValue({ data: orderFactory() })
    stripeInstance.confirmPayment.mockResolvedValue({})

    const wrapper = mountView()
    await flushPromises()
    await flushPromises()

    await wrapper.get('.stripe-payment__submit').trigger('click')
    const returnUrl = stripeInstance.confirmPayment.mock.calls[0]?.[0]?.confirmParams?.return_url as string
    const parsed = new URL(returnUrl)
    expect(parsed.searchParams.get('order_id')).toBe('42')
    expect(parsed.searchParams.get('status')).toBe('success')
    expect(parsed.searchParams.get('resume_token')).toBe('resume-stripe-42')
    expect(parsed.searchParams.get('out_trade_no')).toBe('sub2_stripe_42')
  })

  it('keeps only one Stripe WeChat status request in flight and settles once', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
    routeState.query = {
      order_id: '42',
      client_secret: 'pi_secret_42',
      method: 'wechat_pay',
      resume_token: 'resume-stripe-42',
    }
    getOrder.mockResolvedValue({ data: orderFactory() })
    stripeInstance.confirmWechatPayPayment.mockResolvedValue({
      paymentIntent: {
        status: 'requires_action',
        next_action: {
          wechat_pay_display_qr_code: { image_data_url: 'data:image/png;base64,qr' },
        },
      },
    })
    const pendingPoll = deferred<PaymentOrder>()
    paymentStore.pollOrderStatus.mockReturnValue(pendingPoll.promise)

    mountView()
    await flushPromises()
    await flushPromises()

    vi.advanceTimersByTime(3000)
    await flushPromises()
    vi.advanceTimersByTime(6000)
    expect(paymentStore.pollOrderStatus).toHaveBeenCalledTimes(1)

    pendingPoll.resolve(orderFactory({ status: 'PAID' }))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(routerPush).toHaveBeenCalledTimes(1)
    expect(routerPush).toHaveBeenCalledWith({
      path: '/payment/result',
      query: expect.objectContaining({
        order_id: '42',
        resume_token: 'resume-stripe-42',
        status: 'success',
      }),
    })
  })

  it('treats a recharging Stripe WeChat order as paid', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
    routeState.query = {
      order_id: '42',
      client_secret: 'pi_secret_42',
      method: 'wechat_pay',
      resume_token: 'resume-stripe-42',
    }
    getOrder.mockResolvedValue({ data: orderFactory() })
    stripeInstance.confirmWechatPayPayment.mockResolvedValue({
      paymentIntent: {
        status: 'requires_action',
        next_action: {
          wechat_pay_display_qr_code: { image_data_url: 'data:image/png;base64,qr' },
        },
      },
    })
    paymentStore.pollOrderStatus.mockResolvedValue(orderFactory({ status: 'RECHARGING' }))

    mountView()
    await flushPromises()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(2000)

    expect(routerPush).toHaveBeenCalledTimes(1)
    expect(routerPush).toHaveBeenCalledWith({
      path: '/payment/result',
      query: expect.objectContaining({
        order_id: '42',
        resume_token: 'resume-stripe-42',
        status: 'success',
      }),
    })
  })

  it('ignores a Stripe WeChat polling response that arrives after unmount', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
    routeState.query = {
      order_id: '42',
      client_secret: 'pi_secret_42',
      method: 'wechat_pay',
    }
    getOrder.mockResolvedValue({ data: orderFactory() })
    stripeInstance.confirmWechatPayPayment.mockResolvedValue({
      paymentIntent: {
        status: 'requires_action',
        next_action: {
          wechat_pay_display_qr_code: { image_data_url: 'data:image/png;base64,qr' },
        },
      },
    })
    const pendingPoll = deferred<PaymentOrder>()
    paymentStore.pollOrderStatus.mockReturnValue(pendingPoll.promise)

    const wrapper = mountView()
    await flushPromises()
    await flushPromises()
    vi.advanceTimersByTime(3000)
    await flushPromises()
    wrapper.unmount()

    pendingPoll.resolve(orderFactory({ status: 'PAID' }))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(routerPush).not.toHaveBeenCalled()
  })

  it('stops Stripe WeChat polling when the order expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
    routeState.query = {
      order_id: '42',
      client_secret: 'pi_secret_42',
      method: 'wechat_pay',
    }
    getOrder.mockResolvedValue({
      data: orderFactory({ expires_at: '2026-04-20T12:00:05Z' }),
    })
    stripeInstance.confirmWechatPayPayment.mockResolvedValue({
      paymentIntent: {
        status: 'requires_action',
        next_action: {
          wechat_pay_display_qr_code: { image_data_url: 'data:image/png;base64,qr' },
        },
      },
    })
    paymentStore.pollOrderStatus.mockResolvedValue(orderFactory({ status: 'PENDING' }))

    const wrapper = mountView()
    await flushPromises()
    await flushPromises()
    await vi.advanceTimersByTimeAsync(5000)

    expect(wrapper.get('ui-alert-stub').attributes('message')).toBe('payment.qr.expired')
    expect(paymentStore.pollOrderStatus).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(paymentStore.pollOrderStatus).toHaveBeenCalledTimes(1)
  })
})
