<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('nav.orderManagement')" />

      <UiServerTableWorkspace
        :loading="ordersLoading"
        :empty="!ordersLoading && orders.length === 0"
        :empty-title="t('payment.admin.noData')"
      >
        <template #filters>
          <UiFilterBar :active-count="activeAdvancedFilterCount" @clear="clearAdvancedFilters">
            <UiSearchInput
              v-model="orderSearch"
              :placeholder="t('payment.admin.searchOrders')"
              density="compact"
              @search="loadOrders"
            />
            <UiSelect
              v-model="orderFilters.status"
              :label="t('payment.orders.status')"
              :options="statusFilterOptions"
              density="compact"
              @change="loadOrders"
            />
            <div
              id="admin-orders-advanced-filters"
              v-show="advancedFiltersOpen || activeAdvancedFilterCount > 0"
              style="display: contents"
            >
              <UiSelect
                v-model="orderFilters.payment_type"
                :label="t('payment.orders.paymentMethod')"
                :options="paymentTypeFilterOptions"
                density="compact"
                @change="loadOrders"
              />
              <UiSelect
                v-model="orderFilters.order_type"
                :label="t('payment.admin.orderType')"
                :options="orderTypeFilterOptions"
                density="compact"
                @change="loadOrders"
              />
            </div>
            <template #actions>
              <UiButton
                type="button"
                variant="secondary"
                density="compact"
                :aria-expanded="advancedFiltersOpen"
                aria-controls="admin-orders-advanced-filters"
                data-testid="admin-orders-advanced-toggle"
                @click="advancedFiltersOpen = !advancedFiltersOpen"
              >
                <template #icon><Icon name="filter" size="sm" /></template>
                {{ t('payment.admin.advancedFilters') }}
                <Icon :name="advancedFiltersOpen ? 'chevronUp' : 'chevronDown'" size="xs" />
              </UiButton>
              <UiIconButton
                icon="refresh"
                variant="ghost"
                density="compact"
                :disabled="ordersLoading"
                :label="t('common.refresh')"
                @click="loadOrders"
              />
            </template>
          </UiFilterBar>
        </template>

        <OrderTable :orders="orders" :loading="false" show-user mobile-table>
          <template #actions="{ row }">
            <AppInline justify="flex-end" :wrap="false">
              <UiIconButton icon="eye" variant="ghost" density="compact" :label="t('common.view')" @click="showOrderDetail(row)" />
              <UiIconButton v-if="row.status === 'PENDING'" icon="x" variant="danger" density="compact" :disabled="cancelingOrderIds.has(row.id)" :label="t('payment.orders.cancel')" @click="handleCancelOrder(row)" />
              <UiIconButton v-if="row.status === 'FAILED'" icon="refresh" variant="ghost" density="compact" :disabled="retryingOrderIds.has(row.id)" :label="t('payment.admin.retry')" @click="handleRetryOrder(row)" />
              <template v-if="row.status === 'REFUND_REQUESTED'">
                <UiBadge v-if="row.refund_amount" tone="info" :label="`${creditedAmountSymbol}${row.refund_amount.toFixed(2)}`" />
                <UiIconButton icon="check" variant="success" density="compact" :disabled="refundSubmitting" :label="t('payment.admin.approveRefund')" @click="openRefundDialog(row)" />
              </template>
              <UiIconButton v-else-if="row.status === 'REFUND_FAILED'" icon="refresh" variant="danger" density="compact" :disabled="refundSubmitting" :label="t('payment.admin.retryRefund')" @click="openRefundDialog(row)" />
              <UiIconButton
                v-else-if="row.status === 'REFUND_PENDING'"
                variant="ghost"
                density="compact"
                :disabled="refundQueryingIds.has(row.id)"
                :label="t('payment.admin.queryRefundStatus')"
                @click="handleQueryRefund(row)"
              >
                <UiSpinner size="sm" />
              </UiIconButton>
              <UiIconButton v-else-if="row.status === 'COMPLETED' || row.status === 'PARTIALLY_REFUNDED'" icon="dollar" variant="danger" density="compact" :disabled="refundSubmitting" :label="t('payment.admin.refund')" @click="openRefundDialog(row)" />
            </AppInline>
          </template>
        </OrderTable>

        <template #pagination>
          <UiPagination
            v-if="orderPagination.total > 0"
            :page="orderPagination.page"
            :total="orderPagination.total"
            :page-size="orderPagination.page_size"
            :reset-page-on-page-size-change="false"
            @update:page="handleOrderPageChange"
            @update:pageSize="handleOrderPageSizeChange"
          />
        </template>
      </UiServerTableWorkspace>
    </AppPage>

    <UiDialog
      :show="showDetailDialog"
      :title="t('payment.admin.orderDetail')"
      :close-label="t('common.close')"
      width="wide"
      @close="closeOrderDetail"
    >
      <AppStack v-if="selectedOrder" :gap="16">
        <UiDescriptionList :items="orderDetailItems" :columns="2" data-testid="order-detail-grid">
          <template #status><OrderStatusBadge :status="selectedOrder.status" /></template>
        </UiDescriptionList>

        <AppSection v-if="selectedOrder.refund_requested_at" :title="t('payment.admin.refundRequestInfo')" divided>
          <UiDescriptionList :items="refundRequestItems" :columns="2" />
        </AppSection>

        <AppSection v-if="orderAuditLogs.length > 0" :title="t('payment.admin.auditLogs')">
          <UiTimeline :items="orderAuditTimelineItems" />
        </AppSection>
      </AppStack>
    </UiDialog>

    <AdminRefundDialog :show="showRefundDialog" :order="selectedOrder" :submitting="refundSubmitting" :require-force="refundRequireForce" :warning="refundWarning" @confirm="handleRefund" @cancel="closeRefundDialog" />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminPaymentAPI } from '@/api/admin/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import { formatOrderDateTime } from '@/components/payment/orderUtils'
