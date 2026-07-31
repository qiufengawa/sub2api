<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 sm:px-6 dark:bg-dark-900">
    <div class="w-full max-w-2xl">
      <!-- Loading -->
      <div
        v-if="loading"
        class="overflow-hidden rounded-[4px] border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="flex flex-col items-center px-6 py-10 sm:py-12">
          <div class="h-14 w-14 animate-pulse rounded-full bg-gray-100 dark:bg-dark-700"></div>
          <div class="mt-5 h-6 w-32 animate-pulse rounded-[3px] bg-gray-100 dark:bg-dark-700"></div>
          <div class="mt-3 h-4 w-56 max-w-full animate-pulse rounded-[3px] bg-gray-100 dark:bg-dark-700"></div>
        </div>
        <div class="space-y-4 border-t border-gray-100 px-5 py-6 sm:px-8 dark:border-dark-700">
          <div v-for="index in 4" :key="index" class="flex items-center justify-between gap-6">
            <div class="h-3 w-20 animate-pulse rounded-[3px] bg-gray-100 dark:bg-dark-700"></div>
            <div class="h-3 w-32 animate-pulse rounded-[3px] bg-gray-100 dark:bg-dark-700"></div>
          </div>
        </div>
      </div>
      <template v-else>
        <section
          class="overflow-hidden rounded-[4px] border border-gray-200 bg-white shadow-sm dark:border-dark-700 dark:bg-dark-800"
          aria-live="polite"
        >
          <header class="flex flex-col items-center px-5 pb-8 pt-9 text-center sm:px-8 sm:pb-9 sm:pt-10">
            <span
              class="result-icon-enter flex h-14 w-14 shrink-0 items-center justify-center rounded-full border"
              :class="isSuccess ? 'border-green-200 bg-green-50 text-green-600 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300' : isPending ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'"
            >
              <Icon v-if="isSuccess" name="check" size="lg" />
              <Icon v-else-if="isPending" name="refresh" size="md" class="animate-spin" />
              <Icon v-else name="exclamationCircle" size="md" />
            </span>
            <h1 class="mt-5 text-2xl font-semibold text-gray-950 dark:text-white">{{ statusTitle }}</h1>
            <p class="mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">{{ statusDescription }}</p>

            <div v-if="showPrimaryAmount" class="mt-6">
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ primaryAmountLabel }}</p>
              <p class="mt-1 text-3xl font-semibold tabular-nums text-gray-950 dark:text-white">{{ primaryAmountValue }}</p>
              <p v-if="showPaidAmountBelowPrimary" class="mt-1.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                {{ t('payment.orders.payAmount') }} {{ formatGatewayAmount(paymentOrder.pay_amount) }}
              </p>
            </div>
          </header>

          <div v-if="order" class="border-t border-gray-100 px-5 py-6 sm:px-8 dark:border-dark-700">
            <div class="mb-3 flex items-center justify-between gap-4">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('payment.result.receiptTitle') }}</h2>
              <OrderStatusBadge :status="displayOrderStatus(order.status)" />
            </div>

            <dl class="divide-y divide-gray-100 dark:divide-dark-700">
              <div v-if="order.out_trade_no" class="flex min-w-0 items-start justify-between gap-6 py-3">
                <dt class="shrink-0 text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.orderNo') }}</dt>
                <dd class="min-w-0 break-all text-right font-mono text-xs leading-5 text-gray-900 dark:text-gray-100">{{ order.out_trade_no }}</dd>
              </div>
              <div v-if="hasOrderId(order)" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.orderId') }}</dt>
                <dd class="font-medium tabular-nums text-gray-900 dark:text-white">#{{ order.id }}</dd>
              </div>
              <div v-if="hasPaymentType(order)" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.paymentMethod') }}</dt>
                <dd class="flex min-w-0 items-center justify-end gap-2 font-medium text-gray-900 dark:text-white">
                  <img :src="paymentMethodIcon" alt="" class="h-5 w-5 shrink-0 object-contain" />
                  <span class="truncate" :title="paymentMethodLabel">{{ paymentMethodLabel }}</span>
                </dd>
              </div>
              <div v-if="hasAmountFields(order)" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.baseAmount') }}</dt>
                <dd class="font-medium tabular-nums text-gray-900 dark:text-white">{{ formatGatewayAmount(baseAmount) }}</dd>
              </div>
              <div v-if="hasAmountFields(order) && order.fee_rate > 0" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.fee') }} <span class="text-xs">({{ order.fee_rate }}%)</span></dt>
                <dd class="font-medium tabular-nums text-gray-900 dark:text-white">{{ formatGatewayAmount(feeAmount) }}</dd>
              </div>
              <div v-if="hasAmountFields(order)" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.payAmount') }}</dt>
                <dd class="font-semibold tabular-nums text-gray-950 dark:text-white">{{ formatGatewayAmount(order.pay_amount) }}</dd>
              </div>
              <div v-if="showCreditedAmountRow" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ creditedAmountLabel }}</dt>
                <dd class="font-semibold tabular-nums text-green-600 dark:text-green-400">${{ paymentOrder.amount.toFixed(2) }}</dd>
              </div>
              <div v-if="orderTimestamp" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ orderTimestampLabel }}</dt>
                <dd class="text-right text-sm tabular-nums text-gray-900 dark:text-gray-100">{{ formatOrderDateTime(orderTimestamp) }}</dd>
              </div>
            </dl>
          </div>

          <!-- EasyPay return info (when no order loaded) -->
          <div v-else-if="returnInfo" class="border-t border-gray-100 px-5 py-6 sm:px-8 dark:border-dark-700">
            <h2 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('payment.result.receiptTitle') }}</h2>
            <dl class="divide-y divide-gray-100 dark:divide-dark-700">
              <div v-if="returnInfo.outTradeNo" class="flex min-w-0 items-start justify-between gap-6 py-3">
                <dt class="shrink-0 text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.orderNo') }}</dt>
                <dd class="min-w-0 break-all text-right font-mono text-xs leading-5 text-gray-900 dark:text-gray-100">{{ returnInfo.outTradeNo }}</dd>
              </div>
              <div v-if="returnInfo.money" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.payAmount') }}</dt>
                <dd class="font-semibold tabular-nums text-gray-950 dark:text-white">{{ formatGatewayAmount(Number(returnInfo.money) || 0) }}</dd>
              </div>
              <div v-if="returnInfo.type" class="flex items-center justify-between gap-6 py-3">
                <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('payment.orders.paymentMethod') }}</dt>
                <dd class="font-medium text-gray-900 dark:text-white">{{ t(paymentMethodI18nKey(returnInfo.type), normalizedOrderPaymentType(returnInfo.type)) }}</dd>
              </div>
            </dl>
          </div>

          <footer class="flex flex-col gap-2 border-t border-gray-100 px-5 py-5 sm:flex-row sm:justify-end sm:px-8 dark:border-dark-700">
            <button type="button" data-test="payment-result-secondary" class="btn btn-secondary order-2 w-full sm:order-1 sm:w-auto" @click="router.push(secondaryActionPath)">
              {{ secondaryActionLabel }}
            </button>
            <button type="button" data-test="payment-result-primary" class="btn btn-primary order-1 w-full sm:order-2 sm:w-auto" @click="router.push(primaryActionPath)">
              {{ primaryActionLabel }}
              <Icon name="arrowRight" size="sm" class="ml-1.5" />
            </button>
          </footer>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import OrderStatusBadge from '@/components/payment/OrderStatusBadge.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import {
  PAYMENT_RECOVERY_STORAGE_KEY,
  clearPaymentRecoverySnapshot,
  readPaymentRecoverySnapshot,
} from '@/components/payment/paymentFlow'
import { usePaymentStore } from '@/stores/payment'
import { paymentAPI } from '@/api/payment'
import type { PublicOrderVerifyResult } from '@/api/payment'
import type { OrderStatus, PaymentOrder } from '@/types/payment'
import { formatPaymentAmount, normalizePaymentCurrency } from '@/components/payment/currency'
import { formatOrderDateTime } from '@/components/payment/orderUtils'
import { isBuiltInAlipayMethod, isBuiltInWxpayMethod } from '@/components/payment/providerConfig'
import { normalizePaymentMethodForDisplay, paymentMethodI18nKey } from './paymentUx'
import alipayIcon from '@/assets/icons/alipay.svg'
import wxpayIcon from '@/assets/icons/wxpay.svg'
import stripeIcon from '@/assets/icons/stripe.svg'
import airwallexIcon from '@/assets/icons/airwallex.svg'
import paymentIcon from '@/assets/icons/payment.svg'

