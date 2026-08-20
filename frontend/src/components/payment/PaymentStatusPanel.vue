<template>
  <div class="payment-status">
    <template v-if="outcome === 'success'">
      <AppSection class="payment-status__terminal">
        <Icon name="checkCircle" size="lg" class="payment-status__icon payment-status__icon--success" />
        <h2>{{ props.orderType === 'subscription' ? t('payment.result.subscriptionSuccess') : t('payment.result.success') }}</h2>
        <UiDescriptionList v-if="paidOrder" :columns="1" :items="[
          { label: t('payment.orders.orderId'), value: `#${paidOrder.id}`, numeric: true },
          ...(paidOrder.out_trade_no ? [{ label: t('payment.orders.orderNo'), value: paidOrder.out_trade_no }] : []),
          { label: t('payment.orders.amount'), value: `${creditedAmountSymbol}${paidOrder.amount.toFixed(2)}`, numeric: true },
          { label: t('payment.orders.payAmount'), value: formatGatewayAmount(paidOrder.pay_amount, paidOrder.currency), numeric: true },
        ]" />
        <UiButton variant="primary" density="compact" @click="handleDone">{{ t('common.confirm') }}</UiButton>
      </AppSection>
    </template>
    <template v-else-if="outcome === 'cancelled'">
      <AppSection class="payment-status__terminal">
        <Icon name="xCircle" size="lg" class="payment-status__icon payment-status__icon--neutral" />
        <h2>{{ t('payment.qr.cancelled') }}</h2>
        <p>{{ t('payment.qr.cancelledDesc') }}</p>
        <UiButton variant="primary" density="compact" @click="handleDone">{{ t('common.confirm') }}</UiButton>
      </AppSection>
    </template>
    <template v-else-if="outcome === 'expired'">
      <AppSection class="payment-status__terminal">
        <Icon name="clock" size="lg" class="payment-status__icon payment-status__icon--warning" />
        <h2>{{ t('payment.qr.expired') }}</h2>
        <p>{{ t('payment.qr.expiredDesc') }}</p>
        <UiButton variant="primary" density="compact" @click="handleDone">{{ t('common.confirm') }}</UiButton>
      </AppSection>
    </template>
    <template v-else-if="outcome === 'failed'">
      <AppSection class="payment-status__terminal">
        <Icon name="xCircle" size="lg" class="payment-status__icon payment-status__icon--danger" />
        <h2>{{ t('payment.result.failed') }}</h2>
        <p>{{ t('payment.result.failedHint') }}</p>
        <UiButton variant="primary" density="compact" @click="handleDone">{{ t('common.confirm') }}</UiButton>
      </AppSection>
    </template>

    <template v-else-if="isMobileAlipayDeepLink">
      <template v-if="!deepLinkFallbackVisible">
        <AppSection class="payment-status__terminal">
          <UiSpinner v-if="deepLinkState === 'launching'" size="lg" />
          <Icon v-else name="checkCircle" size="lg" class="payment-status__icon payment-status__icon--info" />
          <h2>{{ deepLinkState === 'backgrounded' ? t('payment.qr.alipayContinueInApp') : t('payment.qr.alipayOpening') }}</h2>
          <p>{{ t('payment.qr.alipayWaitingHint') }}</p>
          <UiButton v-if="deepLinkState === 'backgrounded'" data-test="reopen-alipay" variant="secondary" density="compact" @click="reopenAlipay">
            <template #icon><Icon name="externalLink" size="sm" /></template>
            {{ t('payment.qr.reopenAlipay') }}
          </UiButton>
        </AppSection>
        <AppSection class="payment-status__countdown">
          <UiStatusBadge status="pending" :label="t('payment.qr.waitingPayment')" />
          <strong>{{ countdownDisplay }}</strong>
        </AppSection>
      </template>
      <template v-else>
        <AppSection data-test="alipay-qr-fallback" class="payment-status__terminal">
          <h2>{{ t('payment.qr.alipayFallbackTitle') }}</h2>
          <p>{{ t('payment.qr.alipayFallbackHint') }}</p>
          <UiDescriptionList :columns="1" :items="[
            { label: t('payment.orders.payAmount'), value: displayPaymentAmount, numeric: true },
            { label: t('payment.orders.orderNo'), value: displayOrderNumber },
            { label: t('payment.qr.expiresIn'), value: countdownDisplay, numeric: true },
          ]" />
          <div class="payment-status__qr-frame" data-provider="alipay">
            <canvas ref="qrCanvas" />
            <img :src="qrLogoIcon" alt="" />
          </div>
          <p>{{ t('payment.qr.alipaySaveAndScanHint') }}</p>
          <div class="payment-status__actions">
            <UiButton data-test="reopen-alipay" variant="secondary" density="compact" @click="reopenAlipay"><template #icon><Icon name="externalLink" size="sm" /></template>{{ t('payment.qr.reopenAlipay') }}</UiButton>
            <UiButton data-test="save-alipay-qr" variant="secondary" density="compact" @click="saveQRCode"><template #icon><Icon name="download" size="sm" /></template>{{ t('payment.qr.saveQRCode') }}</UiButton>
          </div>
          <UiButton variant="quiet" density="compact" @click="handleDone">{{ t('payment.result.backToRecharge') }}</UiButton>
        </AppSection>
      </template>
    </template>

    <template v-else-if="showQRCode">
      <AppSection class="payment-status__terminal">
        <h2>{{ scanTitle }}</h2>
        <div class="payment-status__qr-frame" :data-provider="isAlipay ? 'alipay' : isWxpay ? 'wxpay' : 'generic'">
          <canvas ref="qrCanvas" />
          <img :src="qrLogoIcon" alt="" />
        </div>
        <p v-if="scanHint">{{ scanHint }}</p>
        <UiButton v-if="safePayUrl" variant="secondary" density="compact" @click="reopenPopup">{{ t('payment.qr.openPayWindow') }}</UiButton>
      </AppSection>
      <AppSection class="payment-status__countdown">
        <UiStatusBadge status="pending" :label="t('payment.qr.waitingPayment')" />
        <strong>{{ countdownDisplay }}</strong>
      </AppSection>
      <UiButton variant="secondary" density="compact" block :loading="cancelling" @click="handleCancel">{{ t('payment.qr.cancelOrder') }}</UiButton>
    </template>
    <template v-else>
      <AppSection class="payment-status__terminal">
        <UiSpinner size="lg" />
        <p>{{ t('payment.qr.payInNewWindowHint') }}</p>
        <UiButton v-if="safePayUrl" variant="secondary" density="compact" @click="reopenPopup">{{ t('payment.qr.openPayWindow') }}</UiButton>
      </AppSection>
      <AppSection class="payment-status__countdown">
        <UiStatusBadge status="pending" :label="t('payment.qr.waitingPayment')" />
        <strong>{{ countdownDisplay }}</strong>
      </AppSection>
      <UiButton variant="secondary" density="compact" block :loading="cancelling" @click="handleCancel">{{ t('payment.qr.cancelOrder') }}</UiButton>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePaymentStore } from '@/stores/payment'