import type { PaymentOrder } from '@/types/payment'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import AdminRefundDialog from '@/components/admin/payment/AdminRefundDialog.vue'
import OrderStatusBadge from '@/components/payment/OrderStatusBadge.vue'
import OrderTable from '@/components/payment/OrderTable.vue'
import { currencySymbol } from '@/components/payment/currency'
import {
  AppPage,
  AppPageHeader,
  AppInline,
  AppSection,
  AppStack,
  UiBadge,
  UiButton,
  UiDescriptionList,
  UiDialog,
  UiFilterBar,
  UiIconButton,
  UiPagination,
  UiSearchInput,
  UiSelect,
  UiServerTableWorkspace,
  UiSpinner,
  UiTimeline,
} from '@/components/ui'

interface AuditLog {
  id: number
  action: string
  detail: string | null
  operator: string | null
  created_at: string
}

const { t } = useI18n()
const appStore = useAppStore()

const ordersLoading = ref(false)
const orders = ref<PaymentOrder[]>([])
const orderSearch = ref('')
const orderFilters = reactive({ status: '', payment_type: '', order_type: '' })
const advancedFiltersOpen = ref(false)
const orderPagination = reactive({ page: 1, page_size: 20, total: 0 })
const selectedOrder = ref<PaymentOrder | null>(null)
const showDetailDialog = ref(false)
const showRefundDialog = ref(false)
const refundSubmitting = ref(false)
const refundRequireForce = ref(false)
const refundWarning = ref('')
const refundQueryingIds = ref(new Set<number>())
const cancelingOrderIds = ref(new Set<number>())
const retryingOrderIds = ref(new Set<number>())
const orderAuditLogs = ref<AuditLog[]>([])
const creditedAmountSymbol = currencySymbol('USD')
const activeAdvancedFilterCount = computed(() =>
  Number(Boolean(orderFilters.payment_type)) + Number(Boolean(orderFilters.order_type))
)
let ordersRequestId = 0
let detailRequestId = 0
let refundRequestId = 0

