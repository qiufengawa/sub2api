<template>
  <div class="space-y-4">
    <div class="ui-panel p-4">
      <div class="flex flex-wrap items-center gap-3">
        <UiSearchInput
          v-model="searchQuery"
          class="flex-1 sm:max-w-64"
          density="compact"
          :placeholder="t('payment.admin.searchOrders')"
          @search="emitFiltersChanged"
        />
        <UiSelect
          v-model="filters.status"
          :options="statusFilterOptions"
          class="w-36"
          density="compact"
          @change="emitFiltersChanged"
        />
        <UiSelect
          v-model="filters.payment_type"
          :options="paymentTypeFilterOptions"
          class="w-40"
          density="compact"
          @change="emitFiltersChanged"
        />
        <UiSelect
          v-model="filters.order_type"
          :options="orderTypeFilterOptions"
          class="w-36"
          density="compact"
          @change="emitFiltersChanged"
        />
        <div class="flex flex-1 flex-wrap items-center justify-end gap-2">
          <UiIconButton
            @click="emit('refresh')"
            :disabled="loading"
            icon="refresh"
            density="compact"
            :label="t('common.refresh')"
          />
        </div>
      </div>
    </div>

    <UiDataTable :columns="columns" :data="orders" :loading="loading" :aria-label="t('payment.orders.title')">
      <template #cell-id="{ value }">
        <span class="font-mono text-sm">#{{ value }}</span>
      </template>

      <template #cell-user_id="{ value }">
        <span class="text-sm text-gray-600 dark:text-gray-400">#{{ value }}</span>
      </template>

      <template #cell-pay_amount="{ value, row }">
        <div class="text-sm">
          <span class="font-medium text-gray-900 dark:text-white">{{ paymentAmountSymbol(row) }}{{ value.toFixed(2) }}</span>
          <span v-if="row.fee_rate > 0" class="ml-1 text-xs text-gray-400" :title="t('payment.orders.fee') + ': ' + row.fee_rate + '%'">
            ({{ row.fee_rate }}%)
          </span>
          <div v-if="row.amount !== row.pay_amount" class="text-xs text-gray-500">
            {{ t('payment.orders.creditedAmount') }}: {{ creditedAmountSymbol }}{{ row.amount.toFixed(2) }}
          </div>
        </div>
      </template>

      <template #cell-payment_type="{ value }">
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {{ t('payment.methods.' + value, value) }}
        </span>
      </template>

      <template #cell-status="{ value }">
        <UiBadge :tone="statusBadgeTone(value)">
          {{ t('payment.status.' + value.toLowerCase(), value) }}
        </UiBadge>
      </template>

      <template #cell-order_type="{ value }">
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {{ t('payment.admin.' + value + 'Order', value) }}
        </span>
      </template>

      <template #cell-created_at="{ value }">
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDateTime(value) }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center gap-2">
          <UiButton density="dense" variant="quiet" @click="emit('detail', row)">
            <template #icon><Icon name="eye" size="sm" /></template>
            {{ t('common.view') }}
          </UiButton>
          <UiButton
            v-if="row.status === 'PENDING'"
            @click="emit('cancel', row)"
            density="dense"
            variant="quiet"
          >
            <template #icon><Icon name="x" size="sm" /></template>
            {{ t('payment.orders.cancel') }}
          </UiButton>
          <UiButton
            v-if="row.status === 'FAILED'"
            @click="emit('retry', row)"
            density="dense"
            variant="quiet"
          >
            <template #icon><Icon name="refresh" size="sm" /></template>
            {{ t('payment.admin.retry') }}
          </UiButton>
          <UiButton
            v-if="canRefundRow(row)"
            @click="emit('refund', row)"
            density="dense"
            variant="danger"
          >
            <template #icon><Icon name="dollar" size="sm" /></template>
            {{ t('payment.admin.refund') }}
          </UiButton>
        </div>
      </template>
    </UiDataTable>

    <UiPagination
      v-if="total > 0"
      :page="page"
      :total="total"
      :page-size="pageSize"
      @update:page="emit('update:page', $event)"
      @update:pageSize="emit('update:pageSize', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PaymentOrder } from '@/types/payment'
