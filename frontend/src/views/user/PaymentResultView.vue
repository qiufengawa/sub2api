<template>
  <AppPage density="comfortable" width="normal" class="payment-result-page">
    <template v-if="loading">
      <AppPageHeader :title="t('payment.result.processing')" />
      <section class="payment-result__loading" aria-live="polite" aria-busy="true">
        <UiSkeleton variant="circle" width="56px" height="56px" />
        <UiSkeleton variant="text" width="180px" height="28px" />
        <UiSkeleton variant="text" width="280px" height="20px" />
        <div class="payment-result__loading-rows">
          <div v-for="index in 4" :key="index">
            <UiSkeleton variant="text" width="90px" />
            <UiSkeleton variant="text" width="150px" />
          </div>
        </div>
      </section>
    </template>
    <template v-else>
      <AppPageHeader :title="statusTitle" :description="statusDescription">
        <template #status>
          <UiStatusBadge
            :status="resultBadgeStatus"
            :label="statusTitle"
          />
        </template>
      </AppPageHeader>

      <section class="payment-result__summary" aria-live="polite">
        <Icon v-if="isSuccess" name="checkCircle" size="lg" class="payment-result__icon payment-result__icon--success" />
        <Icon v-else-if="isRefunded" name="checkCircle" size="lg" class="payment-result__icon payment-result__icon--info" />
        <Icon v-else-if="isProcessing" name="refresh" size="lg" class="payment-result__icon payment-result__icon--pending" />
        <Icon v-else name="exclamationCircle" size="lg" class="payment-result__icon payment-result__icon--failed" />
        <div v-if="showPrimaryAmount" class="payment-result__amount">
          <span>{{ primaryAmountLabel }}</span>
          <strong>{{ primaryAmountValue }}</strong>
          <small v-if="showPaidAmountBelowPrimary">
            {{ t('payment.orders.payAmount') }} {{ formatGatewayAmount(paymentOrder.pay_amount) }}
          </small>
        </div>
      </section>

      <AppSection v-if="order || returnInfo" :title="t('payment.result.receiptTitle')" class="payment-result__receipt">
        <template #actions>
          <OrderStatusBadge v-if="order" :status="displayOrderStatus(order.status)" />
        </template>
        <UiDescriptionList
          v-if="order"
          :items="[
            ...(order.out_trade_no ? [{ key: 'orderNo', label: t('payment.orders.orderNo'), value: order.out_trade_no }] : []),
            ...(hasOrderId(order) ? [{ label: t('payment.orders.orderId'), value: `#${order.id}`, numeric: true }] : []),
            ...(hasPaymentType(order) ? [{ key: 'paymentMethod', label: t('payment.orders.paymentMethod'), value: paymentMethodLabel }] : []),
            ...(hasAmountFields(order) ? [
              { label: t('payment.orders.baseAmount'), value: formatGatewayAmount(baseAmount), numeric: true },
              ...(order.fee_rate > 0 ? [{ label: t('payment.orders.fee') + ` (${order.fee_rate}%)`, value: formatGatewayAmount(feeAmount), numeric: true }] : []),
              { label: t('payment.orders.payAmount'), value: formatGatewayAmount(order.pay_amount), numeric: true },
            ] : []),
            ...(showCreditedAmountRow ? [{ label: creditedAmountLabel, value: `$${paymentOrder.amount.toFixed(2)}`, numeric: true }] : []),
            ...(orderTimestamp ? [{ label: orderTimestampLabel, value: formatOrderDateTime(orderTimestamp) }] : []),
          ]"
          :columns="1"
        >
          <template #paymentMethod>
            <span class="payment-result__method"><img :src="paymentMethodIcon" alt="" />{{ paymentMethodLabel }}</span>
          </template>
          <template #orderNo="{ item }"><code>{{ item.value }}</code></template>
        </UiDescriptionList>
        <UiDescriptionList
          v-else
          :items="[
            ...(returnInfo?.outTradeNo ? [{ label: t('payment.orders.orderNo'), value: returnInfo.outTradeNo }] : []),
            ...(returnInfo?.money ? [{ label: t('payment.orders.payAmount'), value: formatGatewayAmount(Number(returnInfo.money) || 0), numeric: true }] : []),
            ...(returnInfo?.type ? [{ label: t('payment.orders.paymentMethod'), value: t(paymentMethodI18nKey(returnInfo.type), normalizedOrderPaymentType(returnInfo.type)) }] : []),
          ]"
          :columns="1"
        />
      </AppSection>

      <div class="payment-result__actions">
        <UiButton
          data-test="payment-result-secondary"
          variant="secondary"
          density="compact"
          @click="router.push(secondaryActionPath)"
        >
          {{ secondaryActionLabel }}
        </UiButton>
        <UiButton
          data-test="payment-result-primary"
          variant="primary"
          density="compact"
          @click="handlePrimaryAction"
        >
          <template #icon><Icon :name="lookupRetryExhausted ? 'refresh' : 'arrowRight'" size="sm" /></template>
          {{ primaryActionLabel }}
        </UiButton>
      </div>
    </template>
  </AppPage>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import OrderStatusBadge from '@/components/payment/OrderStatusBadge.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import {
  clearPaymentRecoverySnapshotForIdentity,
  readPaymentRecoverySnapshotFromStorage,
  type PaymentRecoveryIdentity,
} from '@/components/payment/paymentFlow'
import { usePaymentStore } from '@/stores/payment'
import { paymentAPI } from '@/api/payment'
import type { PublicOrderResult, PublicOrderVerifyResult } from '@/api/payment'
import type { OrderStatus, PaymentOrder } from '@/types/payment'
import { formatPaymentAmount, normalizePaymentCurrency } from '@/components/payment/currency'
import { formatOrderDateTime } from '@/components/payment/orderUtils'
import { isBuiltInAlipayMethod, isBuiltInWxpayMethod } from '@/components/payment/providerConfig'
import { normalizePaymentMethodForDisplay, paymentMethodI18nKey } from './paymentUx'
import { AppPage, AppPageHeader, AppSection, UiButton, UiDescriptionList, UiSkeleton, UiStatusBadge } from '@/components/ui'
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

