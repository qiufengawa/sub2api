<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader :title="t('admin.audit.title')" :description="t('admin.audit.description')">
        <template #actions>
          <UiButton
            density="compact"
            variant="danger"
            :loading="checkingTotpStatus"
            :disabled="checkingTotpStatus"
            @click="openClearDialog"
          >
            <template #icon><Icon name="trash" size="sm" /></template>
            {{ checkingTotpStatus ? t('common.loading') : t('admin.audit.clearAll') }}
          </UiButton>
        </template>
      </AppPageHeader>

      <UiServerTableWorkspace :loading="refreshing">
        <template #toolbar>
          <UiTableToolbar>
            <UiSearchInput
              v-model="filters.q"
              density="compact"
              :debounce-ms="0"
              :placeholder="t('admin.audit.filters.qPlaceholder')"
              @search="search"
            />
            <template #actions>
              <UiButton
                density="compact"
                :aria-expanded="advancedFiltersExpanded"
                data-testid="audit-advanced-toggle"
                @click="advancedFiltersExpanded = !advancedFiltersExpanded"
              >
                <template #icon><Icon name="filter" size="sm" /></template>
                {{ t('admin.audit.filters.advanced') }}{{ advancedFilterCount ? ` (${advancedFilterCount})` : '' }}
              </UiButton>
              <UiIconButton
                icon="refresh"
                density="compact"
                :label="t('common.refresh')"
                :disabled="loading"
                @click="fetchLogs"
              />
            </template>
          </UiTableToolbar>
        </template>

        <template #filters>
          <UiFilterBar
            data-testid="audit-filter-workspace"
            :active-count="activeFilterCount"
            @clear="resetFilters"
          >
            <UiSelect
              v-model="filters.success"
              :options="resultOptions"
              density="compact"
              :label="t('admin.audit.filters.result')"
              @change="search"
            />
            <UiSelect
              :model-value="timeRange"
              :options="timeRangeOptions"
              density="compact"
              :label="t('admin.dashboard.timeRange')"
              @update:model-value="handleTimeRangeChange"
            />
            <template #actions>
              <UiButton density="compact" variant="primary" :disabled="loading" @click="search">
                {{ t('common.search') }}
              </UiButton>
            </template>
          </UiFilterBar>

          <AppGrid
            v-if="advancedFiltersExpanded || advancedFilterCount > 0"
            min="180px"
            :gap="8"
            data-testid="audit-advanced-filters"
          >
            <UiTextField v-model="filters.actor_email" density="compact" :label="t('admin.audit.filters.actorEmail')" @enter="search" />
            <UiTextField v-model="filters.action" density="compact" :label="t('admin.audit.filters.action')" @enter="search" />
            <UiTextField v-model="filters.client_ip" density="compact" monospace :label="t('admin.audit.filters.clientIp')" @enter="search" />
            <UiSelect v-model="filters.method" :options="methodOptions" density="compact" :label="t('admin.audit.filters.method')" @change="search" />
            <UiSelect v-model="filters.auth_method" :options="authMethodOptions" density="compact" :label="t('admin.audit.filters.authMethod')" @change="search" />
          </AppGrid>
        </template>

      <AppStack :gap="12">
        <UiAlert
          v-if="loadError && logs.length"
          tone="danger"
          :message="t('admin.audit.loadFailed')"
        />

        <!-- Table -->
        <UiDataTable
          :columns="columns"
          :data="logs"
          :loading="initialLoading"
          row-key="id"
          :aria-label="t('admin.audit.title')"
        >
          <template #cell-created_at="{ value }">
            <time class="ui-numeric">{{ formatTime(value) }}</time>
          </template>

          <template #cell-actor="{ row }">
            <UiDataCell
              :value="row.actor_email || '—'"
              :meta="[row.actor_role, row.auth_method ? authMethodLabel(row.auth_method) : ''].filter(Boolean).join(' · ')"
            />
          </template>

          <template #cell-action="{ row }">
            <UiDataCell :value="row.action" :meta="`${row.method} ${row.path}`" mono />
          </template>

          <template #cell-status_code="{ row }">
            <UiStatusBadge :status="statusTone(row.status_code)" :label="String(row.status_code)" />
          </template>

          <template #cell-latency_ms="{ value }">
            <span class="ui-numeric">{{ value }} ms</span>
          </template>

          <template #cell-client_ip="{ value }">
            <UiDataCell :value="value || '—'" mono />
          </template>

          <template #cell-actions="{ row }">
            <UiIconButton
              icon="eye"
              variant="ghost"
              density="compact"
              :label="t('admin.audit.columns.detail')"
              @click="openDetail(row.id)"
            />
          </template>

          <template #empty>
            <UiErrorState
              v-if="loadError"
              data-testid="audit-list-error"
              :title="t('admin.audit.loadFailed')"
              :retry-text="t('common.retry')"
              @retry="fetchLogs"
            />
            <UiEmptyState v-else :title="emptyStateTitle" />
          </template>
        </UiDataTable>
      </AppStack>

      <!-- Pagination -->
      <template #pagination>
        <UiPagination
          v-if="total > 0"
          :total="total"
          :page="page"
          :page-size="pageSize"
          :summary-label="t('pagination.showing')"
          :page-size-label="t('pagination.perPage')"
          :previous-label="t('pagination.previous')"
          :next-label="t('pagination.next')"
          :reset-page-on-page-size-change="false"
          @update:page="onPageChange"
          @update:pageSize="onPageSizeChange"
        />
      </template>
      </UiServerTableWorkspace>
    </AppPage>

    <!-- Detail dialog -->
    <UiDrawer
      :show="detailVisible"
      :title="t('admin.audit.detail.title')"
      @close="closeDetail"
    >
      <AppStack v-if="detailLoading" :gap="12">
        <UiSkeleton width="160px" height="24px" />
        <UiSkeleton height="64px" />
        <UiSkeleton height="180px" />
        <UiSkeleton height="96px" />
      </AppStack>

      <UiErrorState
        v-else-if="detailError"
        data-testid="audit-detail-error"
        :title="t('admin.audit.detail.loadFailed')"
        :retry-text="t('common.retry')"
        @retry="retryDetail"
      />

      <AppStack v-else-if="detail" :gap="20">
        <AppInline :gap="12">
          <UiStatusBadge
            :status="statusTone(detail.status_code)"
            :label="`${detail.status_code} ${statusText(detail.status_code)}`"
          />
          <UiDataCell :value="detail.action" mono />
        </AppInline>

        <UiCodeBlock :label="t('admin.audit.detail.methodPath')" :code="`${detail.method} ${detail.path}`" />
        <UiDescriptionList :items="detailFacts" :columns="1" />
        <UiCodeBlock :label="t('admin.audit.detail.userAgent')" :code="detail.user_agent || '—'" />

        <!-- Request body (redacted) -->
        <UiCodeBlock
          v-if="detail.request_body"
          :label="t('admin.audit.detail.requestBody')"
          :code="prettyBody(detail.request_body)"
        />

        <!-- Extra -->
        <UiCodeBlock
          v-if="detail.extra && Object.keys(detail.extra).length"
          :label="t('admin.audit.detail.extra')"
          :code="JSON.stringify(detail.extra, null, 2)"
        />
      </AppStack>
    </UiDrawer>

    <!-- Custom time range dialog (与 /admin/ops 时间下拉一致的自定义范围，支持时分) -->
    <UiDialog
      :show="showCustomTimeRangeDialog"
      :title="t('admin.ops.timeRange.custom')"
      width="narrow"
      @close="handleCustomTimeRangeCancel"
    >
      <AppStack :gap="12">
        <UiTextField v-model="customStartTimeInput" type="datetime-local" density="compact" :label="t('admin.ops.customTimeRange.startTime')" />
        <UiTextField v-model="customEndTimeInput" type="datetime-local" density="compact" :label="t('admin.ops.customTimeRange.endTime')" />
        <UiAlert v-if="customRangeError" tone="danger" :message="t('admin.audit.filters.invalidTimeRange')" />
      </AppStack>
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton density="compact" @click="handleCustomTimeRangeCancel">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            density="compact"
            variant="primary"
            :disabled="Boolean(customRangeError)"
            @click="handleCustomTimeRangeConfirm"
          >
            {{ t('common.confirm') }}
          </UiButton>
        </AppInline>
      </template>
    </UiDialog>

    <!-- Clear confirmation → step-up TOTP -->
    <UiConfirmDialog
      :show="clearConfirmVisible"
      :title="t('admin.audit.clearConfirm.title')"
      :message="t('admin.audit.clearConfirm.message')"
      :confirm-text="t('admin.audit.clearAll')"
      :cancel-text="t('common.cancel')"
      danger
      @confirm="onClearConfirmed"
      @cancel="clearConfirmVisible = false"
    />

    <!-- TOTP prompt for the clear operation -->
    <UiDialog
      :show="clearTotpVisible"
      :title="t('admin.audit.clearConfirm.totpTitle')"
      width="narrow"
      @close="cancelClearTotp"
    >
      <AppStack :gap="12">
        <UiAlert :message="t('admin.audit.clearConfirm.totpHint')" />
        <UiTextField
          v-model.trim="clearTotpCode"
          type="text"
          inputmode="numeric"
          :maxlength="6"
          autocomplete="one-time-code"
          density="compact"
          monospace
          text-align="center"
          placeholder="••••••"
          @enter="submitClear"
        />
      </AppStack>
      <template #footer>
        <AppInline justify="flex-end">
          <UiButton density="compact" :disabled="clearing" @click="cancelClearTotp">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            density="compact"
            variant="danger"
            :loading="clearing"
            :disabled="clearing || clearTotpCode.length !== 6"
            @click="submitClear"
          >
            {{ clearing ? t('common.loading') : t('admin.audit.clearAll') }}
          </UiButton>
        </AppInline>
      </template>
    </UiDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI, type AuditLog } from '@/api/admin'
