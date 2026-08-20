<template>
  <AppLayout>
    <AppPage density="compact" width="wide">
      <AppPageHeader
        :title="qrUrl ? scanTitle : t('payment.qr.payInNewWindow')"
        :description="t('payment.qr.waitingPayment')"
      >
        <template #status>
          <UiStatusBadge
            :status="isTerminal ? 'failed' : 'pending'"
            :label="isTerminal ? terminalStatusLabel : t('payment.qr.waitingPayment')"
          />
        </template>
      </AppPageHeader>

      <AppGrid min="300px" class="payment-qr__grid">
        <AppSection class="payment-qr__code-section">
          <div v-if="qrUrl" class="text-center">
            <div class="payment-qr__canvas-wrap">
              <canvas
                ref="qrCanvas"
                class="mx-auto max-w-full"
                role="img"
                :aria-label="t('payment.qr.qrCodeLabel')"
              ></canvas>
            </div>
            <p v-if="!isTerminal && scanHint" class="payment-qr__hint">{{ scanHint }}</p>
            <a
              v-if="payUrl && !isTerminal"
              :href="payUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="payment-qr__external-link payment-qr__external-link--fallback"
            >
              {{ t('payment.qr.openPayWindow') }}
            </a>
          </div>
          <a
            v-else-if="payUrl && !isTerminal"
            :href="payUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="payment-qr__external-link"
          >
            {{ t('payment.qr.openPayWindow') }}
          </a>
          <Icon v-else name="exclamationCircle" size="xl" class="payment-qr__error-icon" />
        </AppSection>

        <AppSection class="payment-qr__details-section">
          <UiAlert
            v-if="isTerminal"
            tone="danger"
            :message="terminalStatusDescription"
          />
          <div v-else class="payment-qr__countdown" aria-live="polite">
            <span>{{ qrUrl ? t('payment.qr.expiresIn') : t('payment.qr.payInNewWindowHint') }}</span>
            <strong>{{ countdownDisplay }}</strong>
          </div>

          <UiDescriptionList
            data-testid="qr-order-details"
            class="payment-qr__details-list divide-y"
            :items="[
              { label: t('payment.actualPay'), value: paymentAmount > 0 ? formatPaymentAmount(paymentAmount, paymentCurrency) : '-', numeric: true },
              { label: t('payment.orders.orderId'), value: `#${orderId || '-'}`, numeric: true },
              { label: t('payment.orders.paymentMethod'), value: paymentType || '-' },
              { label: t('payment.orders.status'), value: isTerminal ? terminalStatusLabel : t('payment.qr.waitingPayment') },
            ]"
            :columns="1"
          />

          <div class="payment-qr__actions">
            <UiButton
              v-if="isTerminal"
              variant="primary"
              density="compact"
              block
              @click="router.push('/purchase')"
            >
              {{ t('payment.result.backToRecharge') }}
            </UiButton>
            <UiButton
              v-if="!isTerminal && orderId"
              variant="secondary"
              density="compact"
              block
              :loading="cancelling"
              @click="handleCancel"
            >
              {{ t('payment.qr.cancelOrder') }}
            </UiButton>
          </div>
        </AppSection>
      </AppGrid>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { usePaymentStore } from '@/stores/payment'
import { paymentAPI } from '@/api/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import { useAppStore } from '@/stores'
import { isBuiltInAlipayMethod, isBuiltInWxpayMethod } from '@/components/payment/providerConfig'
import QRCode from 'qrcode'
import alipayIcon from '@/assets/icons/alipay.svg'
import wxpayIcon from '@/assets/icons/wxpay.svg'
import Icon from '@/components/icons/Icon.vue'
import {
  AppGrid,
  AppPage,
  AppPageHeader,
  AppSection,
  UiAlert,
  UiButton,
  UiDescriptionList,
  UiStatusBadge,
} from '@/components/ui'
import { DEFAULT_PAYMENT_CURRENCY, formatPaymentAmount, normalizePaymentCurrency } from '@/components/payment/currency'
import { normalizePaymentNavigationUrl } from '@/components/payment/paymentFlow'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const paymentStore = usePaymentStore()
const appStore = useAppStore()

const qrCanvas = ref<HTMLCanvasElement | null>(null)
const qrUrl = ref('')
const payUrl = ref('')
const orderId = ref(0)
const remainingSeconds = ref(0)
const cancelling = ref(false)
const paymentType = ref('')
const paymentAmount = ref(0)
const paymentCurrency = ref(DEFAULT_PAYMENT_CURRENCY)
const terminalStatus = ref<'expired' | 'cancelled' | 'failed' | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let disposed = false

const countdownDisplay = computed(() => {
  const m = Math.floor(remainingSeconds.value / 60)
  const s = remainingSeconds.value % 60
  return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0')
})

const isTerminal = computed(() => terminalStatus.value !== null)
const terminalStatusLabel = computed(() => {
  switch (terminalStatus.value) {
    case 'cancelled':
      return t('payment.qr.cancelled')
    case 'failed':
      return t('payment.result.failed')
    case 'expired':
      return t('payment.qr.expired')
    default:
      return t('payment.qr.waitingPayment')
  }
})
const terminalStatusDescription = computed(() => {
  switch (terminalStatus.value) {
    case 'cancelled':
      return t('payment.qr.cancelledDesc')
    case 'failed':
      return t('payment.result.failedHint')
    case 'expired':
      return t('payment.qr.expiredDesc')
    default:
      return ''
  }
})