type ResolvedOrder = PaymentOrder | PublicOrderResult | PublicOrderVerifyResult

const order = ref<ResolvedOrder | null>(null)
const loading = ref(true)
const lookupRetryPending = ref(false)
const lookupRetryExhausted = ref(false)
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
const REFUND_TERMINAL_STATUSES = new Set(['PARTIALLY_REFUNDED', 'REFUNDED', 'REFUND_FAILED'])
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
let retryLookup: (() => Promise<void>) | null = null
let lifecycleEpoch = 0
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

const isProcessing = computed(() => isPending.value || lookupRetryPending.value)

const isCompleted = computed(() => normalizeOrderStatus(order.value?.status) === 'COMPLETED')
const normalizedStatus = computed(() => normalizeOrderStatus(order.value?.status))
const isRefunded = computed(() => ['PARTIALLY_REFUNDED', 'REFUNDED'].includes(normalizedStatus.value))
const isRefundFailed = computed(() => normalizedStatus.value === 'REFUND_FAILED')

const resultBadgeStatus = computed(() => {
  if (isSuccess.value) return 'success'
  if (isProcessing.value) return 'pending'
  if (isRefunded.value) return 'info'
  return 'failed'
})

const paymentOrder = computed<PaymentOrder>(() => order.value as PaymentOrder)

const isSubscriptionOrder = computed(() => {
  return !!order.value && 'order_type' in order.value && order.value.order_type === 'subscription'
})

const statusTitleKey = computed(() => {
  if (normalizedStatus.value === 'REFUNDED') return 'payment.status.refunded'
  if (normalizedStatus.value === 'PARTIALLY_REFUNDED') return 'payment.status.partially_refunded'
  if (isRefundFailed.value) return 'payment.status.refund_failed'
  if (isSuccess.value) {
    return isSubscriptionOrder.value && isCompleted.value
      ? 'payment.result.subscriptionSuccess'
      : 'payment.result.success'
  }
  if (isProcessing.value) {
    return 'payment.result.processing'
  }
  return 'payment.result.failed'
})

const statusTitle = computed(() => t(statusTitleKey.value))

