<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="pageTitle" :description="pageDescription" />

      <UiServerTableWorkspace :loading="loading">
        <template #toolbar>
          <UiTableToolbar>
            <UiSearchInput
              v-model="filters.search"
              density="compact"
              :debounce-ms="300"
              :placeholder="t('admin.affiliates.records.searchPlaceholder')"
              @search="reloadFromFirstPage"
            />
            <template #actions>
              <UiIconButton
                icon="refresh"
                density="compact"
                :label="t('common.refresh')"
                :disabled="loading"
                @click="loadRecords"
              />
            </template>
          </UiTableToolbar>
        </template>

        <template #filters>
          <UiFilterBar :active-count="activeFilterCount" @clear="resetFilters">
            <UiTextField
              v-model="filters.start_at"
              type="date"
              density="compact"
              :label="t('admin.affiliates.records.startAt')"
              @change="reloadFromFirstPage"
            />
            <UiTextField
              v-model="filters.end_at"
              type="date"
              density="compact"
              :label="t('admin.affiliates.records.endAt')"
              :error="dateRangeError"
              @change="reloadFromFirstPage"
            />
          </UiFilterBar>
        </template>

        <UiDataTable
          :columns="columns"
          :data="records"
          :loading="loading"
          :server-side-sort="true"
          :mobile-table="true"
          :row-key="recordRowKey"
          default-sort-key="created_at"
          default-sort-order="desc"
          :sort-storage-key="sortStorageKey"
          :aria-label="pageTitle"
          @sort="handleSort"
        >
          <template #cell-inviter="{ row }">
            <AppStack :gap="2">
              <UiButton density="mini" variant="quiet" @click="openUserOverview(row.inviter_id)">
                {{ row.inviter_email || '-' }}
              </UiButton>
              <UiDataCell :value="`#${row.inviter_id}`" :meta="row.inviter_username || '-'" mono />
            </AppStack>
          </template>

          <template #cell-invitee="{ row }">
            <AppStack :gap="2">
              <UiButton density="mini" variant="quiet" @click="openUserOverview(row.invitee_id)">
                {{ row.invitee_email || '-' }}
              </UiButton>
              <UiDataCell :value="`#${row.invitee_id}`" :meta="row.invitee_username || '-'" mono />
            </AppStack>
          </template>

          <template #cell-user="{ row }">
            <AppStack :gap="2">
              <UiButton density="mini" variant="quiet" @click="openUserOverview(row.user_id)">
                {{ row.user_email || '-' }}
              </UiButton>
              <UiDataCell :value="`#${row.user_id}`" :meta="row.username || '-'" mono />
            </AppStack>
          </template>

          <template #cell-aff_code="{ row }">
            <UiDataCell :value="row.aff_code || '-'" mono />
          </template>

          <template #cell-order="{ row }">
            <UiDataCell :value="`#${row.order_id}`" :meta="row.out_trade_no" mono />
          </template>

          <template #cell-payment_type="{ row }">
            {{ t('payment.methods.' + row.payment_type, row.payment_type || '-') }}
          </template>

          <template #cell-order_status="{ row }">
            <OrderStatusBadge :status="row.order_status" />
          </template>

          <template #cell-total_rebate="{ row }">
            <span class="ui-numeric">${{ formatAmount(row.total_rebate) }}</span>
          </template>

          <template #cell-order_amount="{ row }">
            <span class="ui-numeric">${{ formatAmount(row.order_amount) }}</span>
          </template>

          <template #cell-pay_amount="{ row }">
            <span class="ui-numeric">¥{{ formatAmount(row.pay_amount) }}</span>
          </template>

          <template #cell-rebate_amount="{ row }">
            <span class="ui-numeric">${{ formatAmount(row.rebate_amount) }}</span>
          </template>

          <template #cell-amount="{ row }">
            <span class="ui-numeric">${{ formatAmount(row.amount) }}</span>
          </template>

          <template #cell-balance_after="{ row }">
            <span class="ui-numeric">{{ formatNullableAmount(row.balance_after) }}</span>
          </template>

          <template #cell-available_quota_after="{ row }">
            <span class="ui-numeric">{{ formatNullableAmount(row.available_quota_after) }}</span>
          </template>

          <template #cell-frozen_quota_after="{ row }">
            <span class="ui-numeric">{{ formatNullableAmount(row.frozen_quota_after) }}</span>
          </template>

          <template #cell-history_quota_after="{ row }">
            <span class="ui-numeric">{{ formatNullableAmount(row.history_quota_after) }}</span>
          </template>

          <template #cell-created_at="{ row }">
            <time class="ui-numeric">{{ formatDateTime(row.created_at) }}</time>
          </template>

          <template #empty>
            <UiErrorState
              v-if="loadError"
              data-testid="affiliate-records-error"
              :title="t('admin.affiliates.errors.loadFailed')"
              :retry-text="t('common.retry')"
              @retry="loadRecords"
            />
            <UiEmptyState v-else :title="t('admin.affiliates.records.empty')" />
          </template>
        </UiDataTable>

        <template #pagination>
          <UiPagination
            v-if="pagination.total > 0"
            :page="pagination.page"
            :total="pagination.total"
            :page-size="pagination.page_size"
            :reset-page-on-page-size-change="false"
            :summary-label="t('pagination.showing')"
            :page-size-label="t('pagination.perPage')"
            :previous-label="t('pagination.previous')"
            :next-label="t('pagination.next')"
            @update:page="handlePageChange"
            @update:pageSize="handlePageSizeChange"
          />
        </template>
      </UiServerTableWorkspace>
    </AppPage>

    <UiDialog
      :show="overviewDialog"
      :title="t('admin.affiliates.overview.title')"
      width="normal"
      @close="closeOverview"
    >
      <AppStack v-if="overviewLoading" :gap="12">
        <UiSkeleton width="180px" height="24px" />
        <UiSkeleton height="220px" />
      </AppStack>
      <UiErrorState
        v-else-if="overviewError"
        data-testid="affiliate-overview-error"
        :title="t('admin.affiliates.overview.loadFailed')"
        :retry-text="t('common.retry')"
        @retry="retryOverview"
      />
      <UiDescriptionList v-else-if="selectedOverview" :items="overviewFacts" :columns="2" />
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton density="compact" @click="closeOverview">{{ t('common.close') }}</UiButton>
        </AppInline>
      </template>
    </UiDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import OrderStatusBadge from '@/components/payment/OrderStatusBadge.vue'
