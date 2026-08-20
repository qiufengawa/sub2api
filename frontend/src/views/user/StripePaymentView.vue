<template>
  <component :is="isPopup ? 'div' : AppLayout" :class="isPopup ? 'stripe-payment-popup' : undefined">
    <AppPage density="compact" width="wide" class="stripe-payment-page">
      <AppPageHeader
        :title="t('payment.stripePay')"
        :description="order ? `${t('payment.actualPay')}: ${formatGatewayAmount(order.pay_amount)}` : undefined"
      >
        <template #status>
          <UiStatusBadge
            :status="stripeSuccess ? 'success' : stripeError || initError ? 'failed' : 'pending'"
            :label="stripeSuccess ? t('payment.result.success') : stripeError || initError ? t('payment.result.failed') : t('payment.result.processing')"
          />
        </template>
        <template #actions>
          <UiButton variant="secondary" density="compact" @click="router.push('/purchase')">
            {{ t('payment.result.backToRecharge') }}
          </UiButton>
        </template>
      </AppPageHeader>

      <section v-if="loading" class="stripe-payment__loading" aria-live="polite" aria-busy="true">
        <UiSkeleton variant="text" width="220px" height="24px" />
        <UiSkeleton variant="rect" width="100%" height="220px" />
        <UiSkeleton variant="text" width="180px" height="18px" />
      </section>

      <AppSection v-else-if="initError" class="stripe-payment__error">
        <UiAlert tone="danger" :title="t('payment.stripeLoadFailed')" :message="initError" />
        <UiButton variant="primary" density="compact" @click="router.push('/purchase')">
          {{ t('payment.result.backToRecharge') }}
        </UiButton>
      </AppSection>

      <AppGrid v-else min="340px" class="stripe-payment__grid">
        <div class="stripe-payment__main">
          <AppSection v-if="wechatQrUrl" title="WeChat Pay" class="stripe-payment__section">
            <div class="stripe-payment__qr">
              <div class="stripe-payment__qr-frame">
                <img :src="wechatQrUrl" alt="WeChat Pay QR" />
              </div>
              <p v-if="!wechatQrExpired && !wechatQrFailed">{{ t('payment.qr.scanWxpayHint') }}</p>
              <UiStatusBadge
                :status="wechatQrExpired || wechatQrFailed ? 'failed' : 'pending'"
                :label="wechatQrExpired ? t('payment.qr.expired') : wechatQrFailed ? t('payment.result.failed') : t('payment.qr.waitingPayment')"
              />
              <UiAlert
                v-if="wechatQrExpired || wechatQrFailed"
                tone="danger"
                :message="wechatQrExpired ? t('payment.qr.expired') : stripeError || t('payment.result.failed')"
              />
              <UiButton
                v-if="wechatQrExpired || wechatQrFailed"
                variant="secondary"
                density="compact"
                @click="router.push('/purchase')"
              >
                {{ t('payment.result.backToRecharge') }}
              </UiButton>
            </div>
          </AppSection>

          <AppSection v-else-if="redirecting" class="stripe-payment__section">
            <div class="stripe-payment__state">
              <UiSpinner size="md" />
              <p>{{ t('payment.qr.payInNewWindowHint') }}</p>
            </div>
          </AppSection>

          <AppSection v-else-if="stripeSuccess" class="stripe-payment__section">
            <div class="stripe-payment__state">
              <Icon name="checkCircle" size="lg" class="stripe-payment__success-icon" />
              <strong>{{ t('payment.result.success') }}</strong>
              <p>{{ t('payment.stripeSuccessProcessing') }}</p>
            </div>
          </AppSection>

          <AppSection v-else-if="showPaymentElement" title="Stripe">
            <div id="stripe-payment-element" class="stripe-payment__element"></div>
            <UiAlert v-if="stripeError" class="stripe-payment__inline-error" tone="danger" :message="stripeError" />
            <UiButton
              class="stripe-payment__submit"
              variant="primary"
              density="compact"
              block
              :loading="stripeSubmitting"
              :disabled="!stripeReady"
              @click="handleGenericPay"
            >
              {{ t('payment.stripePay') }}
            </UiButton>
          </AppSection>

          <AppSection v-if="stripeError && !showPaymentElement" class="stripe-payment__section">
            <UiAlert tone="danger" :message="stripeError" />
          </AppSection>
        </div>

        <AppSection v-if="order" title="Order details" class="stripe-payment__summary">
          <p class="stripe-payment__amount-label">{{ t('payment.actualPay') }}</p>
          <p class="stripe-payment__amount">{{ formatGatewayAmount(order.pay_amount) }}</p>
          <UiDescriptionList
            :items="[
              { label: t('payment.orders.orderId'), value: `#${order.id}`, numeric: true },
              ...(order.out_trade_no ? [{ label: t('payment.orders.orderNo'), value: order.out_trade_no }] : []),
              { label: t('payment.orders.baseAmount'), value: formatGatewayAmount(order.amount), numeric: true },
              { label: t('payment.orders.paymentMethod'), value: 'Stripe' },
            ]"
            :columns="1"
          />
        </AppSection>
      </AppGrid>
    </AppPage>
  </component>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { usePaymentStore } from '@/stores/payment'