import { totpAPI } from '@/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import type { Column } from '@/components/ui'
import {
  AppGrid,
  AppInline,
  AppPage,
  AppPageHeader,
  AppStack,
  UiAlert,
  UiButton,
  UiCodeBlock,
  UiConfirmDialog,
  UiDataCell,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiDrawer,
  UiEmptyState,
  UiErrorState,
  UiFilterBar,
  UiIconButton,
  UiPagination,
  UiSearchInput,
  UiSelect,
  UiServerTableWorkspace,
  UiSkeleton,
  UiStatusBadge,
  UiTableToolbar,
  UiTextField
} from '@/components/ui'
import { useAppStore } from '@/stores'

const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(true)
const loadError = ref(false)
const logs = ref<AuditLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const initialLoading = computed(() => loading.value && logs.value.length === 0)
const refreshing = computed(() => loading.value && logs.value.length > 0)

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const requestError = error as { name?: string; code?: string }
  return requestError.name === 'AbortError' || requestError.code === 'ERR_CANCELED'
}

const filters = reactive({
  q: '',
  actor_email: '',
  action: '',
  client_ip: '',
  method: '',
  auth_method: '',
  success: ''
})
const advancedFiltersExpanded = ref(false)
const advancedFilterCount = computed(() => [
  filters.actor_email,
  filters.action,
  filters.client_ip,
  filters.method,
  filters.auth_method
].filter(Boolean).length)
const activeFilterCount = computed(() =>
  Number(Boolean(filters.q)) +
  Number(Boolean(filters.success)) +
  Number(Boolean(timeRange.value)) +
  advancedFilterCount.value
)
const hasActiveFilters = computed(() => Boolean(
  filters.q || filters.success || timeRange.value || advancedFilterCount.value
))
const emptyStateTitle = computed(() =>
  t(hasActiveFilters.value ? 'admin.audit.filteredEmpty' : 'admin.audit.empty')
)