import {
  AppInline,
  AppPage,
  AppPageHeader,
  AppStack,
  UiButton,
  UiDataCell,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiFilterBar,
  UiIconButton,
  UiPagination,
  UiSearchInput,
  UiServerTableWorkspace,
  UiSkeleton,
  UiTableToolbar,
  UiTextField,
  type Column,
} from '@/components/ui'
import { useAppStore } from '@/stores/app'
import {
  affiliatesAPI,
  type AffiliateInviteRecord,
  type AffiliateRebateRecord,
  type AffiliateTransferRecord,
  type AffiliateUserOverview,
  type ListAffiliateRecordsParams,
} from '@/api/admin/affiliates'
import type { PaginatedResponse } from '@/types'
import { extractI18nErrorMessage } from '@/utils/apiError'
import { formatDateTime as formatDisplayDateTime } from '@/utils/format'

type RecordType = 'invites' | 'rebates' | 'transfers'
type AffiliateRecord = AffiliateInviteRecord | AffiliateRebateRecord | AffiliateTransferRecord

const props = defineProps<{ type: RecordType }>()
const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(false)
const loadError = ref(false)
const records = ref<AffiliateRecord[]>([])
const filters = reactive({ search: '', start_at: '', end_at: '' })
const pagination = reactive({ page: 1, page_size: 20, total: 0 })
const overviewDialog = ref(false)
const overviewLoading = ref(false)
const overviewError = ref(false)
const selectedOverview = ref<AffiliateUserOverview | null>(null)
const selectedOverviewUserId = ref<number | null>(null)