import { useAppStore } from '@/stores'
import { paymentAPI } from '@/api/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import { getPaymentPopupFeatures, isBuiltInAlipayMethod, isBuiltInWxpayMethod } from '@/components/payment/providerConfig'
import { currencySymbol, formatPaymentAmount, normalizePaymentCurrency } from '@/components/payment/currency'
import type { PaymentOrder } from '@/types/payment'
import Icon from '@/components/icons/Icon.vue'
import QRCode from 'qrcode'
import alipayIcon from '@/assets/icons/alipay.svg'
import wxpayIcon from '@/assets/icons/wxpay.svg'
import paymentIcon from '@/assets/icons/payment.svg'
import {
  createAlipayDeepLinkLauncher,
  type AlipayDeepLinkLauncher,
  type AlipayDeepLinkState,
} from './alipayDeepLink'
import { normalizePaymentNavigationUrl } from './paymentFlow'
import { AppSection, UiButton, UiDescriptionList, UiSpinner, UiStatusBadge } from '@/components/ui'

const props = defineProps<{
  orderId: number
  amount?: number
  payAmount?: number
  qrCode: string
  expiresAt: string
  paymentType: string
  payUrl?: string
  orderType?: string
  currency?: string
  outTradeNo?: string
  mobileAlipayDeepLink?: boolean
}>()

type PaymentOutcome = 'success' | 'cancelled' | 'expired' | 'failed'

const emit = defineEmits<{ done: []; success: []; settled: [outcome: PaymentOutcome] }>()

const i18n = useI18n()
const { t } = i18n
const paymentStore = usePaymentStore()
const appStore = useAppStore()

const qrCanvas = ref<HTMLCanvasElement | null>(null)
const qrUrl = ref('')
const remainingSeconds = ref(0)
const cancelling = ref(false)
const paidOrder = ref<PaymentOrder | null>(null)
const deepLinkState = ref<AlipayDeepLinkState>('idle')
const deepLinkFallbackVisible = ref(false)
const paymentCurrency = computed(() => normalizePaymentCurrency(props.currency))
const safePayUrl = computed(() => normalizePaymentNavigationUrl(props.payUrl))
const creditedAmountSymbol = currencySymbol('USD')
const localeCode = computed(() => {
  const raw = i18n.locale as unknown
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'value' in raw) {
    return String((raw as { value?: string }).value || '')
  }
  return undefined
})

