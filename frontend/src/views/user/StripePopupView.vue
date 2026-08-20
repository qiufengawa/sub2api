<template>
  <AppPage width="normal" density="compact" class="stripe-popup-page">
    <AppPageHeader :title="t('payment.stripePay')">
      <template #status><UiStatusBadge :status="error ? 'failed' : success ? 'success' : 'pending'" :label="error ? t('payment.result.failed') : success ? t('payment.result.success') : t('common.processing')" /></template>
    </AppPageHeader>
    <UiDescriptionList v-if="amount || orderId" :columns="1" :items="[
      ...(amount ? [{ label: t('payment.orders.payAmount'), value: formatPaymentAmount(Number(amount), currency), numeric: true }] : []),
      ...(orderId ? [{ label: t('payment.orders.orderId'), value: orderId, numeric: true }] : []),
    ]" />
    <UiAlert v-if="error" tone="danger" :message="error" />
    <AppSection v-else-if="success" class="stripe-popup__success">
      <Icon name="checkCircle" size="lg" class="stripe-popup__success-icon" />
      <p>{{ t('payment.result.success') }}</p>
      <UiButton variant="secondary" density="compact" @click="closeWindow">{{ t('common.close') }}</UiButton>
    </AppSection>
    <AppSection v-else class="stripe-popup__loading">
      <UiSpinner size="lg" />
      <p>{{ hint }}</p>
    </AppSection>
    <UiButton v-if="error" variant="secondary" density="compact" block @click="closeWindow">{{ t('common.close') }}</UiButton>
  </AppPage>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { extractI18nErrorMessage } from '@/utils/apiError'
import { isMobileDevice } from '@/utils/device'
import { buildApiUrl } from '@/api/client'
import Icon from '@/components/icons/Icon.vue'
import { formatPaymentAmount, normalizePaymentCurrency } from '@/components/payment/currency'
import { AppPage, AppPageHeader, AppSection, UiAlert, UiButton, UiDescriptionList, UiSpinner, UiStatusBadge } from '@/components/ui'

interface StripeWithWechatPay {
  confirmWechatPayPayment(clientSecret: string, options: Record<string, unknown>): Promise<{ error?: { message?: string }; paymentIntent?: { status: string } }>
}

const { t } = useI18n()
const route = useRoute()

const orderId = String(route.query.order_id || '')
const outTradeNo = String(route.query.out_trade_no || '')
const resumeToken = String(route.query.resume_token || '')
const method = String(route.query.method || 'alipay')
const amount = String(route.query.amount || '')
const currency = normalizePaymentCurrency(String(route.query.currency || ''))

const error = ref('')
const success = ref(false)
const hint = ref(t('payment.stripePopup.redirecting'))

let pollTimer: ReturnType<typeof setInterval> | null = null
let pollExpiryTimer: ReturnType<typeof setTimeout> | null = null
let initTimeoutTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let messageHandler: ((event: MessageEvent) => void) | null = null
let disposed = false
const STRIPE_POPUP_POLL_MAX_DURATION_MS = 30 * 60 * 1000

function closeWindow() { window.close() }

function scheduleCloseWindow() {
  if (disposed) return
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    closeTimer = null
    if (!disposed) closeWindow()
  }, 2000)
}

function buildResultUrl(): string {
  const query = new URLSearchParams({ order_id: orderId, status: 'success' })
  if (currency) query.set('currency', currency)
  if (outTradeNo) query.set('out_trade_no', outTradeNo)
  if (resumeToken) query.set('resume_token', resumeToken)
  return `${window.location.origin}/payment/result?${query.toString()}`
}

function clearInitTimeout() {
  if (initTimeoutTimer) {
    clearTimeout(initTimeoutTimer)
    initTimeoutTimer = null
  }
}

onMounted(() => {
  messageHandler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    if (window.opener && event.source && event.source !== window.opener) return
    if (event.data?.type !== 'STRIPE_POPUP_INIT') return
    if (error.value || success.value || disposed) return
    // INIT 已到达，取消兜底超时，避免长时间的扫码支付被误判为超时。
    clearInitTimeout()
    if (messageHandler) {
      window.removeEventListener('message', messageHandler)
      messageHandler = null
    }
    initStripe(event.data.clientSecret, event.data.publishableKey)
  }
  window.addEventListener('message', messageHandler)

  if (window.opener) {
    window.opener.postMessage({ type: 'STRIPE_POPUP_READY' }, window.location.origin)
  }

  // 仅兜底“父窗口始终未发 STRIPE_POPUP_INIT”的场景。
  initTimeoutTimer = setTimeout(() => {
    if (!disposed && !error.value && !success.value) {
      error.value = t('payment.stripePopup.timeout')
    }
  }, 15000)
})