const titleKeys: Record<RecordType, string> = {
  invites: 'nav.affiliateInviteRecords',
  rebates: 'nav.affiliateRebateRecords',
  transfers: 'nav.affiliateTransferRecords',
}
const descriptionKeys: Record<RecordType, string> = {
  invites: 'admin.affiliates.invitesDescription',
  rebates: 'admin.affiliates.rebatesDescription',
  transfers: 'admin.affiliates.transfersDescription',
}
const pageTitle = computed(() => t(titleKeys[props.type]))
const pageDescription = computed(() => t(descriptionKeys[props.type]))
const activeFilterCount = computed(() =>
  Number(Boolean(filters.search.trim())) +
  Number(Boolean(filters.start_at)) +
  Number(Boolean(filters.end_at))
)
const dateRangeError = computed(() => {
  if (!filters.start_at || !filters.end_at) return ''
  return filters.start_at <= filters.end_at
    ? ''
    : t('admin.affiliates.records.invalidDateRange')
})

const columns = computed<Column[]>(() => {
  if (props.type === 'invites') {
    return [
      { key: 'inviter', label: t('admin.affiliates.records.inviter'), sortable: true },
      { key: 'invitee', label: t('admin.affiliates.records.invitee'), sortable: true },
      { key: 'aff_code', label: t('admin.affiliates.records.affCode'), sortable: true },
      { key: 'total_rebate', label: t('admin.affiliates.records.totalRebate'), sortable: true },
      { key: 'created_at', label: t('admin.affiliates.records.invitedAt'), sortable: true },
    ]
  }
  if (props.type === 'rebates') {
    return [
      { key: 'order', label: t('admin.affiliates.records.order'), sortable: true },
      { key: 'inviter', label: t('admin.affiliates.records.inviter'), sortable: true },
      { key: 'invitee', label: t('admin.affiliates.records.invitee'), sortable: true },
      { key: 'order_amount', label: t('admin.affiliates.records.orderAmount'), sortable: true },
      { key: 'pay_amount', label: t('admin.affiliates.records.payAmount'), sortable: true },
      { key: 'rebate_amount', label: t('admin.affiliates.records.rebateAmount') },
      { key: 'payment_type', label: t('admin.affiliates.records.paymentType'), sortable: true },
      { key: 'order_status', label: t('admin.affiliates.records.orderStatus'), sortable: true },
      { key: 'created_at', label: t('admin.affiliates.records.rebatedAt'), sortable: true },
    ]
  }
  return [
    { key: 'user', label: t('admin.affiliates.records.user'), sortable: true },
    { key: 'amount', label: t('admin.affiliates.records.transferAmount'), sortable: true },
    { key: 'balance_after', label: t('admin.affiliates.records.balanceAfter'), sortable: true },
    { key: 'available_quota_after', label: t('admin.affiliates.records.availableQuotaAfter'), sortable: true },
    { key: 'frozen_quota_after', label: t('admin.affiliates.records.frozenQuotaAfter'), sortable: true },
    { key: 'history_quota_after', label: t('admin.affiliates.records.historyQuotaAfter'), sortable: true },
    { key: 'created_at', label: t('admin.affiliates.records.transferredAt'), sortable: true },
  ]
})

const sortStorageKey = computed(() => `admin-affiliate-${props.type}-table-sort`)

function loadInitialSortState(): { sort_by: string; sort_order: 'asc' | 'desc' } {
  const fallback = { sort_by: 'created_at', sort_order: 'desc' as const }
  try {
    const raw = localStorage.getItem(sortStorageKey.value)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as { key?: string; order?: string }
    const key = typeof parsed.key === 'string' ? parsed.key : ''
    if (!columns.value.some((column) => column.key === key && column.sortable)) return fallback
    return { sort_by: key, sort_order: parsed.order === 'asc' ? 'asc' : 'desc' }
  } catch {
    return fallback
  }
}

const sortState = reactive(loadInitialSortState())

function userTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function buildParams(): ListAffiliateRecordsParams {
  return {
    page: pagination.page,
    page_size: pagination.page_size,
    search: filters.search.trim() || undefined,
    start_at: filters.start_at || undefined,
    end_at: filters.end_at || undefined,
    sort_by: sortState.sort_by,
    sort_order: sortState.sort_order,
    timezone: userTimezone(),
  }
}

async function fetchRecords(params: ListAffiliateRecordsParams): Promise<PaginatedResponse<AffiliateRecord>> {
  if (props.type === 'invites') return affiliatesAPI.listInviteRecords(params)
  if (props.type === 'rebates') return affiliatesAPI.listRebateRecords(params)
  return affiliatesAPI.listTransferRecords(params)
}