// Terminal outcome: null = still active, or a settled payment outcome.
const outcome = ref<PaymentOutcome | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let verifyAttempts = 0
let lastVerifyAt = 0
let alipayLauncher: AlipayDeepLinkLauncher | null = null

const VERIFY_RETRY_INTERVAL_MS = 15000
const VERIFY_RETRY_MAX_ATTEMPTS = 6

const isAlipay = computed(() => isBuiltInAlipayMethod(props.paymentType))
const isWxpay = computed(() => isBuiltInWxpayMethod(props.paymentType))
const isMobileAlipayDeepLink = computed(() => props.mobileAlipayDeepLink === true && isAlipay.value && !!qrUrl.value)
const showQRCode = computed(() => !!qrUrl.value && (!isMobileAlipayDeepLink.value || deepLinkFallbackVisible.value))

const qrLogoIcon = computed(() => {
  if (isAlipay.value) return alipayIcon
  if (isWxpay.value) return wxpayIcon
  return paymentIcon
})

const scanTitle = computed(() => {
  if (isAlipay.value) return t('payment.qr.scanAlipay')
  if (isWxpay.value) return t('payment.qr.scanWxpay')
  return t('payment.qr.scanToPay')
})

const scanHint = computed(() => {
  if (isAlipay.value) return t('payment.qr.scanAlipayHint')
  if (isWxpay.value) return t('payment.qr.scanWxpayHint')
  return ''
})

const countdownDisplay = computed(() => {
  const m = Math.floor(remainingSeconds.value / 60)
  const s = remainingSeconds.value % 60
  return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0')
})

const displayPaymentAmount = computed(() => formatGatewayAmount(props.payAmount || props.amount || 0))
const displayOrderNumber = computed(() => props.outTradeNo || `#${props.orderId}`)

function formatGatewayAmount(value: number, currency?: string | null): string {
  return formatPaymentAmount(value, currency || paymentCurrency.value, localeCode.value)
}

function isSuccessStatus(status: string | null | undefined): boolean {
  return status === 'COMPLETED' || status === 'PAID' || status === 'RECHARGING'
}

function reopenPopup() {
  if (safePayUrl.value) {
    const win = window.open(safePayUrl.value, 'paymentPopup', getPaymentPopupFeatures())
    if (!win || win.closed) {
      window.location.href = safePayUrl.value
    }
  }
}

function setOutcome(next: PaymentOutcome) {
  if (outcome.value === next) return
  outcome.value = next
  emit('settled', next)
}

async function renderQR() {
  await nextTick()
  if (!showQRCode.value || !qrCanvas.value || !qrUrl.value) return
  await QRCode.toCanvas(qrCanvas.value, qrUrl.value, {
    width: 220, margin: 2,
    errorCorrectionLevel: 'M',
  })
}

function updateDeepLinkState(state: AlipayDeepLinkState) {
  deepLinkState.value = state
  if (state === 'fallback') {
    deepLinkFallbackVisible.value = true
    renderQR()
  } else if (state === 'backgrounded') {
    deepLinkFallbackVisible.value = false
  }
}

function reopenAlipay() {
  alipayLauncher?.launch()
}