const orderDetailItems = computed(() => {
  const order = selectedOrder.value
  if (!order) return []
  const items: Array<{ key?: string; label: string; value: string | number; numeric?: boolean }> = [
    { key: 'id', label: t('payment.orders.orderId'), value: `#${order.id}` },
    { key: 'orderNo', label: t('payment.orders.orderNo'), value: order.out_trade_no },
    { key: 'status', label: t('payment.orders.status'), value: order.status },
    { key: 'amount', label: t('payment.orders.amount'), value: `${creditedAmountSymbol}${order.amount.toFixed(2)}`, numeric: true },
    { key: 'payAmount', label: t('payment.orders.payAmount'), value: `${paymentAmountSymbol(order)}${order.pay_amount.toFixed(2)}`, numeric: true },
    { key: 'paymentMethod', label: t('payment.orders.paymentMethod'), value: t(`payment.methods.${order.payment_type}`, order.payment_type) },
    { key: 'feeRate', label: t('payment.admin.feeRate'), value: `${order.fee_rate}%`, numeric: true },
    { key: 'createdAt', label: t('payment.orders.createdAt'), value: formatDateTime(order.created_at) },
    { key: 'expiresAt', label: t('payment.admin.expiresAt'), value: formatDateTime(order.expires_at) },
  ]
  if (order.paid_at) items.push({ key: 'paidAt', label: t('payment.admin.paidAt'), value: formatDateTime(order.paid_at) })
  if (order.refund_amount) {
    items.push({ key: 'refundAmount', label: t('payment.admin.refundAmount'), value: `${creditedAmountSymbol}${order.refund_amount.toFixed(2)}`, numeric: true })
  }
  if (order.refund_reason) items.push({ key: 'refundReason', label: t('payment.admin.refundReason'), value: order.refund_reason })
  return items
})

const refundRequestItems = computed(() => {
  const order = selectedOrder.value
  if (!order?.refund_requested_at) return []
  return [
    { key: 'requestedAt', label: t('payment.admin.refundRequestedAt'), value: formatDateTime(order.refund_requested_at) },
    { key: 'requestedBy', label: t('payment.admin.refundRequestedBy'), value: `#${order.refund_requested_by}` },
    { key: 'requestReason', label: t('payment.admin.refundRequestReason'), value: order.refund_request_reason || '-' },
  ]
})

const orderAuditTimelineItems = computed(() => orderAuditLogs.value.map((log) => ({
  key: String(log.id),
  title: log.action,
  time: formatDateTime(log.created_at),
  description: [log.detail, log.operator ? `${t('payment.admin.operator')}: ${log.operator}` : null].filter(Boolean).join(' · ') || undefined,
  icon: 'clipboard' as const,
})))

function paymentAmountSymbol(order: PaymentOrder | null | undefined): string {
  return currencySymbol(order?.currency)
}

async function loadOrders() {
  const requestId = ++ordersRequestId
  ordersLoading.value = true
  try {
    const res = await adminPaymentAPI.getOrders({
      page: orderPagination.page, page_size: orderPagination.page_size,
      keyword: orderSearch.value || undefined, status: orderFilters.status || undefined,
      payment_type: orderFilters.payment_type || undefined, order_type: orderFilters.order_type || undefined,
    })
    if (requestId !== ordersRequestId) return
    orders.value = res.data.items || []
    orderPagination.total = res.data.total || 0
  } catch (err: unknown) {
    if (requestId !== ordersRequestId) return
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    if (requestId === ordersRequestId) ordersLoading.value = false
  }
}

function handleOrderPageChange(page: number) { orderPagination.page = page; loadOrders() }
function handleOrderPageSizeChange(size: number) { orderPagination.page_size = size; orderPagination.page = 1; loadOrders() }

function clearAdvancedFilters() {
  orderFilters.payment_type = ''
  orderFilters.order_type = ''
  orderPagination.page = 1
  loadOrders()
}

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

async function showOrderDetail(order: PaymentOrder) {
  const requestId = ++detailRequestId
  selectedOrder.value = order
  orderAuditLogs.value = []
  showDetailDialog.value = true
  try {
    const res = await adminPaymentAPI.getOrder(order.id)
    const data = res.data as unknown as Record<string, unknown>
    if (requestId !== detailRequestId) return
    if (data.order) selectedOrder.value = data.order as PaymentOrder
    orderAuditLogs.value = ((data.auditLogs || data.audit_logs || []) as unknown) as AuditLog[]
  } catch (_err: unknown) { /* keep cached order data */ }
}

