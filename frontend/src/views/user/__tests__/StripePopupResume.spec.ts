import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StripePopupView from '../StripePopupView.vue'

const routeQuery = vi.hoisted(() => ({
  order_id: '42',
  out_trade_no: 'trade-42',
  resume_token: 'resume-signed-token',
  method: 'wechat_pay',
  amount: '12.50',
  currency: 'USD'
}))

const confirmWechatPayPayment = vi.hoisted(() => vi.fn())
const loadStripe = vi.hoisted(() => vi.fn())

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: routeQuery }) }))
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe }))
vi.mock('@/api/client', () => ({ buildApiUrl: (path: string) => path }))

describe('StripePopupView signed resume polling', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.stubGlobal('fetch', undefined)
    confirmWechatPayPayment.mockReset().mockResolvedValue({
      paymentIntent: { status: 'requires_action' }
    })
    loadStripe.mockReset().mockResolvedValue({ confirmWechatPayPayment })
  })

  it('recovers through the public endpoint when the popup loses authentication', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'PAID' } })
      })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(StripePopupView)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'STRIPE_POPUP_INIT',
        clientSecret: 'pi_secret',
        publishableKey: 'pk_test'
      }
    }))

    await vi.waitFor(() => expect(confirmWechatPayPayment).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(3000)

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/payment/public/orders/resolve', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ resume_token: 'resume-signed-token' })
    }))
    expect(wrapper.text()).toContain('payment.result.success')
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('ignores an authenticated poll response that resolves after unmount', async () => {
    vi.useFakeTimers()
    let resolveFetch!: (response: { ok: boolean; json: () => Promise<unknown> }) => void
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))
    const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(StripePopupView)
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      data: {
        type: 'STRIPE_POPUP_INIT',
        clientSecret: 'pi_secret',
        publishableKey: 'pk_test'
      }
    }))

    await vi.waitFor(() => expect(confirmWechatPayPayment).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(3000)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    resolveFetch({
      ok: true,
      json: async () => ({ data: { status: 'PAID' } })
    })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(closeSpy).not.toHaveBeenCalled()
    closeSpy.mockRestore()
    vi.useRealTimers()
  })
})