const i18n = useI18n()
const { t } = i18n
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const paymentStore = usePaymentStore()

type ResolvedOrder = PaymentOrder | PublicOrderVerifyResult

const order = ref<ResolvedOrder | null>(null)
const loading = ref(true)
const currency = ref('CNY')

interface ReturnInfo {
  outTradeNo: string
  money: string
  type: string
  tradeStatus: string
}
const returnInfo = ref<ReturnInfo | null>(null)

const SUCCESS_STATUSES = new Set(['COMPLETED', 'PAID', 'RECHARGING'])
const PENDING_STATUSES = new Set(['PENDING', 'CREATED', 'WAITING', 'PROCESSING'])
const TERMINAL_FAILURE_STATUSES = new Set(['EXPIRED', 'CANCELLED', 'FAILED'])
const KNOWN_ORDER_STATUSES = new Set<OrderStatus>([
  'PENDING',
  'PAID',
  'RECHARGING',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
  'FAILED',
  'REFUND_REQUESTED',
  'REFUNDING',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'REFUND_FAILED',
])
const STATUS_REFRESH_INTERVAL_MS = 2000
const STATUS_REFRESH_MAX_ATTEMPTS = 15

let statusRefreshTimer: ReturnType<typeof setTimeout> | null = null
const refreshAttempts = ref(0)