// 时间范围：预设窗口（同 /admin/ops 时间下拉）+ 自定义起止（datetime-local，支持时分）
const timeRange = ref('')
const customStartTime = ref('')
const customEndTime = ref('')
const showCustomTimeRangeDialog = ref(false)
const customStartTimeInput = ref('')
const customEndTimeInput = ref('')
const customRangeError = computed(() => {
  if (!customStartTimeInput.value || !customEndTimeInput.value) {
    return 'required'
  }
  const start = new Date(customStartTimeInput.value).getTime()
  const end = new Date(customEndTimeInput.value).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return 'invalid'
  }
  return ''
})

const TIME_RANGE_MINUTES: Record<string, number> = {
  '30m': 30,
  '1h': 60,
  '6h': 6 * 60,
  '24h': 24 * 60,
  '7d': 7 * 24 * 60,
  '30d': 30 * 24 * 60
}

const timeRangeOptions = computed(() => [
  { value: '', label: t('admin.audit.filters.all') },
  { value: '30m', label: t('admin.ops.timeRange.30m') },
  { value: '1h', label: t('admin.ops.timeRange.1h') },
  { value: '6h', label: t('admin.ops.timeRange.6h') },
  { value: '24h', label: t('admin.ops.timeRange.24h') },
  { value: '7d', label: t('admin.ops.timeRange.7d') },
  { value: '30d', label: t('admin.ops.timeRange.30d') },
  {
    value: 'custom',
    label:
      timeRange.value === 'custom' && customStartTime.value && customEndTime.value
        ? `${t('admin.ops.timeRange.custom')} (${formatCustomTimeRangeLabel(customStartTime.value, customEndTime.value)})`
        : t('admin.ops.timeRange.custom')
  }
])