import Icon from '@/components/icons/Icon.vue'
import {
  UiButton,
  UiBadge,
  UiDataTable,
  UiIconButton,
  UiPagination,
  UiSearchInput,
  UiSelect,
  type Column,
} from '@/components/ui'
import { statusBadgeTone, canRefund, formatOrderDateTime } from '@/components/payment/orderUtils'
import { currencySymbol } from '@/components/payment/currency'

const { t } = useI18n()

defineProps<{
  orders: PaymentOrder[]
  loading: boolean
  page: number
  pageSize: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'detail', order: PaymentOrder): void
  (e: 'cancel', order: PaymentOrder): void
  (e: 'retry', order: PaymentOrder): void
  (e: 'refund', order: PaymentOrder): void
  (e: 'refresh'): void
  (e: 'update:page', page: number): void
  (e: 'update:pageSize', size: number): void
  (e: 'filter', filters: { keyword?: string; status?: string; payment_type?: string; order_type?: string }): void
}>()

const searchQuery = ref('')
const filters = reactive({ status: '', payment_type: '', order_type: '' })
const creditedAmountSymbol = currencySymbol('USD')

function paymentAmountSymbol(order: PaymentOrder): string {
  return currencySymbol(order.currency)
}

function emitFiltersChanged() {
  emit('filter', {
    keyword: searchQuery.value || undefined,
    status: filters.status || undefined,
    payment_type: filters.payment_type || undefined,
    order_type: filters.order_type || undefined,
  })
}

const columns = computed<Column[]>(() => [
  { key: 'id', label: t('payment.orders.orderId') },
  { key: 'user_id', label: t('payment.orders.userId') },
  { key: 'pay_amount', label: t('payment.orders.payAmount') },
  { key: 'payment_type', label: t('payment.orders.paymentMethod') },
  { key: 'status', label: t('payment.orders.status') },
  { key: 'order_type', label: t('payment.orders.orderType') },
  { key: 'created_at', label: t('payment.orders.createdAt') },
  { key: 'actions', label: t('payment.orders.actions') },
])

const statusFilterOptions = computed(() => [
  { value: '', label: t('payment.admin.allStatuses') },
  { value: 'PENDING', label: t('payment.status.pending') },
  { value: 'PAID', label: t('payment.status.paid') },
  { value: 'COMPLETED', label: t('payment.status.completed') },
  { value: 'EXPIRED', label: t('payment.status.expired') },
  { value: 'CANCELLED', label: t('payment.status.cancelled') },
  { value: 'FAILED', label: t('payment.status.failed') },
  { value: 'REFUNDED', label: t('payment.status.refunded') },
  { value: 'REFUND_REQUESTED', label: t('payment.status.refund_requested') },
  { value: 'REFUND_PENDING', label: t('payment.status.refund_pending') },
  { value: 'REFUND_FAILED', label: t('payment.status.refund_failed') },
])

const paymentTypeFilterOptions = computed(() => [
  { value: '', label: t('payment.admin.allPaymentTypes') },
  { value: 'alipay', label: t('payment.methods.alipay') },
  { value: 'wxpay', label: t('payment.methods.wxpay') },
  { value: 'stripe', label: t('payment.methods.stripe') },
  { value: 'airwallex', label: t('payment.methods.airwallex') },
])

const orderTypeFilterOptions = computed(() => [
  { value: '', label: t('payment.admin.allOrderTypes') },
  { value: 'balance', label: t('payment.admin.balanceOrder') },
  { value: 'subscription', label: t('payment.admin.subscriptionOrder') },
])

function canRefundRow(order: PaymentOrder): boolean {
  return canRefund(order.status)
}

function formatDateTime(dateStr: string): string {
  return formatOrderDateTime(dateStr)
}
</script>