/** 充值金额 = pay_amount / (1 + fee_rate/100)，fee_rate=0 时等于 pay_amount */
const baseAmount = computed(() => {
  if (!hasAmountFields(order.value)) return 0
  const feeRate = Number(order.value.fee_rate) || 0
  if (feeRate <= 0) return order.value.pay_amount ?? 0
  return Math.round((order.value.pay_amount / (1 + feeRate / 100)) * 100) / 100
})

/** 手续费 = pay_amount - baseAmount */
const feeAmount = computed(() => {
  if (!hasAmountFields(order.value)) return 0
  const feeRate = Number(order.value.fee_rate) || 0
  if (feeRate <= 0) return 0
  return Math.round((order.value.pay_amount - baseAmount.value) * 100) / 100
})

const localeCode = computed(() => {
  const raw = i18n.locale as unknown
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && 'value' in raw) {
    return String((raw as { value?: string }).value || '')
  }
  return undefined
})

const isSuccess = computed(() => {
  return isSuccessStatus(order.value?.status)
})

const isPending = computed(() => {
  return !!order.value && isPendingStatus(order.value.status)
})

const isCompleted = computed(() => normalizeOrderStatus(order.value?.status) === 'COMPLETED')

const paymentOrder = computed<PaymentOrder>(() => order.value as PaymentOrder)

const isSubscriptionOrder = computed(() => {
  return !!order.value && 'order_type' in order.value && order.value.order_type === 'subscription'
})

const statusTitleKey = computed(() => {
  if (isSuccess.value) {
    return isSubscriptionOrder.value && isCompleted.value
      ? 'payment.result.subscriptionSuccess'
      : 'payment.result.success'
  }
  if (isPending.value) {
    return 'payment.result.processing'
  }
  return 'payment.result.failed'
})

const statusTitle = computed(() => t(statusTitleKey.value))

const statusDescription = computed(() => {
  if (isCompleted.value) {
    return isSubscriptionOrder.value
      ? t('payment.result.subscriptionCompletedHint')
      : t('payment.result.balanceCompletedHint')
  }
  if (isSuccess.value) {
    return t('payment.result.paidProcessingHint')
  }
  if (isPending.value) {
    return t('payment.result.processingHint')
  }
  return t('payment.result.failedHint')
})