let listRequestId = 0

async function loadRecords() {
  if (dateRangeError.value) return
  const requestId = ++listRequestId
  loading.value = true
  loadError.value = false
  try {
    const response = await fetchRecords(buildParams())
    if (requestId !== listRequestId) return
    records.value = response.items || []
    pagination.total = response.total || 0
  } catch (error) {
    if (requestId !== listRequestId) return
    loadError.value = true
    appStore.showError(extractI18nErrorMessage(error, t, 'admin.affiliates.errors', t('common.error')))
  } finally {
    if (requestId === listRequestId) loading.value = false
  }
}

function reloadFromFirstPage() {
  pagination.page = 1
  void loadRecords()
}

function resetFilters() {
  filters.search = ''
  filters.start_at = ''
  filters.end_at = ''
  reloadFromFirstPage()
}

function handlePageChange(page: number) {
  pagination.page = page
  void loadRecords()
}

function handlePageSizeChange(size: number) {
  pagination.page_size = size
  pagination.page = 1
  void loadRecords()
}

function handleSort(key: string, order: 'asc' | 'desc') {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  void loadRecords()
}

function recordRowKey(row: AffiliateRecord): string | number {
  if ('ledger_id' in row) return row.ledger_id
  if ('order_id' in row) return row.order_id
  return `${row.inviter_id}:${row.invitee_id}:${row.created_at}`
}

function formatAmount(value: number | null | undefined): string {
  return Number(value || 0).toFixed(2)
}

function formatNullableAmount(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : `$${formatAmount(value)}`
}

function formatPercent(value: number | null | undefined): string {
  return `${Math.round(Number(value || 0) * 100) / 100}%`
}

function formatDateTime(value: string | null | undefined): string {
  return value ? formatDisplayDateTime(value) : '-'
}

const overviewFacts = computed(() => {
  const overview = selectedOverview.value
  if (!overview) return []
  return [
    { label: 'ID', value: `#${overview.user_id}` },
    { label: t('admin.affiliates.records.user'), value: overview.email || '-' },
    { label: t('admin.users.columns.username'), value: overview.username || '-' },
    { label: t('admin.affiliates.overview.affCode'), value: overview.aff_code || '-' },
    { label: t('admin.affiliates.overview.rebateRate'), value: formatPercent(overview.rebate_rate_percent), numeric: true },
    { label: t('admin.affiliates.overview.invitedCount'), value: overview.invited_count, numeric: true },
    { label: t('admin.affiliates.overview.rebatedInviteeCount'), value: overview.rebated_invitee_count, numeric: true },
    { label: t('admin.affiliates.overview.availableQuota'), value: `$${formatAmount(overview.available_quota)}`, numeric: true },
    { label: t('admin.affiliates.overview.historyQuota'), value: `$${formatAmount(overview.history_quota)}`, numeric: true },
  ]
})

let overviewRequestId = 0

async function openUserOverview(userId: number) {
  if (!userId) return
  const requestId = ++overviewRequestId
  selectedOverviewUserId.value = userId
  overviewDialog.value = true
  overviewLoading.value = true
  overviewError.value = false
  selectedOverview.value = null
  try {
    const response = await affiliatesAPI.getUserOverview(userId)
    if (requestId !== overviewRequestId || !overviewDialog.value) return
    selectedOverview.value = response
  } catch (error) {
    if (requestId !== overviewRequestId) return
    overviewError.value = true
    appStore.showError(extractI18nErrorMessage(error, t, 'admin.affiliates.errors', t('common.error')))
  } finally {
    if (requestId === overviewRequestId) overviewLoading.value = false
  }
}

function retryOverview() {
  if (selectedOverviewUserId.value !== null) void openUserOverview(selectedOverviewUserId.value)
}

function closeOverview() {
  overviewRequestId += 1
  overviewDialog.value = false
  overviewLoading.value = false
  overviewError.value = false
  selectedOverview.value = null
  selectedOverviewUserId.value = null
}

onMounted(() => void loadRecords())
onUnmounted(() => {
  listRequestId += 1
  overviewRequestId += 1
})
</script>