function saveQRCode() {
  const canvas = qrCanvas.value
  if (!canvas) return
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = `alipay-${props.outTradeNo || props.orderId}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function tryRecoverPendingOrder(order: PaymentOrder): Promise<PaymentOrder> {
  if (!isWxpay.value && !isMobileAlipayDeepLink.value) return order
  const outTradeNo = String(order.out_trade_no || '').trim()
  if (!outTradeNo) return order
  const normalizedStatus = String(order.status || '').trim().toUpperCase()
  if (normalizedStatus !== 'PENDING') return order
  const now = Date.now()
  if (verifyAttempts >= VERIFY_RETRY_MAX_ATTEMPTS || now - lastVerifyAt < VERIFY_RETRY_INTERVAL_MS) {
    return order
  }

  lastVerifyAt = now
  verifyAttempts += 1
  try {
    const result = await paymentAPI.verifyOrder(outTradeNo)
    return result.data ?? order
  } catch {
    return order
  }
}

let pollInFlight = false
let disposed = false
async function pollStatus() {
  if (disposed || !props.orderId || outcome.value) return
  // 防重入：接口（含 verifyOrder 二次确认）响应慢于 3 秒轮询间隔时避免并发重叠请求。
  if (pollInFlight) return
  pollInFlight = true
  try {
    let order = await paymentStore.pollOrderStatus(props.orderId)
    if (disposed || !pollTimer || !order) return
    // 已进入终态则不再处理迟到的响应。
    if (outcome.value) return
    order = await tryRecoverPendingOrder(order)
    if (disposed || !pollTimer || outcome.value) return
    if (isSuccessStatus(order.status)) {
      cleanup()
      paidOrder.value = order
      setOutcome('success')
      emit('success')
    } else if (order.status === 'CANCELLED') {
      cleanup()
      setOutcome('cancelled')
    } else if (order.status === 'FAILED') {
      cleanup()
      setOutcome('failed')
    } else if (order.status === 'EXPIRED') {
      cleanup()
      setOutcome('expired')
    }
  } catch {
    // A transient poll failure must not terminate the remaining retry window.
  } finally {
    pollInFlight = false
  }
}

function startCountdown(seconds: number) {
  remainingSeconds.value = Math.max(0, seconds)
  if (remainingSeconds.value <= 0) { setOutcome('expired'); return }
  countdownTimer = setInterval(() => {
    if (disposed) return
    remainingSeconds.value--
    if (remainingSeconds.value <= 0) { setOutcome('expired'); cleanup() }
  }, 1000)
}

async function handleCancel() {
  if (!props.orderId || cancelling.value) return
  cancelling.value = true
  try {
    await paymentAPI.cancelOrder(props.orderId)
    if (disposed) return
    cleanup()
    setOutcome('cancelled')
  } catch (err: unknown) {
    if (disposed) return
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    if (!disposed) cancelling.value = false
  }
}

function handleDone() { cleanup(); emit('done') }

function cleanup() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
  alipayLauncher?.dispose()
  alipayLauncher = null
}

// Initialize on mount
qrUrl.value = props.qrCode
verifyAttempts = 0
lastVerifyAt = 0
let seconds = 30 * 60
if (props.expiresAt) {
  const expiresAtMs = Date.parse(props.expiresAt)
  seconds = Number.isFinite(expiresAtMs)
    ? Math.floor((expiresAtMs - Date.now()) / 1000)
    : 0
}
startCountdown(seconds)
if (!outcome.value) {
  pollTimer = setInterval(pollStatus, 3000)
}
renderQR()

watch([() => qrUrl.value, showQRCode], () => renderQR())
onMounted(() => {
  if (!isMobileAlipayDeepLink.value) return
  alipayLauncher = createAlipayDeepLinkLauncher({
    qrCode: qrUrl.value,
    document,
    lifecycleTarget: window,
    userAgent: window.navigator.userAgent,
    assignLocation: (url) => window.location.assign(url),
    onStateChange: updateDeepLinkState,
  })
  alipayLauncher.launch()
})
onUnmounted(() => {
  disposed = true
  cleanup()
})
</script>

<style scoped>
.payment-status { display:flex; min-width:0; flex-direction:column; gap:12px; }
.payment-status__terminal { display:flex; min-width:0; flex-direction:column; align-items:center; gap:12px; text-align:center; }
.payment-status__terminal h2 { margin:0; color:var(--ui-text); font-size:18px; line-height:26px; }
.payment-status__terminal p { max-width:620px; margin:0; color:var(--ui-text-muted); font-size:13px; line-height:20px; }
.payment-status__icon { width:48px; height:48px; }
.payment-status__icon--success { color:var(--ui-success); }
.payment-status__icon--warning { color:var(--ui-warning); }
.payment-status__icon--neutral { color:var(--ui-text-soft); }
.payment-status__icon--info { color:var(--ui-info); }
.payment-status__icon--danger { color:var(--ui-danger); }
.payment-status__countdown { display:flex; align-items:center; justify-content:center; gap:14px; }
.payment-status__countdown strong { color:var(--ui-text); font-size:24px; font-variant-numeric:tabular-nums; }
.payment-status__qr-frame { position:relative; display:grid; place-items:center; padding:14px; border:2px solid var(--ui-border); border-radius:var(--ui-radius-panel); background:var(--ui-surface); }
.payment-status__qr-frame[data-provider="alipay"] { border-color:color-mix(in srgb,#00aef0 45%,var(--ui-border)); }
.payment-status__qr-frame[data-provider="wxpay"] { border-color:color-mix(in srgb,#2bb741 45%,var(--ui-border)); }
.payment-status__qr-frame canvas { display:block; max-width:100%; }
.payment-status__qr-frame img { position:absolute; width:28px; height:28px; padding:5px; border-radius:50%; background:var(--ui-surface); object-fit:contain; }
.payment-status__actions { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; }
@media(max-width:640px){.payment-status__actions{width:100%;flex-direction:column}.payment-status__actions :deep(.ui-button){width:100%}}
</style>