watch(
  [loading, statusTitleKey, () => appStore.siteName],
  ([isLoading, titleKey, siteName]) => {
    if (typeof document === 'undefined') return
    const resolvedTitleKey = isLoading ? 'payment.result.processing' : titleKey
    route.meta.titleKey = resolvedTitleKey
    const label = t(resolvedTitleKey)
    const normalizedSiteName = String(siteName || '').trim()
    document.title = normalizedSiteName ? `${label} - ${normalizedSiteName}` : label
  },
  { immediate: true },
)

const showPrimaryAmount = computed(() => hasAmountFields(order.value))

const primaryAmountLabel = computed(() => {
  if (isCompleted.value && !isSubscriptionOrder.value) {
    return t('payment.orders.creditedAmount')
  }
  return t('payment.orders.payAmount')
})

const primaryAmountValue = computed(() => {
  if (!hasAmountFields(order.value)) return ''
  if (isCompleted.value && order.value.order_type === 'balance') {
    return `$${order.value.amount.toFixed(2)}`
  }
  return formatGatewayAmount(order.value.pay_amount)
})

const showPaidAmountBelowPrimary = computed(() => {
  return hasAmountFields(order.value) && isCompleted.value && order.value.order_type === 'balance'
})

const showCreditedAmountRow = computed(() => {
  return hasAmountFields(order.value) && order.value.order_type === 'balance'
})

const creditedAmountLabel = computed(() => {
  return isCompleted.value
    ? t('payment.orders.creditedAmount')
    : t('payment.result.expectedCredit')
})

const paymentMethodLabel = computed(() => {
  if (!hasPaymentType(order.value)) return ''
  return t(paymentMethodI18nKey(order.value.payment_type), normalizedOrderPaymentType(order.value.payment_type))
})

const paymentMethodIcon = computed(() => {
  if (!hasPaymentType(order.value)) return paymentIcon
  const method = normalizedOrderPaymentType(order.value.payment_type)
  if (isBuiltInAlipayMethod(method)) return alipayIcon
  if (isBuiltInWxpayMethod(method)) return wxpayIcon
  if (method === 'stripe') return stripeIcon
  if (method === 'airwallex') return airwallexIcon
  return paymentIcon
})

const orderTimestamp = computed(() => {
  if (!hasOrderId(order.value)) return ''
  return order.value.completed_at || order.value.paid_at || ''
})

const orderTimestampLabel = computed(() => {
  if (!hasOrderId(order.value)) return ''
  return order.value.completed_at
    ? t('payment.result.completedAt')
    : t('payment.result.paidAt')
})

const primaryActionPath = computed(() => {
  if (!isSuccess.value) return isPending.value ? '/orders' : '/purchase'
  if (!isCompleted.value) return '/orders'
  return isSubscriptionOrder.value ? '/subscriptions' : '/dashboard'
})

const primaryActionLabel = computed(() => {
  if (!isSuccess.value) return isPending.value
    ? t('payment.result.viewOrders')
    : t('payment.result.retryPayment')
  if (!isCompleted.value) return t('payment.result.viewOrders')
  return isSubscriptionOrder.value
    ? t('payment.result.viewSubscriptions')
    : t('payment.result.backToDashboard')
})

const secondaryActionPath = computed(() => {
  if (isPending.value || (isSuccess.value && !isCompleted.value)) return '/dashboard'
  return '/orders'
})

const secondaryActionLabel = computed(() => {
  if (isPending.value || (isSuccess.value && !isCompleted.value)) {
    return t('payment.result.backToDashboard')
  }
  return t('payment.result.viewOrders')
})

function normalizedOrderPaymentType(paymentType: string): string {
  return normalizePaymentMethodForDisplay(paymentType || '') || paymentType || ''
}

function formatGatewayAmount(value: number): string {
  return formatPaymentAmount(value, currency.value, localeCode.value)
}

function setResolvedOrder(nextOrder: ResolvedOrder | null): void {
  order.value = nextOrder
  if (nextOrder && 'currency' in nextOrder && nextOrder.currency) {
    currency.value = normalizePaymentCurrency(nextOrder.currency)
  }
}

function hasOrderId(nextOrder: ResolvedOrder | null): nextOrder is PaymentOrder {
  return !!nextOrder && 'id' in nextOrder && typeof nextOrder.id === 'number'
}