function closeOrderDetail() {
  detailRequestId += 1
  showDetailDialog.value = false
}

async function handleCancelOrder(order: PaymentOrder) {
  if (cancelingOrderIds.value.has(order.id)) return
  cancelingOrderIds.value = new Set(cancelingOrderIds.value).add(order.id)
  try { await adminPaymentAPI.cancelOrder(order.id); appStore.showSuccess(t('payment.admin.orderCancelled')); await loadOrders() }
  catch (err: unknown) { appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))) }
  finally { const next = new Set(cancelingOrderIds.value); next.delete(order.id); cancelingOrderIds.value = next }
}

async function handleRetryOrder(order: PaymentOrder) {
  if (retryingOrderIds.value.has(order.id)) return
  retryingOrderIds.value = new Set(retryingOrderIds.value).add(order.id)
  try { await adminPaymentAPI.retryRecharge(order.id); appStore.showSuccess(t('payment.admin.retrySuccess')); await loadOrders() }
  catch (err: unknown) { appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))) }
  finally { const next = new Set(retryingOrderIds.value); next.delete(order.id); retryingOrderIds.value = next }
}

function openRefundDialog(order: PaymentOrder) {
  if (refundSubmitting.value) return
  refundRequestId += 1
  selectedOrder.value = order
  refundRequireForce.value = false
  refundWarning.value = ''
  showRefundDialog.value = true
}

function closeRefundDialog() {
  refundRequestId += 1
  showRefundDialog.value = false
  refundRequireForce.value = false
  refundWarning.value = ''
}

function isRefundPendingWarning(warning: string | undefined): boolean {
  return /pending|处理中|待/.test(String(warning || '').toLowerCase())
}

async function handleRefund(data: { amount: number; reason: string; deduct_balance: boolean; force: boolean }) {
  if (refundSubmitting.value || !selectedOrder.value) return
  const order = selectedOrder.value
  const requestId = ++refundRequestId
  refundSubmitting.value = true
  try {
    const res = await adminPaymentAPI.refundOrder(order.id, { amount: data.amount, reason: data.reason, deduct_balance: data.deduct_balance, force: data.force })
    if (requestId !== refundRequestId || selectedOrder.value?.id !== order.id) return
    if (res.data.success) {
      appStore.showSuccess(t('payment.admin.refundSuccess'))
      closeRefundDialog()
      await loadOrders()
      return
    }
    if (isRefundPendingWarning(res.data.warning)) {
      appStore.showSuccess(t('payment.admin.refundPending'))
      closeRefundDialog()
      await loadOrders()
      return
    }
    if (res.data.require_force) {
      // Backend needs an explicit force confirmation (e.g. the user spent their
      // balance after requesting the refund). Keep the dialog open and surface
      // the force checkbox instead of dropping the admin back to the list.
      refundRequireForce.value = true
      refundWarning.value = res.data.warning || ''
      return
    }
    appStore.showError(res.data.warning || t('common.error'))
  } catch (err: unknown) { appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error'))) }
  finally { refundSubmitting.value = false }
}

async function handleQueryRefund(order: PaymentOrder) {
  if (refundQueryingIds.value.has(order.id)) return
  refundQueryingIds.value = new Set(refundQueryingIds.value).add(order.id)
  try {
    const res = await adminPaymentAPI.queryRefund(order.id)
    if (res.data.success) {
      appStore.showSuccess(t('payment.admin.refundSuccess'))
    } else if (isRefundPendingWarning(res.data.warning)) {
      appStore.showSuccess(t('payment.admin.refundPending'))
    } else {
      appStore.showError(res.data.warning || t('common.error'))
    }
    await loadOrders()
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    const next = new Set(refundQueryingIds.value)
    next.delete(order.id)
    refundQueryingIds.value = next
  }
}

function formatDateTime(dateStr: string): string { return formatOrderDateTime(dateStr) }

onMounted(() => loadOrders())
</script>
