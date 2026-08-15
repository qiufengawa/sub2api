<template>
  <UiMobileTableScroller :label="t('payment.orders.title')" min-width="980px">
  <UiDataTable :columns="columns" :data="orders" :loading="loading" :mobile-table="mobileTable" :aria-label="t('payment.orders.title')">
    <template #cell-id="{ value }">
      <UiDataCell :value="`#${value}`" mono />
    </template>
    <template #cell-out_trade_no="{ value }">
      <UiDataCell :value="String(value)" mono />
    </template>
    <template v-if="showUser" #cell-user_email="{ value, row }">
      <UiDataCell :value="value || row.user_name || '#' + row.user_id" :meta="row.user_notes || undefined" />
    </template>
    <template #cell-pay_amount="{ value, row }">
      <UiDataCell
        :value="`${paymentAmountSymbol(row)}${value.toFixed(2)}`"
        :meta="paymentMeta(row)"
        mono
      />
    </template>
    <template #cell-payment_type="{ value }">
      <UiDataCell :value="t('payment.methods.' + value, value)" />
    </template>
    <template #cell-order_type="{ value }">
      <UiBadge tone="info" :label="value === 'subscription' ? t('payment.tabSubscribe') : t('payment.tabTopUp')" />
    </template>
    <template #cell-status="{ value }">
      <OrderStatusBadge :status="value" />
    </template>
    <template #cell-created_at="{ value }">
      <UiDataCell :value="formatDate(value)" />
    </template>
    <template #cell-actions="{ row }">
      <slot name="actions" :row="row" />
    </template>
  </UiDataTable>
  </UiMobileTableScroller>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PaymentOrder } from '@/types/payment'
import type { Column } from '@/components/ui'
import { UiBadge, UiDataCell, UiDataTable, UiMobileTableScroller } from '@/components/ui'
import OrderStatusBadge from '@/components/payment/OrderStatusBadge.vue'
import { currencySymbol } from '@/components/payment/currency'

const { t } = useI18n()

const props = defineProps<{
  orders: PaymentOrder[]
  loading: boolean
  showUser?: boolean
  showOrderType?: boolean
  mobileTable?: boolean
}>()

function formatDate(dateStr: string) { return new Date(dateStr).toLocaleString() }

const creditedAmountSymbol = currencySymbol('USD')

function paymentAmountSymbol(order: PaymentOrder): string {
  return currencySymbol(order.currency)
}

function paymentMeta(order: PaymentOrder): string | undefined {
  const details = []
  if (order.fee_rate > 0) details.push(`${t('payment.orders.fee')} ${order.fee_rate}%`)
  if (order.amount !== order.pay_amount) {
    details.push(`${t('payment.orders.creditedAmount')}: ${creditedAmountSymbol}${order.amount.toFixed(2)}`)
  }
  return details.join(' · ') || undefined
}

const columns = computed((): Column[] => {
  const cols: Column[] = [
    { key: 'id', label: t('payment.orders.orderId') },
    { key: 'out_trade_no', label: t('payment.orders.orderNo') },
  ]
  if (props.showUser) {
    cols.push({ key: 'user_email', label: t('payment.admin.colUser') })
  }
  cols.push(
    { key: 'pay_amount', label: t('payment.orders.payAmount') },
    ...(props.showOrderType ? [{ key: 'order_type', label: t('payment.orders.orderType') }] : []),
    { key: 'payment_type', label: t('payment.orders.paymentMethod') },
    { key: 'status', label: t('payment.orders.status') },
    { key: 'created_at', label: t('payment.orders.createdAt') },
    { key: 'actions', label: t('common.actions') },
  )
  return cols
})
</script>