function hasAmountFields(nextOrder: ResolvedOrder | null): nextOrder is PaymentOrder {
  return !!nextOrder && 'pay_amount' in nextOrder && typeof nextOrder.pay_amount === 'number' && 'amount' in nextOrder && typeof nextOrder.amount === 'number'
}

function hasPaymentType(nextOrder: ResolvedOrder | null): nextOrder is PaymentOrder {
  return !!nextOrder && 'payment_type' in nextOrder && typeof nextOrder.payment_type === 'string' && nextOrder.payment_type.trim() !== ''
}

function normalizeOrderStatus(status: string | null | undefined): string {
  return String(status || '').trim().toUpperCase()
}

function displayOrderStatus(status: string): OrderStatus {
  const normalized = normalizeOrderStatus(status) as OrderStatus
  return KNOWN_ORDER_STATUSES.has(normalized) ? normalized : 'PENDING'
}

function isSuccessStatus(status: string | null | undefined): boolean {
  return SUCCESS_STATUSES.has(normalizeOrderStatus(status))
}

function isPendingStatus(status: string | null | undefined): boolean {
  const normalized = normalizeOrderStatus(status)
  if (!normalized) return false
  return PENDING_STATUSES.has(normalized)
    || (!SUCCESS_STATUSES.has(normalized) && !TERMINAL_FAILURE_STATUSES.has(normalized))
}

function readRouteQueryString(key: string): string {
  const value = route.query[key]
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }
  return typeof value === 'string' ? value : ''
}

function restoreRecoverySnapshot(context: {
  resumeToken: string
  routeOrderId: number
  routeOutTradeNo: string
}) {
  if (typeof window === 'undefined') {
    return null
  }

  const rawSnapshot = window.localStorage.getItem(PAYMENT_RECOVERY_STORAGE_KEY)
  if (!rawSnapshot) {
    return null
  }

  if (context.resumeToken) {
    return readPaymentRecoverySnapshot(rawSnapshot, {
      resumeToken: context.resumeToken,
    })
  }

  if (!context.routeOrderId && !context.routeOutTradeNo) {
    return null
  }

  const restored = readPaymentRecoverySnapshot(rawSnapshot)
  if (!restored) {
    return null
  }

  if (context.routeOrderId > 0 && restored.orderId !== context.routeOrderId) {
    return null
  }

  if (context.routeOutTradeNo && restored.outTradeNo !== context.routeOutTradeNo) {
    return null
  }

  return restored
}

async function resolveOrderFromResumeToken(resumeToken: string): Promise<ResolvedOrder | null> {
  try {
    const result = await paymentAPI.resolveOrderPublicByResumeToken(resumeToken)
    return result.data
  } catch (_err: unknown) {
    return null
  }
}

async function resolveOrderFromOutTradeNo(outTradeNo: string): Promise<ResolvedOrder | null> {
  try {
    const result = await paymentAPI.verifyOrder(outTradeNo)
    return result.data
  } catch (_err: unknown) {
    try {
      const result = await paymentAPI.verifyOrderPublic(outTradeNo)
      return result.data
    } catch (_innerErr: unknown) {
      return null
    }
  }
}

function clearStatusRefreshTimer(): void {
  if (statusRefreshTimer !== null) {
    clearTimeout(statusRefreshTimer)
    statusRefreshTimer = null
  }
}

function clearRecoverySnapshot(): void {
  if (typeof window === 'undefined') return
  clearPaymentRecoverySnapshot(window.localStorage, PAYMENT_RECOVERY_STORAGE_KEY)
}

function clearRecoverySnapshotForTerminalStatus(status: string | null | undefined): void {
  const normalized = normalizeOrderStatus(status)
  if (SUCCESS_STATUSES.has(normalized) || TERMINAL_FAILURE_STATUSES.has(normalized)) {
    clearRecoverySnapshot()
  }
}

function scheduleStatusRefresh(refreshOrder: (() => Promise<ResolvedOrder | null>) | null): void {
  clearStatusRefreshTimer()
  if (!refreshOrder || !isPending.value || refreshAttempts.value >= STATUS_REFRESH_MAX_ATTEMPTS) {
    return
  }

  statusRefreshTimer = setTimeout(async () => {
    refreshAttempts.value += 1
    const refreshedOrder = await refreshOrder()
    if (refreshedOrder) {
      setResolvedOrder(refreshedOrder)
      clearRecoverySnapshotForTerminalStatus(refreshedOrder.status)
    }

    if (isPendingStatus(order.value?.status)) {
      scheduleStatusRefresh(refreshOrder)
    }
  }, STATUS_REFRESH_INTERVAL_MS)
}

