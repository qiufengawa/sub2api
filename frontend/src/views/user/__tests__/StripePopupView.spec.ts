import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import StripePopupView from '@/views/user/StripePopupView.vue'

const routeQuery = vi.hoisted(() => ({
  order_id: '42',
  out_trade_no: 'trade-42',
  resume_token: 'resume-signed-token',
  method: 'alipay',
  amount: '12.50',
  currency: 'USD'
}))

const mocks = vi.hoisted(() => ({
  confirmAlipayPayment: vi.fn(),
  confirmWechatPayPayment: vi.fn(),
  loadStripe: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeQuery
  })
}))

vi.mock('@stripe/stripe-js/pure', () => ({
  loadStripe: mocks.loadStripe
}))

vi.mock('@/api/client', () => ({
  buildApiUrl: (path: string) => path
}))

describe('StripePopupView', () => {
  beforeEach(() => {
    vi.useRealTimers()
    globalThis.localStorage?.removeItem('auth_token')
    vi.stubGlobal('fetch', undefined)
    routeQuery.order_id = '42'
    routeQuery.out_trade_no = 'trade-42'
    routeQuery.resume_token = 'resume-signed-token'
    routeQuery.method = 'alipay'
    routeQuery.amount = '12.50'
    routeQuery.currency = 'USD'
    mocks.confirmAlipayPayment.mockReset().mockResolvedValue({})
    mocks.confirmWechatPayPayment.mockReset()
    mocks.loadStripe.mockReset().mockResolvedValue({
      confirmAlipayPayment: mocks.confirmAlipayPayment,
      confirmWechatPayPayment: mocks.confirmWechatPayPayment
    })
  })

  it('preserves signed resume context in the external Alipay return URL', async () => {
    const wrapper = mount(StripePopupView)

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'STRIPE_POPUP_INIT',
        clientSecret: 'pi_secret',
        publishableKey: 'pk_test'
      }
    }))

    await vi.waitFor(() => {
      expect(mocks.confirmAlipayPayment).toHaveBeenCalledTimes(1)
    })

    const options = mocks.confirmAlipayPayment.mock.calls[0]?.[1] as {
      return_url: string
    }
    const returnUrl = new URL(options.return_url)
    expect(returnUrl.pathname).toBe('/payment/result')
    expect(Object.fromEntries(returnUrl.searchParams)).toEqual({
      order_id: '42',
      status: 'success',
      currency: 'USD',
      out_trade_no: 'trade-42',
      resume_token: 'resume-signed-token'
    })

    wrapper.unmount()
  })

  it('stops WeChat polling and exposes failed terminal status', async () => {
    vi.useFakeTimers()
    routeQuery.method = 'wechat_pay'
    mocks.confirmWechatPayPayment.mockResolvedValue({
      paymentIntent: { status: 'requires_action' }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'FAILED' } })
    }))

    const wrapper = mount(StripePopupView)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'STRIPE_POPUP_INIT',
        clientSecret: 'pi_secret',
        publishableKey: 'pk_test'
      }
    }))

    await vi.waitFor(() => {
      expect(mocks.confirmWechatPayPayment).toHaveBeenCalledTimes(1)
    })
    await vi.advanceTimersByTimeAsync(3000)

    expect(wrapper.text()).toContain('payment.result.failed')
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('rejects an unsupported popup payment method after initialization', async () => {
    routeQuery.method = 'unsupported_method'

    const wrapper = mount(StripePopupView)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'STRIPE_POPUP_INIT',
        clientSecret: 'pi_secret',
        publishableKey: 'pk_test'
      }
    }))

    await vi.waitFor(() => expect(mocks.loadStripe).toHaveBeenCalledTimes(1))
    expect(wrapper.text()).toContain('payment.result.failed')
    wrapper.unmount()
  })

  it('ignores a late initialization message after timeout', async () => {
    vi.useFakeTimers()
    const wrapper = mount(StripePopupView)

    await vi.advanceTimersByTimeAsync(15000)
    expect(wrapper.text()).toContain('payment.stripePopup.timeout')

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'STRIPE_POPUP_INIT',
        clientSecret: 'pi_secret',
        publishableKey: 'pk_test'
      }
    }))

    expect(mocks.loadStripe).not.toHaveBeenCalled()
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('formats the popup amount using the routed currency', () => {
    const wrapper = mount(StripePopupView)

    expect(wrapper.text()).toContain('$12.50')
    expect(wrapper.text()).not.toContain('¥12.50')

    wrapper.unmount()
  })

  it('stops polling and reports success for the RECHARGING terminal state', async () => {
    vi.useFakeTimers()
    routeQuery.method = 'wechat_pay'
    mocks.confirmWechatPayPayment.mockResolvedValue({
      paymentIntent: { status: 'requires_action' }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { status: 'RECHARGING' } })
    }))

    const wrapper = mount(StripePopupView)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'STRIPE_POPUP_INIT',
        clientSecret: 'pi_secret',
        publishableKey: 'pk_test'
      }
    }))

    await vi.waitFor(() => {
      expect(mocks.confirmWechatPayPayment).toHaveBeenCalledTimes(1)
    })
    await vi.advanceTimersByTimeAsync(3000)

    expect(wrapper.text()).toContain('payment.result.success')
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    vi.useRealTimers()
  })

})