import { paymentAPI } from '@/api/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import { isMobileDevice } from '@/utils/device'
import { formatPaymentAmount, normalizePaymentCurrency } from '@/components/payment/currency'
import { readPaymentRecoverySnapshotFromStorage } from '@/components/payment/paymentFlow'
import type { PaymentOrder } from '@/types/payment'
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppGrid,
  AppPage,
  AppPageHeader,
  AppSection,
  UiAlert,
  UiButton,
  UiDescriptionList,
  UiSkeleton,
  UiSpinner,
  UiStatusBadge,
} from '@/components/ui'

const i18n = useI18n()
const { t } = i18n
const route = useRoute()
const router = useRouter()
const paymentStore = usePaymentStore()

const isPopup = computed(() => !!route.query.method)

const loading = ref(true)
const initError = ref('')
const stripeError = ref('')
const stripeSubmitting = ref(false)
const stripeSuccess = ref(false)
const stripeReady = ref(false)
const order = ref<PaymentOrder | null>(null)
const currency = ref('CNY')
const wechatQrUrl = ref('')
const wechatQrExpired = ref(false)
const wechatQrFailed = ref(false)
const redirecting = ref(false)
const showPaymentElement = ref(false)

let stripeInstance: Stripe | null = null
let elementsInstance: StripeElements | null = null
let paymentElement: StripePaymentElement | null = null
let redirectTimer: ReturnType<typeof setTimeout> | null = null
let disposed = false
let paymentSettled = false
let pollInFlight = false
let pollExpiryTimer: ReturnType<typeof setTimeout> | null = null
const WECHAT_QR_POLL_MAX_DURATION_MS = 30 * 60 * 1000

onMounted(async () => {
  const orderId = Number(route.query.order_id)
  const clientSecret = String(route.query.client_secret || '')
  const method = String(route.query.method || '')
  const resumeToken = typeof route.query.resume_token === 'string' ? route.query.resume_token : undefined

  if (!orderId || !clientSecret) {
    loading.value = false
    initError.value = t('payment.stripeMissingParams')
    return
  }

  try {
    if (typeof window !== 'undefined') {
      const restored = readPaymentRecoverySnapshotFromStorage(window.localStorage, {
        resumeToken,
        orderId,
      })
      if (restored?.orderId === orderId) {
        currency.value = normalizePaymentCurrency(restored.currency)
      }
    }
    const res = await paymentAPI.getOrder(orderId)
    if (disposed) return
    order.value = res.data
    if (res.data.currency) {
      currency.value = normalizePaymentCurrency(res.data.currency)
    }

    await paymentStore.fetchConfig()
    if (disposed) return
    const publishableKey = paymentStore.config?.stripe_publishable_key
    if (!publishableKey) { initError.value = t('payment.stripeNotConfigured'); return }

    const { loadStripe } = await import('@stripe/stripe-js/pure')
    const stripe = await loadStripe(publishableKey)
    if (disposed) return
    if (!stripe) { initError.value = t('payment.stripeLoadFailed'); return }

    stripeInstance = stripe
    loading.value = false

    if (method === 'alipay') {
      await confirmAlipay(stripe, clientSecret)
    } else if (method === 'wechat_pay') {
      await confirmWechatPay(stripe, clientSecret)
    } else {
      showPaymentElement.value = true
      await nextTick()
      if (disposed) return
      mountPaymentElement(stripe, clientSecret)
    }
  } catch (err: unknown) {
    initError.value = extractI18nErrorMessage(err, t, 'payment.errors', t('payment.stripeLoadFailed'))
  } finally {
    loading.value = false
  }
})