function formatCustomTimeRangeLabel(startTime: string, endTime: string): string {
  const fmt = (raw: string) => {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return `${fmt(startTime)} ~ ${fmt(endTime)}`
}

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function handleTimeRangeChange(val: string | number | boolean | null) {
  const value = String(val ?? '')
  if (value === 'custom') {
    // 预填：已有自定义值沿用，否则默认最近1小时（本地时区）
    const now = new Date()
    customStartTimeInput.value = customStartTime.value || toDatetimeLocal(new Date(now.getTime() - 60 * 60 * 1000))
    customEndTimeInput.value = customEndTime.value || toDatetimeLocal(now)
    showCustomTimeRangeDialog.value = true
    return
  }
  timeRange.value = value
  search()
}

function handleCustomTimeRangeConfirm() {
  if (customRangeError.value) return
  customStartTime.value = customStartTimeInput.value
  customEndTime.value = customEndTimeInput.value
  timeRange.value = 'custom'
  showCustomTimeRangeDialog.value = false
  search()
}

function handleCustomTimeRangeCancel() {
  // 未确认不改变当前时间范围；Select 是受控组件，展示值保持不变。
  showCustomTimeRangeDialog.value = false
}

const columns = computed<Column[]>(() => [
  { key: 'created_at', label: t('admin.audit.columns.time') },
  { key: 'actor', label: t('admin.audit.columns.actor') },
  { key: 'action', label: t('admin.audit.columns.action') },
  { key: 'status_code', label: t('admin.audit.columns.result') },
  { key: 'latency_ms', label: t('admin.audit.detail.latency') },
  { key: 'client_ip', label: t('admin.audit.columns.clientIp') },
  { key: 'actions', label: t('common.actions') }
])

const methodOptions = computed(() => [
  { value: '', label: t('admin.audit.filters.all') },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'GET', label: 'GET' }
])

const authMethodOptions = computed(() => [
  { value: '', label: t('admin.audit.filters.all') },
  { value: 'jwt', label: 'JWT' },
  { value: 'admin_api_key', label: 'Admin API Key' },
  { value: 'passkey', label: 'Passkey' }
])

const resultOptions = computed(() => [
  { value: '', label: t('admin.audit.filters.all') },
  { value: 'true', label: t('admin.audit.filters.resultSuccess') },
  { value: 'false', label: t('admin.audit.filters.resultFailure') }
])

function authMethodLabel(method: string): string {
  const found = authMethodOptions.value.find((o) => o.value === method)
  return found && found.value ? found.label : method
}

