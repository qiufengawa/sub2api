<template>
  <AppLayout>
    <div class="mx-auto max-w-4xl overflow-hidden rounded border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800">
      <header class="border-b border-gray-100 px-4 py-3 dark:border-dark-700">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ qrUrl ? scanTitle : t('payment.qr.payInNewWindow') }}
        </h2>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('payment.qr.waitingPayment') }}</p>
      </header>

      <div class="grid md:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)]">
        <section class="flex min-h-[340px] items-center justify-center border-b border-gray-100 bg-gray-50/60 p-5 md:border-b-0 md:border-r dark:border-dark-700 dark:bg-dark-900/30">
          <div v-if="qrUrl" class="text-center">
            <div class="inline-block rounded border border-gray-200 bg-white p-3 dark:border-dark-700">
              <canvas ref="qrCanvas" class="mx-auto max-w-full"></canvas>
            </div>
            <p v-if="!expired && scanHint" class="mt-3 max-w-xs text-sm text-gray-500 dark:text-gray-400">{{ scanHint }}</p>
          </div>
          <a
            v-else-if="payUrl && !expired"
            :href="payUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary"
          >
            {{ t('payment.qr.openPayWindow') }}
          </a>
          <Icon v-else name="exclamationCircle" size="xl" class="text-red-500" />
        </section>

        <aside class="flex flex-col p-5">
          <div v-if="expired" class="rounded border border-red-100 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/20">
            <p class="text-sm font-medium text-red-600 dark:text-red-300">{{ t('payment.qr.expired') }}</p>
          </div>
          <div v-else class="rounded border border-primary-100 bg-primary-50/60 px-4 py-3 dark:border-primary-900 dark:bg-primary-950/20">
            <p class="text-xs text-primary-600 dark:text-primary-300">{{ qrUrl ? t('payment.qr.expiresIn') : t('payment.qr.payInNewWindowHint') }}</p>
            <p class="mt-1 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">{{ countdownDisplay }}</p>
          </div>

          <dl data-testid="qr-order-details" class="mt-4 divide-y divide-gray-100 border-y border-gray-100 text-sm dark:divide-dark-700 dark:border-dark-700">
            <div class="flex items-center justify-between gap-3 py-3">
              <dt class="text-gray-500 dark:text-gray-400">{{ t('payment.actualPay') }}</dt>
              <dd class="text-xl font-semibold tabular-nums text-primary-600 dark:text-primary-400">
                {{ paymentAmount > 0 ? formatPaymentAmount(paymentAmount, paymentCurrency) : '-' }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3 py-3">
              <dt class="text-gray-500 dark:text-gray-400">{{ t('payment.orders.orderId') }}</dt>
              <dd class="font-medium tabular-nums text-gray-900 dark:text-white">#{{ orderId || '-' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3 py-3">
              <dt class="shrink-0 text-gray-500 dark:text-gray-400">{{ t('payment.orders.paymentMethod') }}</dt>
              <dd class="min-w-0 truncate font-medium text-gray-900 dark:text-white" :title="paymentType || undefined">{{ paymentType || '-' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3 py-3">
              <dt class="text-gray-500 dark:text-gray-400">{{ t('payment.orders.status') }}</dt>
              <dd class="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                <span :class="['h-2 w-2 rounded-full', expired ? 'bg-red-500' : 'bg-primary-500']"></span>
                {{ expired ? t('payment.qr.expired') : t('payment.qr.waitingPayment') }}
              </dd>
            </div>
          </dl>

          <div class="mt-auto grid gap-2 pt-5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <button v-if="expired" class="btn btn-primary" @click="router.push('/purchase')">{{ t('payment.result.backToRecharge') }}</button>
            <button v-if="!expired && orderId" class="btn btn-secondary" :disabled="cancelling" @click="handleCancel">
              {{ cancelling ? t('common.processing') : t('payment.qr.cancelOrder') }}
            </button>
          </div>
        </aside>
      </div>
    </div>
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
const expired = ref(false)
const cancelling = ref(false)
const paymentType = ref('')
const paymentAmount = ref(0)
const paymentCurrency = ref(DEFAULT_PAYMENT_CURRENCY)

let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null

const countdownDisplay = computed(() => {
  const m = Math.floor(remainingSeconds.value / 60)
  const s = remainingSeconds.value % 60
  return m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0')
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
  if (!orderId.value) return
  // 防重入：接口响应慢于 3 秒轮询间隔时避免并发重叠请求与重复跳转。
  if (pollInFlight) return
  pollInFlight = true
  try {
    const order = await paymentStore.pollOrderStatus(orderId.value)
    if (!order) return
    paymentAmount.value = Number(order.pay_amount) || Number(order.amount) || paymentAmount.value
    paymentCurrency.value = normalizePaymentCurrency(order.currency || paymentCurrency.value)
    // 定时器已被 cleanup 清除时不再执行终态跳转（响应可能在 cleanup 后才回来）。
    if (!pollTimer) return
    if (order.status === 'COMPLETED' || order.status === 'PAID') {
      cleanup()
      router.push({ path: '/payment/result', query: { order_id: String(orderId.value), status: 'success' } })
    } else if (order.status === 'EXPIRED' || order.status === 'CANCELLED' || order.status === 'FAILED') {
      cleanup()
      expired.value = true
    }
  } finally {
    pollInFlight = false
  }
}

function startCountdown(seconds: number) {
  remainingSeconds.value = Math.max(0, seconds)
  if (remainingSeconds.value <= 0) {
    expired.value = true
    return
  }
  countdownTimer = setInterval(() => {
    remainingSeconds.value--
    if (remainingSeconds.value <= 0) {
      expired.value = true
      cleanup()
    }
  }, 1000)
}

async function handleCancel() {
  if (!orderId.value || cancelling.value) return
  cancelling.value = true
  try {
    await paymentAPI.cancelOrder(orderId.value)
    cleanup()
    router.push('/purchase')
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    cancelling.value = false
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
    const expiresAt = new Date(expiresAtStr)
    const now = new Date()
    seconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
  }
  startCountdown(seconds)
  pollTimer = setInterval(pollStatus, 3000)
  void pollStatus()
  renderQR()
})

onUnmounted(() => cleanup())
</script>