const isAlipay = computed(() => isBuiltInAlipayMethod(paymentType.value))
const isWxpay = computed(() => isBuiltInWxpayMethod(paymentType.value))

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

function getLogoForType(): string | null {
  if (isAlipay.value) return alipayIcon
  if (isWxpay.value) return wxpayIcon
  return null
}

async function renderQR() {
  await nextTick()
  if (!qrCanvas.value || !qrUrl.value) return

  // Use medium error correction to support logo overlay while keeping QR code scannable
  const logoSrc = getLogoForType()
  await QRCode.toCanvas(qrCanvas.value, qrUrl.value, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: logoSrc ? 'M' : 'L',
  })

  if (!logoSrc) return

  // Draw logo in center of QR code
  const canvas = qrCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const img = new Image()
  img.src = logoSrc
  img.onload = () => {
    const logoSize = 48
    const x = (canvas.width - logoSize) / 2
    const y = (canvas.height - logoSize) / 2
    // White background with rounded corners
    const pad = 5
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    const r = 6
    ctx.moveTo(x - pad + r, y - pad)
    ctx.arcTo(x + logoSize + pad, y - pad, x + logoSize + pad, y + logoSize + pad, r)
    ctx.arcTo(x + logoSize + pad, y + logoSize + pad, x - pad, y + logoSize + pad, r)
    ctx.arcTo(x - pad, y + logoSize + pad, x - pad, y - pad, r)
    ctx.arcTo(x - pad, y - pad, x + logoSize + pad, y - pad, r)
    ctx.fill()
    // Draw logo
    ctx.drawImage(img, x, y, logoSize, logoSize)
  }
}

let pollInFlight = false
async function pollStatus() {
  if (!orderId.value || disposed) return
  // 防重入：接口响应慢于 3 秒轮询间隔时避免并发重叠请求与重复跳转。
  if (pollInFlight) return
  pollInFlight = true
  try {
    const order = await paymentStore.pollOrderStatus(orderId.value)
    if (!order || disposed) return
    paymentAmount.value = Number(order.pay_amount) || Number(order.amount) || paymentAmount.value
    paymentCurrency.value = normalizePaymentCurrency(order.currency || paymentCurrency.value)
    // 定时器已被 cleanup 清除时不再执行终态跳转（响应可能在 cleanup 后才回来）。
    if (!pollTimer) return
    if (order.status === 'COMPLETED' || order.status === 'PAID' || order.status === 'RECHARGING') {
      cleanup()
      const query: Record<string, string> = {
        order_id: String(orderId.value),
        status: 'success',
      }
      const routeResumeToken = String(route.query.resume_token || '')
      const routeOutTradeNo = String(route.query.out_trade_no || '')
      if (routeResumeToken) query.resume_token = routeResumeToken
      if (routeOutTradeNo) query.out_trade_no = routeOutTradeNo
      router.push({ path: '/payment/result', query })
    } else if (order.status === 'EXPIRED' || order.status === 'CANCELLED' || order.status === 'FAILED') {
      cleanup()
      terminalStatus.value = order.status === 'CANCELLED'
        ? 'cancelled'
        : order.status === 'FAILED'
          ? 'failed'
          : 'expired'
    }
  } catch {
    // Keep the polling window alive across transient network failures.
  } finally {
    pollInFlight = false
  }
}

function startCountdown(seconds: number) {
  remainingSeconds.value = Math.max(0, seconds)
  if (remainingSeconds.value <= 0) {
    terminalStatus.value = 'expired'
    return
  }
  countdownTimer = setInterval(() => {
    if (disposed) return
    remainingSeconds.value--
    if (remainingSeconds.value <= 0) {
      terminalStatus.value = 'expired'
      cleanup()
    }
  }, 1000)
}

async function handleCancel() {
  if (!orderId.value || cancelling.value || disposed) return
  cancelling.value = true
  try {
    await paymentAPI.cancelOrder(orderId.value)
    if (disposed) return
    cleanup()
    router.push('/purchase')
  } catch (err: unknown) {
    if (disposed) return
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    if (!disposed) cancelling.value = false
  }
}

function cleanup() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

watch(qrUrl, () => renderQR())

onMounted(() => {
  orderId.value = Number(route.query.order_id) || 0
  qrUrl.value = String(route.query.qr || '')
  payUrl.value = normalizePaymentNavigationUrl(String(route.query.pay_url || ''))
  paymentType.value = String(route.query.payment_type || '')
  paymentAmount.value = Math.max(0, Number(route.query.pay_amount || route.query.amount) || 0)
  paymentCurrency.value = normalizePaymentCurrency(String(route.query.currency || DEFAULT_PAYMENT_CURRENCY))

  // Calculate countdown from expiresAt
  const expiresAtStr = String(route.query.expires_at || '')
  let seconds = 30 * 60 // fallback: 30 minutes
  if (expiresAtStr) {
    const expiresAtMs = Date.parse(expiresAtStr)
    seconds = Number.isFinite(expiresAtMs)
      ? Math.floor((expiresAtMs - Date.now()) / 1000)
      : 0
  }
  startCountdown(seconds)
  if (!isTerminal.value) {
    pollTimer = setInterval(pollStatus, 3000)
    void pollStatus()
  }
  renderQR()
})

onUnmounted(() => {
  disposed = true
  cleanup()
})
</script>