const localeCode = computed(() => {
  const raw = i18n.locale as unknown
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'value' in raw) {
    return String((raw as { value?: string }).value || '')
  }
  return undefined
})

function formatGatewayAmount(value: number): string {
  return formatPaymentAmount(value, currency.value, localeCode.value)
}

function buildPaymentResultQuery(): Record<string, string> {
  const query: Record<string, string> = {
    order_id: String(route.query.order_id || ''),
    status: 'success',
  }
  const resumeToken = typeof route.query.resume_token === 'string' ? route.query.resume_token : ''
  const outTradeNo = String(order.value?.out_trade_no || route.query.out_trade_no || '')
  if (resumeToken) query.resume_token = resumeToken
  if (outTradeNo) query.out_trade_no = outTradeNo
  return query
}

function buildPaymentResultUrl(): string {
  const params = new URLSearchParams(buildPaymentResultQuery())
  return `${window.location.origin}/payment/result?${params.toString()}`
}

async function confirmAlipay(stripe: Stripe, clientSecret: string) {
  redirecting.value = true
  const returnUrl = buildPaymentResultUrl()
  const { error } = await stripe.confirmAlipayPayment(clientSecret, { return_url: returnUrl })
  if (error) {
    redirecting.value = false
    stripeError.value = error.message || t('payment.result.failed')
  }
}

async function confirmWechatPay(stripe: Stripe, clientSecret: string) {
  const { paymentIntent, error } = await (stripe as Stripe & {
    confirmWechatPayPayment: (cs: string, opts: Record<string, unknown>) => Promise<{ paymentIntent?: { status: string; next_action?: { wechat_pay_display_qr_code?: { image_data_url?: string } } }; error?: { message?: string } }>
  }).confirmWechatPayPayment(clientSecret, {
    payment_method_options: { wechat_pay: { client: isMobileDevice() ? 'mobile_web' : 'web' } },
  })

  if (error) {
    stripeError.value = error.message || t('payment.result.failed')
    return
  }

  const qrData = paymentIntent?.next_action?.wechat_pay_display_qr_code?.image_data_url
  if (qrData) {
    wechatQrUrl.value = qrData
    startPolling()
  } else if (paymentIntent?.status === 'succeeded') {
    settleSuccessfulPayment()
  } else {
    stripeError.value = t('payment.result.failed')
  }
}

function mountPaymentElement(stripe: Stripe, clientSecret: string) {
  const isDark = document.documentElement.classList.contains('dark')
  const elements = stripe.elements({
    clientSecret,
    appearance: { theme: isDark ? 'night' : 'stripe', variables: { borderRadius: '6px' } },
  })
  elementsInstance = elements
  if (disposed) return
  paymentElement = elements.create('payment', {
    layout: 'tabs',
    paymentMethodOrder: ['alipay', 'wechat_pay', 'card', 'link'],
  } as Record<string, unknown>)
  paymentElement.mount('#stripe-payment-element')
  paymentElement.on('ready', () => { if (!disposed) stripeReady.value = true })
}

