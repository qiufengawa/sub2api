<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('payment.orders.title')" />
      <UiServerTableWorkspace
        :loading="loading"
        :empty="!loading && !loadError && orders.length === 0"
        :empty-title="t('payment.orders.empty')"
        :empty-description="t('payment.orders.empty')"
        :aria-busy="loading"
      >
      <template #filters>
        <UiFilterBar>
          <UiSelect
            v-model="currentFilter"
            :options="statusFilters"
            :label="t('payment.orders.status')"
            density="compact"
            @update:model-value="handleFilterChange"
          />
          <UiBadge tone="info" :label="t('payment.orders.totalCount', { count: pagination.total })" />
          <template #actions>
            <UiIconButton icon="refresh" density="compact" :label="t('common.refresh')" :disabled="loading" @click="fetchOrders" />
            <UiButton variant="primary" density="compact" @click="router.push('/purchase')">
              <template #icon><Icon name="plus" size="sm" /></template>
              {{ t('payment.result.backToRecharge') }}
            </UiButton>
          </template>
        </UiFilterBar>
      </template>

        <UiAlert
          v-if="loadError && orders.length > 0"
          tone="danger"
          :title="t('payment.orders.loadFailed')"
          :message="t('payment.orders.loadFailedDescription')"
          data-testid="orders-refresh-error"
        />
        <UiSkeleton
          v-if="loading && orders.length === 0"
          variant="rect"
          width="100%"
          height="260px"
          data-testid="orders-skeleton"
        />
        <UiErrorState
          v-else-if="loadError && orders.length === 0"
          :title="t('payment.orders.loadFailed')"
          :description="t('payment.orders.loadFailedDescription')"
          :retry-text="t('common.retry')"
          data-testid="orders-error"
          @retry="fetchOrders"
        />
        <OrderTable v-else :orders="orders" :loading="loading" show-order-type mobile-table>
          <template #actions="{ row }">
            <div class="flex items-center justify-end gap-1">
              <UiIconButton icon="eye" variant="ghost" density="dense" :label="t('common.view')" @click="showOrderDetail(row)" />
              <UiButton v-if="row.status === 'PENDING'" variant="quiet" density="dense" @click="handleCancel(row.id)">
                <template #icon><Icon name="x" size="xs" /></template>
                {{ t('payment.orders.cancel') }}
              </UiButton>
              <UiButton v-if="canRequestRefund(row)" variant="secondary" density="dense" :disabled="actionLoading" @click="openRefundDialog(row)">
                <template #icon><Icon name="dollar" size="xs" /></template>
                {{ t('payment.orders.requestRefund') }}
              </UiButton>
            </div>
          </template>
        </OrderTable>

      <template #pagination>
        <UiPagination
          v-if="pagination.total > 0"
          :page="pagination.page"
          :total="pagination.total"
          :page-size="pagination.page_size"
          :reset-page-on-page-size-change="false"
          @update:page="handlePageChange"
          @update:pageSize="handlePageSizeChange"
        />
      </template>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Cancel Confirm Dialog -->
    <UiConfirmDialog
      :show="!!cancelTargetId"
      :title="t('payment.orders.cancel')"
      :message="t('payment.confirmCancel')"
      :confirm-text="actionLoading ? t('common.processing') : t('payment.orders.cancel')"
      :cancel-text="t('common.cancel')"
      :pending="actionLoading"
      :danger="true"
      @confirm="confirmCancel"
      @cancel="cancelTargetId = null"
    />

    <!-- Refund Dialog -->
    <UiDialog
      :show="!!refundTarget"
      :title="t('payment.orders.requestRefund')"
      :close-on-escape="!actionLoading"
      :show-close-button="!actionLoading"
      @close="closeRefundDialog"
    >
      <div v-if="refundTarget" class="space-y-4">
        <dl class="order-refund-summary">
          <div><dt>{{ t('payment.orders.orderId') }}</dt><dd>#{{ refundTarget.id }}</dd></div>
          <div><dt>{{ t('payment.orders.amount') }}</dt><dd>{{ currencySymbol(refundTarget.currency) }}{{ refundTarget.amount.toFixed(2) }}</dd></div>
        </dl>
        <div>
          <UiTextArea
            v-model="refundReason"
            :label="t('payment.refundReason')"
            :placeholder="t('payment.refundReasonPlaceholder')"
            :rows="3"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UiButton density="compact" :disabled="actionLoading" @click="closeRefundDialog">{{ t('common.cancel') }}</UiButton>
          <UiButton variant="primary" density="compact" :disabled="actionLoading || !refundReason.trim()" :loading="actionLoading" @click="confirmRefund">
            {{ t('payment.orders.requestRefund') }}
          </UiButton>
        </div>
      </template>
    </UiDialog>

    <UiDialog
      :show="!!detailTarget"
      :title="t('payment.admin.orderDetail')"
      width="wide"
      :close-label="t('common.close')"
      @close="closeOrderDetail"
    >
      <UiErrorState
        v-if="detailError"
        :title="t('payment.orders.detailLoadFailed')"
        :retry-text="t('common.retry')"
        @retry="loadOrderDetail"
      />
      <UiSkeleton v-else-if="detailLoading" variant="rect" width="100%" height="180px" />
      <AppStack v-else-if="detailTarget" :gap="16">
        <UiDescriptionList :items="orderDetailItems" :columns="2">
          <template #status><OrderStatusBadge :status="detailTarget.status" /></template>
        </UiDescriptionList>
        <AppSection v-if="orderTimeline.length" :title="t('payment.orders.timeline')">
          <UiTimeline :items="orderTimeline" />
        </AppSection>
      </AppStack>
    </UiDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores'
