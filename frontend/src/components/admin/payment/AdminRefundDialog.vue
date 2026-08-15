<template>
  <UiDialog
    :show="show"
    :title="t('payment.admin.refundOrder')"
    :close-label="t('common.close')"
    width="normal"
    @close="emit('cancel')"
  >
    <form id="refund-form" @submit.prevent="handleSubmit">
      <AppStack :gap="16">
      <AppSection
        v-if="order?.refund_requested_at || order?.refund_request_reason"
        :title="t('payment.admin.refundRequestInfo')"
        divided
      >
        <UiDescriptionList :items="refundRequestItems" :columns="1" />
      </AppSection>

      <UiDescriptionList :items="orderSummaryItems" :columns="1" />

      <UiCheckbox v-model="form.deduct_balance">
        <UiDataCell :value="t('payment.admin.deductBalance')" :meta="t('payment.admin.deductBalanceHint')" />
      </UiCheckbox>

      <UiDescriptionList
        v-if="form.deduct_balance && userBalance != null"
        :items="balanceItems"
        :columns="2"
      />

      <UiAlert
        v-if="form.deduct_balance && balanceInsufficient"
        tone="warning"
        :message="t('payment.admin.insufficientBalance')"
      />

      <UiAlert
        v-if="!form.deduct_balance"
        tone="info"
        :message="t('payment.admin.noDeduction')"
      />

      <UiTextField
        :model-value="form.amount"
        type="number"
        inputmode="decimal"
        step="0.01"
        min="0.01"
        :max="maxRefundable"
        :label="t('payment.admin.refundAmount')"
        :description="`${t('payment.admin.maxRefundable')}: ${creditedAmountSymbol}${maxRefundable.toFixed(2)}`"
        required
        @update:model-value="setAmount"
      >
        <template #prefix>{{ creditedAmountSymbol }}</template>
      </UiTextField>

      <UiTextArea
        v-model="form.reason"
        :label="t('payment.admin.refundReason')"
        :placeholder="t('payment.admin.refundReasonPlaceholder')"
        :rows="3"
        required
      />

      <UiAlert v-if="warning" tone="warning" :message="warning" />

      <UiCheckbox v-if="requireForce" v-model="form.force">
        {{ t('payment.admin.forceRefund') }}
      </UiCheckbox>
      </AppStack>
    </form>

    <template #footer>
      <AppInline justify="flex-end">
        <UiButton type="button" density="compact" @click="emit('cancel')">{{ t('common.cancel') }}</UiButton>
        <UiButton
          type="submit"
          form="refund-form"
          :disabled="submitting || form.amount <= 0 || (requireForce && !form.force)"
          :loading="submitting"
          variant="danger"
          density="compact"
        >
          {{ t('payment.admin.confirmRefund') }}
        </UiButton>
      </AppInline>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PaymentOrder } from '@/types/payment'
import { formatOrderDateTime } from '@/components/payment/orderUtils'
import { currencySymbol } from '@/components/payment/currency'
import {
  AppInline,
  AppSection,
  AppStack,
  UiAlert,
  UiButton,
  UiCheckbox,
  UiDataCell,
  UiDescriptionList,
  UiDialog,
  UiTextArea,
  UiTextField,
} from '@/components/ui'

const { t } = useI18n()

const props = defineProps<{
  show: boolean
  order: PaymentOrder | null
  submitting?: boolean
  userBalance?: number | null
  requireForce?: boolean
  warning?: string
}>()

const emit = defineEmits<{
  (e: 'confirm', data: { amount: number; reason: string; deduct_balance: boolean; force: boolean }): void
  (e: 'cancel'): void
}>()

const creditedAmountSymbol = currencySymbol('USD')

const paymentAmountSymbol = computed(() => currencySymbol(props.order?.currency))

const form = reactive({
  amount: 0,
  reason: '',
  deduct_balance: true,
  force: false,
})

// In REFUND_REQUESTED / REFUND_PENDING status, refund_amount is requested/pending, not actually refunded.
// Only PARTIALLY_REFUNDED / REFUNDED have real refund amounts.
const actuallyRefunded = computed(() => {
  if (!props.order) return 0
  const s = props.order.status
  if (s === 'PARTIALLY_REFUNDED' || s === 'REFUNDED') return props.order.refund_amount || 0
  return 0
})

const maxRefundable = computed(() => {
  if (!props.order) return 0
  return props.order.amount - actuallyRefunded.value
})

const balanceInsufficient = computed(() => {
  if (props.userBalance == null || !props.order) return false
  return props.userBalance < props.order.amount
})

const refundRequestItems = computed(() => {
  const items: Array<{ key?: string; label: string; value: string | number }> = []
  if (props.order?.refund_requested_at) {
    items.push({ key: 'requestedAt', label: t('payment.admin.refundRequestedAt'), value: formatDateTime(props.order.refund_requested_at) })
  }
  if (props.order?.refund_request_reason) {
    items.push({ key: 'reason', label: t('payment.admin.refundRequestReason'), value: props.order.refund_request_reason })
  }
  return items
})

const orderSummaryItems = computed(() => {
  const order = props.order
  if (!order) return []
  const items: Array<{ key?: string; label: string; value: string | number; numeric?: boolean }> = [
    { key: 'orderId', label: t('payment.orders.orderId'), value: `#${order.id}` },
    { key: 'creditedAmount', label: t('payment.orders.creditedAmount'), value: `${creditedAmountSymbol}${order.amount.toFixed(2)}`, numeric: true },
    { key: 'payAmount', label: t('payment.orders.payAmount'), value: `${paymentAmountSymbol.value}${order.pay_amount.toFixed(2)}`, numeric: true },
  ]
  if (actuallyRefunded.value > 0) {
    items.push({ key: 'alreadyRefunded', label: t('payment.admin.alreadyRefunded'), value: `${creditedAmountSymbol}${actuallyRefunded.value.toFixed(2)}`, numeric: true })
  }
  return items
})

const balanceItems = computed(() => [
  { key: 'userBalance', label: t('payment.admin.userBalance'), value: `${creditedAmountSymbol}${(props.userBalance || 0).toFixed(2)}`, numeric: true },
  { key: 'orderAmount', label: t('payment.admin.orderAmount'), value: `${creditedAmountSymbol}${(props.order?.amount || 0).toFixed(2)}`, numeric: true },
])

watch(() => props.show, (val) => {
  if (val && props.order) {
    // For REFUND_REQUESTED, pre-fill with the requested amount
    if (props.order.status === 'REFUND_REQUESTED' && props.order.refund_amount) {
      form.amount = props.order.refund_amount
    } else {
      form.amount = maxRefundable.value
    }
    form.reason = props.order.refund_request_reason || ''
    form.deduct_balance = true
    form.force = false
  }
})

function formatDateTime(dateStr: string): string {
  return formatOrderDateTime(dateStr)
}

function setAmount(value: string) {
  const amount = Number(value)
  form.amount = Number.isFinite(amount) ? amount : 0
}

function handleSubmit() {
  if (form.amount <= 0 || form.amount > maxRefundable.value) return
  if (props.requireForce && !form.force) return
  emit('confirm', { ...form })
}
</script>