async function handleGenericPay() {
  if (!stripeInstance || !elementsInstance || stripeSubmitting.value) return
  stripeSubmitting.value = true
  stripeError.value = ''
  try {
    const { error } = await stripeInstance.confirmPayment({
      elements: elementsInstance,
      confirmParams: {
        return_url: buildPaymentResultUrl(),
      },
      redirect: 'if_required',
    })
    if (error) {
      stripeError.value = error.message || t('payment.result.failed')
    } else {
      settleSuccessfulPayment()
    }
  } catch (err: unknown) {
    stripeError.value = extractI18nErrorMessage(err, t, 'payment.errors', t('payment.result.failed'))
  } finally {
    stripeSubmitting.value = false
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  if (pollExpiryTimer) clearTimeout(pollExpiryTimer)
  pollTimer = null
  pollExpiryTimer = null
}

function expireWechatPayment() {
  if (disposed || paymentSettled || wechatQrExpired.value || wechatQrFailed.value) return
  stopPolling()
  wechatQrExpired.value = true
}

function failWechatPayment() {
  if (disposed || paymentSettled || wechatQrExpired.value || wechatQrFailed.value) return
  stopPolling()
  wechatQrFailed.value = true
  stripeError.value = t('payment.result.failed')
}

function resolveWechatPollingDeadline(): number {
  const fallbackDeadline = Date.now() + WECHAT_QR_POLL_MAX_DURATION_MS
  const orderDeadline = Date.parse(order.value?.expires_at || '')
  return Number.isFinite(orderDeadline)
    ? Math.min(orderDeadline, fallbackDeadline)
    : fallbackDeadline
}

function startPolling() {
  const orderId = Number(route.query.order_id)
  if (!orderId || pollTimer || paymentSettled || disposed) return
  const deadline = resolveWechatPollingDeadline()
  const remaining = deadline - Date.now()
  if (remaining <= 0) {
    expireWechatPayment()
    return
  }
  pollExpiryTimer = setTimeout(expireWechatPayment, remaining)
  pollTimer = setInterval(async () => {
    if (Date.now() >= deadline) {
      expireWechatPayment()
      return
    }
    if (pollInFlight || paymentSettled || disposed || wechatQrExpired.value || wechatQrFailed.value) return
    pollInFlight = true
    try {
      const nextOrder = await paymentStore.pollOrderStatus(orderId)
      if (disposed || paymentSettled || wechatQrExpired.value || wechatQrFailed.value || !nextOrder) return
      if (nextOrder.status === 'COMPLETED' || nextOrder.status === 'PAID' || nextOrder.status === 'RECHARGING') {
        settleSuccessfulPayment(true)
      } else if (nextOrder.status === 'EXPIRED' || nextOrder.status === 'CANCELLED' || nextOrder.status === 'FAILED') {
        if (nextOrder.status === 'EXPIRED') expireWechatPayment()
        else failWechatPayment()
      }
    } catch (_err: unknown) {
      // Keep the QR flow active; a later interval can recover from a transient status error.
    } finally {
      pollInFlight = false
    }
  }, 3000)
}

function settleSuccessfulPayment(clearWechatQr = false) {
  if (disposed || paymentSettled) return
  paymentSettled = true
  stopPolling()
  stripeSuccess.value = true
  if (clearWechatQr) wechatQrUrl.value = ''
  scheduleClose()
}

function scheduleClose() {
  if (disposed || redirectTimer) return
  if (window.opener) {
    redirectTimer = setTimeout(() => { window.close() }, 2000)
  } else {
    redirectTimer = setTimeout(() => {
      router.push({ path: '/payment/result', query: buildPaymentResultQuery() })
    }, 2000)
  }
}

onUnmounted(() => {
  disposed = true
  paymentElement?.unmount()
  paymentElement = null
  elementsInstance = null
  stripeInstance = null
  if (redirectTimer) clearTimeout(redirectTimer)
  stopPolling()
  redirectTimer = null
})
</script>

<style scoped>
.stripe-payment-popup {
  min-height: 100vh;
  background: var(--ui-page);
}

.stripe-payment-page {
  max-width: 1120px;
  margin: 0 auto;
}

.stripe-payment__loading,
.stripe-payment__state,
.stripe-payment__qr {
  display: grid;
  justify-items: center;
  gap: 14px;
  padding: 32px 0;
}

.stripe-payment__loading {
  justify-items: stretch;
  max-width: 760px;
  margin: 0 auto;
}

.stripe-payment__grid {
  align-items: start;
  gap: 28px;
  padding-top: 8px;
}

.stripe-payment__main {
  min-width: 0;
}

.stripe-payment__section {
  text-align: center;
}

.stripe-payment__qr-frame {
  display: grid;
  place-items: center;
  padding: 14px;
  border: 1px solid var(--ui-border);
  background: var(--ui-surface);
}

.stripe-payment__qr-frame img {
  width: min(256px, 70vw);
  aspect-ratio: 1;
  image-rendering: pixelated;
}

.stripe-payment__qr p,
.stripe-payment__state p {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: 20px;
}

.stripe-payment__state strong {
  font-size: 16px;
  font-weight: 600;
}

.stripe-payment__success-icon {
  color: var(--ui-success);
}

.stripe-payment__element {
  min-height: 200px;
}

.stripe-payment__inline-error {
  margin-top: 12px;
}

.stripe-payment__submit {
  margin-top: 16px;
}

.stripe-payment__summary {
  position: sticky;
  top: 16px;
}

.stripe-payment__amount-label {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 12px;
}

.stripe-payment__amount {
  margin: 4px 0 20px;
  color: var(--ui-text);
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  line-height: 34px;
}

.stripe-payment__error :deep(.ui-button) {
  margin-top: 16px;
}

@media (max-width: 640px) {
  .stripe-payment__grid {
    gap: 8px;
  }

  .stripe-payment__summary {
    position: static;
  }
}

</style>