import { paymentAPI } from '@/api/payment'
import { extractI18nErrorMessage } from '@/utils/apiError'
import type { PaymentOrder } from '@/types/payment'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import OrderTable from '@/components/payment/OrderTable.vue'
import OrderStatusBadge from '@/components/payment/OrderStatusBadge.vue'
import { currencySymbol } from '@/components/payment/currency'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiConfirmDialog,
  UiDescriptionList,
  UiErrorState,
  UiFilterBar,
  UiIconButton,
  UiPagination,
  UiSkeleton,
  UiSelect,
  UiServerTableWorkspace,
  UiTextArea,
  UiDialog,
  UiTimeline,
} from '@/components/ui'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const loading = ref(false)
const loadError = ref(false)
const actionLoading = ref(false)
const orders = ref<PaymentOrder[]>([])
const refundEligibleProviders = ref<Set<string>>(new Set())
const currentFilter = ref('')
const cancelTargetId = ref<number | null>(null)
const refundTarget = ref<PaymentOrder | null>(null)
const refundReason = ref('')
const detailTarget = ref<PaymentOrder | null>(null)
const detailLoading = ref(false)
const detailError = ref(false)
const pagination = reactive({ page: 1, page_size: 20, total: 0 })
let ordersRequestId = 0
let detailRequestId = 0

const statusFilters = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'PENDING', label: t('payment.status.pending') },
  { value: 'COMPLETED', label: t('payment.status.completed') },
  { value: 'FAILED', label: t('payment.status.failed') },
  { value: 'PAID', label: t('payment.status.paid') },
  { value: 'RECHARGING', label: t('payment.status.recharging') },
  { value: 'EXPIRED', label: t('payment.status.expired') },
  { value: 'CANCELLED', label: t('payment.status.cancelled') },
  { value: 'REFUND_REQUESTED', label: t('payment.status.refund_requested') },
  { value: 'REFUNDING', label: t('payment.status.refunding') },
  { value: 'REFUND_PENDING', label: t('payment.status.refund_pending') },
  { value: 'PARTIALLY_REFUNDED', label: t('payment.status.partially_refunded') },
  { value: 'REFUND_FAILED', label: t('payment.status.refund_failed') },
  { value: 'REFUNDED', label: t('payment.status.refunded') },
])

async function fetchOrders() {
  const requestId = ++ordersRequestId
  loading.value = true
  loadError.value = false
  try {
    const res = await paymentAPI.getMyOrders({
      page: pagination.page,
      page_size: pagination.page_size,
      status: currentFilter.value || undefined,
    })
    if (requestId !== ordersRequestId) return
    orders.value = res.data.items || []
    pagination.total = res.data.total || 0
  } catch (err: unknown) {
    if (requestId !== ordersRequestId) return
    loadError.value = true
    if (orders.value.length > 0) appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    if (requestId === ordersRequestId) loading.value = false
  }
}

function handlePageChange(page: number) { pagination.page = page; fetchOrders() }
function handlePageSizeChange(size: number) { pagination.page_size = size; pagination.page = 1; fetchOrders() }
function handleFilterChange() { pagination.page = 1; fetchOrders() }

function handleCancel(orderId: number) { cancelTargetId.value = orderId }

async function confirmCancel() {
  if (actionLoading.value || !cancelTargetId.value) return
  actionLoading.value = true
  try {
    await paymentAPI.cancelOrder(cancelTargetId.value)
    appStore.showSuccess(t('common.success'))
    cancelTargetId.value = null
    await fetchOrders()
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    actionLoading.value = false
  }
}

function openRefundDialog(order: PaymentOrder) {
  if (actionLoading.value) return
  refundTarget.value = order
  refundReason.value = ''
}

function closeRefundDialog() {
  if (actionLoading.value) return
  refundTarget.value = null
  refundReason.value = ''
}