onMounted(async () => {
  const resumeToken = readRouteQueryString('resume_token')
  const routeOrderId = Number(readRouteQueryString('order_id')) || 0
  let outTradeNo = readRouteQueryString('out_trade_no')
  let orderId = 0
  let resumeTokenLookupFailed = false

  const restored = restoreRecoverySnapshot({
    resumeToken,
    routeOrderId,
    routeOutTradeNo: outTradeNo,
  })
  if (restored?.orderId) {
    orderId = restored.orderId
  }
  if (restored?.currency) {
    currency.value = normalizePaymentCurrency(restored.currency)
  }
  if (!outTradeNo && restored?.outTradeNo) {
    outTradeNo = restored.outTradeNo
  }

  if (resumeToken) {
    const resolvedOrder = await resolveOrderFromResumeToken(resumeToken)
    if (resolvedOrder) {
      setResolvedOrder(resolvedOrder)
      if (!orderId) {
        orderId = hasOrderId(resolvedOrder) ? resolvedOrder.id : 0
      }
    } else if (routeOrderId > 0) {
      resumeTokenLookupFailed = true
      orderId = routeOrderId
    } else {
      resumeTokenLookupFailed = true
    }
  } else if (routeOrderId > 0) {
    orderId = routeOrderId
  }

  const hasLegacyFallbackContext = readRouteQueryString('trade_status').trim() !== ''
  const shouldUsePublicOutTradeNo = outTradeNo !== '' && (hasLegacyFallbackContext || routeOrderId > 0 || orderId > 0)

  if (!order.value && orderId && (!resumeToken || routeOrderId > 0)) {
    try {
      setResolvedOrder(await paymentStore.pollOrderStatus(orderId))
    } catch (_err: unknown) {
      // Order lookup failed, will try legacy fallback below when possible.
    }
  }

  if (!order.value && shouldUsePublicOutTradeNo && (!resumeToken || resumeTokenLookupFailed)) {
    const legacyOrder = await resolveOrderFromOutTradeNo(outTradeNo)
    if (legacyOrder) {
      setResolvedOrder(legacyOrder)
      if (!orderId) {
        orderId = hasOrderId(legacyOrder) ? legacyOrder.id : 0
      }
    }
  }

  if (!order.value && !orderId && outTradeNo && hasLegacyFallbackContext) {
    returnInfo.value = {
      outTradeNo,
      money: String(route.query.money || ''),
      type: String(route.query.type || ''),
      tradeStatus: String(route.query.trade_status || ''),
    }
  }

  const refreshOrder = async (): Promise<ResolvedOrder | null> => {
    if (resumeToken) {
      const resolvedOrder = await resolveOrderFromResumeToken(resumeToken)
      if (resolvedOrder) {
        return resolvedOrder
      }
    }

    if (orderId) {
      try {
        return await paymentStore.pollOrderStatus(orderId)
      } catch (_err: unknown) {
        // Fall through to legacy public verification when order polling is unavailable.
      }
    }

    if (shouldUsePublicOutTradeNo) {
      return await resolveOrderFromOutTradeNo(outTradeNo)
    }

    return null
  }

  if (isPendingStatus(order.value?.status)) {
    scheduleStatusRefresh(refreshOrder)
  } else if (order.value) {
    clearRecoverySnapshotForTerminalStatus(order.value.status)
  } else if (returnInfo.value) {
    clearRecoverySnapshot()
  }
  loading.value = false
})

onBeforeUnmount(() => {
  clearStatusRefreshTimer()
})
</script>

<style scoped>
@keyframes result-icon-enter {
  from {
    opacity: 0;
    transform: scale(0.82);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.result-icon-enter {
  animation: result-icon-enter 320ms ease-out both;
}

@media (prefers-reduced-motion: reduce) {
  .result-icon-enter {
    animation: none;
  }
}
</style>