onUnmounted(() => {
  disposed = true
  stopPolling()
  clearInitTimeout()
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (messageHandler) {
    window.removeEventListener('message', messageHandler)
    messageHandler = null
  }
})

async function initStripe(clientSecret: string, publishableKey: string) {
  if (!clientSecret || !publishableKey) {
    error.value = t('payment.stripeMissingParams')
    return
  }
  try {
    const { loadStripe } = await import('@stripe/stripe-js/pure')
    if (disposed) return
    const stripe = await loadStripe(publishableKey)
    if (disposed) return
    if (!stripe) { error.value = t('payment.stripeLoadFailed'); return }

    const returnUrl = buildResultUrl()

    if (method === 'alipay') {
      // Alipay: redirect this popup to Alipay payment page
      const { error: err } = await stripe.confirmAlipayPayment(clientSecret, { return_url: returnUrl })
      if (disposed) return
      if (err) error.value = err.message || t('payment.result.failed')
    } else if (method === 'wechat_pay') {
      // WeChat: Stripe shows its built-in QR dialog, user scans, promise resolves
      hint.value = t('payment.stripePopup.loadingQr')
      const result = await (stripe as unknown as StripeWithWechatPay).confirmWechatPayPayment(clientSecret, {
        payment_method_options: { wechat_pay: { client: isMobileDevice() ? 'mobile_web' : 'web' } },
      })
      if (disposed) return
      if (result.error) {
        error.value = result.error.message || t('payment.result.failed')
      } else if (result.paymentIntent?.status === 'succeeded') {
        success.value = true
        scheduleCloseWindow()
      } else {
        // Payment not completed (user closed QR dialog)
        startPolling()
      }
    } else {
      error.value = t('payment.result.failed')
    }
  } catch (err: unknown) {
    if (disposed) return
    error.value = extractI18nErrorMessage(err, t, 'payment.errors', t('payment.stripeLoadFailed'))
  }
}

function startPolling() {
  if (disposed || pollTimer) return
  let inFlight = false
  pollExpiryTimer = setTimeout(() => {
    if (disposed) return
    stopPolling()
    if (!error.value && !success.value) error.value = t('payment.qr.expired')
  }, STRIPE_POPUP_POLL_MAX_DURATION_MS)
  pollTimer = setInterval(async () => {
    // 防重入：接口响应慢于轮询间隔时避免并发重叠请求。
    if (disposed || inFlight) return
    inFlight = true
    try {
      // access token 存储在 localStorage 的 'auth_token' 键下（见 api/client.ts），
      // 之前误读 'token' 导致轮询请求不带认证、永远 401，支付成功无法被检测到。
      const token = localStorage.getItem('auth_token') || ''
      const res = await fetch(buildApiUrl(`/payment/orders/${orderId}`), {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        credentials: 'include',
      })
      if (disposed) return
      let data: { data?: { status?: string } } | null = null
      if (res.ok) {
        data = await res.json()
        if (disposed) return
      } else if (res.status === 401 && resumeToken) {
        // A signed resume token is sufficient to recover the order when the
        // popup outlives the authenticated parent window.
        const publicRes = await fetch(buildApiUrl('/payment/public/orders/resolve'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_token: resumeToken }),
          credentials: 'include',
        })
        if (disposed) return
        if (!publicRes.ok) return
        data = await publicRes.json()
        if (disposed) return
      } else {
        return
      }
      const status = data?.data?.status
      if (status === 'COMPLETED' || status === 'PAID' || status === 'RECHARGING') {
        stopPolling()
        success.value = true
        scheduleCloseWindow()
      } else if (status === 'EXPIRED' || status === 'CANCELLED' || status === 'FAILED') {
        stopPolling()
        error.value = status === 'EXPIRED' ? t('payment.qr.expired') : t('payment.result.failed')
      }
    } catch { /* ignore */ } finally {
      inFlight = false
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  if (pollExpiryTimer) clearTimeout(pollExpiryTimer)
  pollTimer = null
  pollExpiryTimer = null
}
</script>

<style scoped>
.stripe-popup-page { max-width:520px; margin:0 auto; }
.stripe-popup__success,.stripe-popup__loading { display:flex; min-height:180px; flex-direction:column; align-items:center; justify-content:center; gap:12px; text-align:center; }
.stripe-popup__success p,.stripe-popup__loading p { margin:0; color:var(--ui-text-muted); font-size:13px; }
.stripe-popup__success-icon { color:var(--ui-success); }
</style>