const orderDetailItems = computed(() => {
  const order = detailTarget.value
  if (!order) return []
  return [
    { key: 'id', label: t('payment.orders.orderId'), value: `#${order.id}`, mono: true },
    { key: 'orderNo', label: t('payment.orders.orderNo'), value: order.out_trade_no, mono: true },
    { key: 'status', label: t('payment.orders.status'), value: order.status },
    { key: 'amount', label: t('payment.orders.amount'), value: `${currencySymbol(order.currency)}${order.amount.toFixed(2)}`, numeric: true },
    { key: 'payAmount', label: t('payment.orders.payAmount'), value: `${currencySymbol(order.currency)}${order.pay_amount.toFixed(2)}`, numeric: true },
    { key: 'paymentMethod', label: t('payment.orders.paymentMethod'), value: t(`payment.methods.${order.payment_type}`, order.payment_type) },
    { key: 'createdAt', label: t('payment.orders.createdAt'), value: formatDate(order.created_at) },
    { key: 'expiresAt', label: t('payment.admin.expiresAt'), value: formatDate(order.expires_at) },
    ...(order.paid_at ? [{ key: 'paidAt', label: t('payment.admin.paidAt'), value: formatDate(order.paid_at) }] : []),
    ...(order.completed_at ? [{ key: 'completedAt', label: t('payment.admin.completedAt'), value: formatDate(order.completed_at) }] : []),
  ]
})

const orderTimeline = computed(() => {
  const order = detailTarget.value
  if (!order) return []
  type OrderTimelineItem = { key: string; title: string; time: string; icon: 'clock' | 'check' | 'checkCircle' | 'refresh'; tone: 'neutral' | 'success' | 'warning' }
  const events: OrderTimelineItem[] = [{ key: 'created', title: t('payment.orders.createdAt'), time: formatDate(order.created_at), icon: 'clock', tone: 'neutral' }]
  if (order.paid_at) events.push({ key: 'paid', title: t('payment.admin.paidAt'), time: formatDate(order.paid_at), icon: 'check' as const, tone: 'success' as const })
  if (order.completed_at) events.push({ key: 'completed', title: t('payment.admin.completedAt'), time: formatDate(order.completed_at), icon: 'checkCircle' as const, tone: 'success' as const })
  if (order.refund_requested_at) events.push({ key: 'refund', title: t('payment.orders.requestRefund'), time: formatDate(order.refund_requested_at), icon: 'refresh' as const, tone: 'warning' as const })
  return events
})

function formatDate(value: string | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

function showOrderDetail(order: PaymentOrder) {
  detailTarget.value = order
  detailLoading.value = true
  detailError.value = false
  void loadOrderDetail()
}

async function loadOrderDetail() {
  const target = detailTarget.value
  if (!target) return
  const requestId = ++detailRequestId
  detailLoading.value = true
  detailError.value = false
  try {
    const response = await paymentAPI.getOrder(target.id)
    if (requestId !== detailRequestId) return
    detailTarget.value = response.data
  } catch {
    if (requestId !== detailRequestId) return
    detailError.value = true
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false
  }
}

function closeOrderDetail() {
  detailRequestId += 1
  detailTarget.value = null
  detailError.value = false
}

async function confirmRefund() {
  if (actionLoading.value || !refundTarget.value || !refundReason.value.trim()) return
  const target = refundTarget.value
  const reason = refundReason.value.trim()
  actionLoading.value = true
  try {
    await paymentAPI.requestRefund(target.id, { reason })
    appStore.showSuccess(t('common.success'))
    if (refundTarget.value?.id === target.id) {
      refundTarget.value = null
      refundReason.value = ''
    }
    await fetchOrders()
  } catch (err: unknown) {
    appStore.showError(extractI18nErrorMessage(err, t, 'payment.errors', t('common.error')))
  } finally {
    actionLoading.value = false
  }
}

function canRequestRefund(order: PaymentOrder): boolean {
  if (order.status !== 'COMPLETED') return false
  if (!order.provider_instance_id) return false
  return refundEligibleProviders.value.has(order.provider_instance_id)
}

async function loadRefundEligibility() {
  try {
    const res = await paymentAPI.getRefundEligibleProviders()
    refundEligibleProviders.value = new Set(res.data.provider_instance_ids || [])
  } catch { /* ignore — default to hiding refund button */ }
}

onMounted(() => { fetchOrders(); loadRefundEligibility() })
</script>

<style scoped>
.order-refund-summary {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--ui-border-soft);
  border-radius: var(--ui-radius);
  background: var(--ui-surface-muted);
}
.order-refund-summary div { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.order-refund-summary dt { color: var(--ui-text-muted); font-size: 12px; }
.order-refund-summary dd { margin: 0; color: var(--ui-text); font-size: 13px; font-variant-numeric: tabular-nums; }
.order-refund-summary div:first-child dd { font-family: var(--ui-font-mono); }
</style>