const statusDescription = computed(() => {
  if (normalizedStatus.value === 'REFUNDED') return t('payment.result.refundedHint')
  if (normalizedStatus.value === 'PARTIALLY_REFUNDED') return t('payment.result.partiallyRefundedHint')
  if (isRefundFailed.value) return t('payment.result.refundFailedHint')
  if (isCompleted.value) {
    return isSubscriptionOrder.value
      ? t('payment.result.subscriptionCompletedHint')
      : t('payment.result.balanceCompletedHint')
  }
  if (isSuccess.value) {
    return t('payment.result.paidProcessingHint')
  }
  if (isProcessing.value) {
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
  if (!isSuccess.value) return isProcessing.value ? '/orders' : '/purchase'
  if (!isCompleted.value) return '/orders'
  return isSubscriptionOrder.value ? '/subscriptions' : '/dashboard'
})

const primaryActionLabel = computed(() => {
  if (lookupRetryExhausted.value) return t('common.retry')
  if (!isSuccess.value) return isProcessing.value
    ? t('payment.result.viewOrders')
    : t('payment.result.retryPayment')
  if (!isCompleted.value) return t('payment.result.viewOrders')
  return isSubscriptionOrder.value
    ? t('payment.result.viewSubscriptions')
    : t('payment.result.backToDashboard')
})

const secondaryActionPath = computed(() => {
  if (isProcessing.value || (isSuccess.value && !isCompleted.value)) return '/dashboard'
  return '/orders'
})

const secondaryActionLabel = computed(() => {
  if (isProcessing.value || (isSuccess.value && !isCompleted.value)) {
    return t('payment.result.backToDashboard')
  }
  return t('payment.result.viewOrders')
})

function handlePrimaryAction(): void {
  if (lookupRetryExhausted.value && retryLookup) {
    void retryLookup()
    return
  }
  void router.push(primaryActionPath.value)
}

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

function hasOrderId(nextOrder: ResolvedOrder | null): nextOrder is PaymentOrder | PublicOrderResult {
  return !!nextOrder && 'id' in nextOrder && typeof nextOrder.id === 'number'
}

function hasAmountFields(nextOrder: ResolvedOrder | null): nextOrder is PaymentOrder | PublicOrderResult {
  return !!nextOrder && 'pay_amount' in nextOrder && typeof nextOrder.pay_amount === 'number' && 'amount' in nextOrder && typeof nextOrder.amount === 'number'
}

function hasPaymentType(nextOrder: ResolvedOrder | null): nextOrder is PaymentOrder | PublicOrderResult {
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
    || (!SUCCESS_STATUSES.has(normalized)
      && !TERMINAL_FAILURE_STATUSES.has(normalized)
      && !REFUND_TERMINAL_STATUSES.has(normalized))
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

  if (!context.resumeToken && !context.routeOrderId && !context.routeOutTradeNo) {
    return null
  }

  const restored = readPaymentRecoverySnapshotFromStorage(window.localStorage, {
    resumeToken: context.resumeToken,
    orderId: context.routeOrderId,
    outTradeNo: context.routeOutTradeNo,
  })
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

function clearRecoverySnapshot(identity: PaymentRecoveryIdentity): void {
  if (typeof window === 'undefined') return
  clearPaymentRecoverySnapshotForIdentity(window.localStorage, identity)
}

function clearRecoverySnapshotForTerminalStatus(
  status: string | null | undefined,
  identity: PaymentRecoveryIdentity,
): void {
  const normalized = normalizeOrderStatus(status)
  if (
    SUCCESS_STATUSES.has(normalized)
    || TERMINAL_FAILURE_STATUSES.has(normalized)
    || REFUND_TERMINAL_STATUSES.has(normalized)
  ) {
    clearRecoverySnapshot(identity)
  }
}

function scheduleStatusRefresh(
  refreshOrder: (() => Promise<ResolvedOrder | null>) | null,
  identity: PaymentRecoveryIdentity,
  epoch: number,
): void {
  clearStatusRefreshTimer()
  if (
    epoch !== lifecycleEpoch
    || !refreshOrder
    || !isProcessing.value
  ) {
    return
  }
  if (refreshAttempts.value >= STATUS_REFRESH_MAX_ATTEMPTS) {
    if (lookupRetryPending.value) {
      lookupRetryPending.value = false
      lookupRetryExhausted.value = true
    }
    return
  }

  statusRefreshTimer = setTimeout(async () => {
    refreshAttempts.value += 1
    const refreshedOrder = await refreshOrder()
    if (epoch !== lifecycleEpoch) return
    if (refreshedOrder) {
      setResolvedOrder(refreshedOrder)
      lookupRetryPending.value = false
      lookupRetryExhausted.value = false
      clearRecoverySnapshotForTerminalStatus(refreshedOrder.status, identity)
    }

    if (isProcessing.value) {
      scheduleStatusRefresh(refreshOrder, identity, epoch)
    }
  }, STATUS_REFRESH_INTERVAL_MS)
}

const initializeFromRoute = async () => {
  clearStatusRefreshTimer()
  retryLookup = null
  order.value = null
  returnInfo.value = null
  lookupRetryPending.value = false
  lookupRetryExhausted.value = false
  refreshAttempts.value = 0
  loading.value = true
  const epoch = ++lifecycleEpoch
  const resumeToken = readRouteQueryString('resume_token')
  const routeOrderId = Number(readRouteQueryString('order_id')) || 0
  let outTradeNo = readRouteQueryString('out_trade_no')
  let orderId = 0
  let resumeTokenLookupFailed = false
  const recoveryIdentity: PaymentRecoveryIdentity = {
    resumeToken,
    orderId: routeOrderId,
    outTradeNo,
  }

  const restored = restoreRecoverySnapshot({
    resumeToken,
    routeOrderId,
    routeOutTradeNo: outTradeNo,
  })
  if (restored?.orderId) {
    orderId = restored.orderId
    recoveryIdentity.orderId = restored.orderId
  }
  if (restored?.currency) {
    currency.value = normalizePaymentCurrency(restored.currency)
  }
  if (!outTradeNo && restored?.outTradeNo) {
    outTradeNo = restored.outTradeNo
    recoveryIdentity.outTradeNo = restored.outTradeNo
  }

  if (resumeToken) {
    const resolvedOrder = await resolveOrderFromResumeToken(resumeToken)
    if (epoch !== lifecycleEpoch) return
    if (resolvedOrder) {
      setResolvedOrder(resolvedOrder)
      if (!orderId) {
        orderId = hasOrderId(resolvedOrder) ? resolvedOrder.id : 0
        recoveryIdentity.orderId = orderId
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
      const polledOrder = await paymentStore.pollOrderStatus(orderId)
      if (epoch !== lifecycleEpoch) return
      setResolvedOrder(polledOrder)
    } catch (_err: unknown) {
      if (epoch !== lifecycleEpoch) return
      // Order lookup failed, will try legacy fallback below when possible.
    }
  }

  if (!order.value && shouldUsePublicOutTradeNo && (!resumeToken || resumeTokenLookupFailed)) {
    const legacyOrder = await resolveOrderFromOutTradeNo(outTradeNo)
    if (epoch !== lifecycleEpoch) return
    if (legacyOrder) {
      setResolvedOrder(legacyOrder)
      if (!orderId) {
        orderId = hasOrderId(legacyOrder) ? legacyOrder.id : 0
        recoveryIdentity.orderId = orderId
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

  const hasTrustedLookupContext = resumeToken !== '' || routeOrderId > 0 || shouldUsePublicOutTradeNo
  retryLookup = async () => {
    if (epoch !== lifecycleEpoch || lookupRetryPending.value) return
    lookupRetryPending.value = true
    lookupRetryExhausted.value = false
    refreshAttempts.value = 0
    const refreshedOrder = await refreshOrder()
    if (epoch !== lifecycleEpoch) return
    if (refreshedOrder) {
      setResolvedOrder(refreshedOrder)
      lookupRetryPending.value = false
      clearRecoverySnapshotForTerminalStatus(refreshedOrder.status, recoveryIdentity)
    }
    if (isProcessing.value) {
      scheduleStatusRefresh(refreshOrder, recoveryIdentity, epoch)
    }
  }
  if (!order.value && hasTrustedLookupContext) {
    lookupRetryPending.value = true
  }

  const cleanupStatus = (order.value as ResolvedOrder | null)?.status
  if (isProcessing.value) {
    scheduleStatusRefresh(refreshOrder, recoveryIdentity, epoch)
  } else if (cleanupStatus) {
    clearRecoverySnapshotForTerminalStatus(cleanupStatus, recoveryIdentity)
  } else if (returnInfo.value && !lookupRetryPending.value) {
    clearRecoverySnapshot(recoveryIdentity)
  }
  if (epoch === lifecycleEpoch) loading.value = false
}

onMounted(initializeFromRoute)
watch(() => route.fullPath, () => { void initializeFromRoute() })

onBeforeUnmount(() => {
  lifecycleEpoch += 1
  retryLookup = null
  clearStatusRefreshTimer()
})
</script>

<style scoped>
.payment-result-page { max-width: 760px; margin-inline: auto; }
.payment-result__loading { display:flex; min-height:320px; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
.payment-result__loading-rows { width:min(100%, 520px); margin-top:24px; border-top:1px solid var(--ui-border-soft); padding-top:16px; }
.payment-result__loading-rows > div { display:flex; justify-content:space-between; gap:16px; padding:10px 0; }
.payment-result__summary { display:flex; flex-direction:column; align-items:center; gap:16px; padding:28px 0 20px; text-align:center; }
.payment-result__icon { width:48px; height:48px; }
.payment-result__icon--success { color:var(--ui-success); }
.payment-result__icon--info { color:var(--ui-info); }
.payment-result__icon--pending { color:var(--ui-warning); }
.payment-result__icon--failed { color:var(--ui-danger); }
.payment-result__amount { display:flex; flex-direction:column; align-items:center; gap:4px; }
.payment-result__amount span,.payment-result__amount small { color:var(--ui-text-muted); font-size:12px; }
.payment-result__amount strong { color:var(--ui-text); font-size:30px; font-variant-numeric:tabular-nums; }
.payment-result__method { display:inline-flex; align-items:center; gap:7px; }
.payment-result__method img { width:18px; height:18px; object-fit:contain; }
.payment-result__actions { display:flex; justify-content:flex-end; gap:8px; padding:20px 0 8px; }
@media (max-width:640px) { .payment-result__actions { flex-direction:column-reverse; } .payment-result__actions :deep(.ui-button) { width:100%; } }
</style>