function toRFC3339(local: string): string | undefined {
  if (!local) return undefined
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function buildTimeRangeQuery(): { start_time?: string; end_time?: string } {
  if (timeRange.value === 'custom') {
    return {
      start_time: toRFC3339(customStartTime.value),
      end_time: toRFC3339(customEndTime.value)
    }
  }
  const minutes = TIME_RANGE_MINUTES[timeRange.value]
  if (!minutes) return {}
  return { start_time: new Date(Date.now() - minutes * 60 * 1000).toISOString() }
}

function buildQuery() {
  return {
    page: page.value,
    page_size: pageSize.value,
    q: filters.q.trim() || undefined,
    actor_email: filters.actor_email.trim() || undefined,
    action: filters.action.trim() || undefined,
    client_ip: filters.client_ip.trim() || undefined,
    method: filters.method || undefined,
    auth_method: filters.auth_method || undefined,
    success: filters.success || undefined,
    ...buildTimeRangeQuery()
  }
}

let listRequestId = 0
let listRequestController: AbortController | null = null

async function fetchLogs() {
  listRequestController?.abort()
  const controller = new AbortController()
  const requestId = ++listRequestId
  listRequestController = controller
  loading.value = true
  loadError.value = false
  try {
    const res = await adminAPI.audit.list(buildQuery(), { signal: controller.signal })
    if (controller.signal.aborted || requestId !== listRequestId) return
    logs.value = res.items
    total.value = res.total
    loadError.value = false
  } catch (err: any) {
    if (controller.signal.aborted || requestId !== listRequestId || isAbortError(err)) return
    loadError.value = true
    appStore.showError(err?.message || t('admin.audit.loadFailed'))
  } finally {
    if (listRequestController === controller) {
      loading.value = false
      listRequestController = null
    }
  }
}

function search() {
  page.value = 1
  fetchLogs()
}

function resetFilters() {
  filters.q = ''
  filters.actor_email = ''
  filters.action = ''
  filters.client_ip = ''
  filters.method = ''
  filters.auth_method = ''
  filters.success = ''
  timeRange.value = ''
  customStartTime.value = ''
  customEndTime.value = ''
  search()
}

function onPageChange(p: number) {
  page.value = p
  fetchLogs()
}

function onPageSizeChange(ps: number) {
  pageSize.value = ps
  page.value = 1
  fetchLogs()
}

// Detail dialog
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailError = ref(false)
const detail = ref<AuditLog | null>(null)
const detailId = ref<number | null>(null)
const detailFacts = computed(() => {
  const item = detail.value
  if (!item) return []
  return [
    { label: t('admin.audit.columns.time'), value: formatTime(item.created_at) },
    { label: t('admin.audit.detail.latency'), value: `${item.latency_ms} ms`, numeric: true },
    { label: t('admin.audit.columns.actor'), value: item.actor_email || '—' },
    { label: t('admin.audit.detail.actorRole'), value: item.actor_role || '—' },
    { label: t('admin.audit.filters.authMethod'), value: authMethodLabel(item.auth_method) || '—' },
    { label: t('admin.audit.detail.credential'), value: item.credential_masked || '—' },
    { label: t('admin.audit.columns.clientIp'), value: item.client_ip || '—' },
    { label: t('admin.audit.detail.requestId'), value: item.request_id || '—' }
  ]
})
let detailRequestId = 0
let detailRequestController: AbortController | null = null

async function openDetail(id: number) {
  detailRequestController?.abort()
  const controller = new AbortController()
  const requestId = ++detailRequestId
  detailRequestController = controller
  detailId.value = id
  detailVisible.value = true
  detailLoading.value = true
  detailError.value = false
  detail.value = null
  try {
    const response = await adminAPI.audit.get(id, { signal: controller.signal })
    if (controller.signal.aborted || requestId !== detailRequestId || !detailVisible.value) return
    detail.value = response
  } catch (err: any) {
    if (controller.signal.aborted || requestId !== detailRequestId || isAbortError(err)) return
    detailError.value = true
    appStore.showError(err?.message || t('admin.audit.loadFailed'))
  } finally {
    if (detailRequestController === controller) {
      detailLoading.value = false
      detailRequestController = null
    }
  }
}

function closeDetail() {
  detailRequestId++
  detailRequestController?.abort()
  detailRequestController = null
  detailVisible.value = false
  detailLoading.value = false
  detailError.value = false
  detailId.value = null
  detail.value = null
}

function retryDetail() {
  if (detailId.value !== null) openDetail(detailId.value)
}

function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

// Clear-all flow: confirm → TOTP → clear
const clearConfirmVisible = ref(false)
const clearTotpVisible = ref(false)
const clearTotpCode = ref('')
const clearing = ref(false)
const checkingTotpStatus = ref(false)

// 与其他敏感操作一致：未启用 2FA 时直接提示去个人资料启用 TOTP，
// 而不是弹出一个无法完成的验证码输入框（后端会以 TOTP_NOT_SETUP 拒绝）。
async function openClearDialog() {
  if (checkingTotpStatus.value) return
  checkingTotpStatus.value = true
  try {
    const status = await totpAPI.getStatus()
    if (!status.enabled) {
      appStore.showError(t('stepUp.notEnabled'))
      return
    }
  } catch (err: any) {
    appStore.showError(err?.message || t('admin.audit.loadFailed'))
    return
  } finally {
    checkingTotpStatus.value = false
  }
  clearConfirmVisible.value = true
}

function onClearConfirmed() {
  clearConfirmVisible.value = false
  clearTotpCode.value = ''
  clearTotpVisible.value = true
}

function cancelClearTotp() {
  if (clearing.value) return
  clearTotpVisible.value = false
}

async function submitClear() {
  if (clearTotpCode.value.length !== 6) return
  clearing.value = true
  try {
    const res = await adminAPI.audit.clear(clearTotpCode.value)
    clearTotpVisible.value = false
    appStore.showSuccess(t('admin.audit.clearConfirm.success', { count: res.deleted }))
    search()
  } catch (err: any) {
    appStore.showError(err?.message || t('admin.audit.clearConfirm.failed'))
    clearTotpCode.value = ''
  } finally {
    clearing.value = false
  }
}

// Helpers
function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function statusText(status: number): string {
  return status < 400 ? t('admin.audit.filters.resultSuccess') : t('admin.audit.filters.resultFailure')
}

function statusTone(status: number): 'success' | 'warning' | 'danger' {
  if (status >= 500) return 'danger'
  if (status >= 400) return 'warning'
  return 'success'
}

onMounted(fetchLogs)
onUnmounted(() => {
  listRequestId++
  detailRequestId++
  listRequestController?.abort()
  detailRequestController?.abort()
  listRequestController = null
  detailRequestController = null
})
</script>
