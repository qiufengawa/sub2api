<template>
  <AppLayout>
    <UiServerTableWorkspace :loading="loading">
      <!-- Filters -->
      <template #filters>
        <div class="space-y-3 p-3" data-testid="audit-filter-workspace">
          <div class="grid grid-cols-1 gap-2 md:grid-cols-[minmax(240px,1fr)_160px_180px_auto]">
            <UiSearchInput
              v-model="filters.q"
              density="compact"
              :debounce-ms="0"
              :placeholder="t('admin.audit.filters.qPlaceholder')"
              @search="search"
            />
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
            <UiButton
              density="compact"
              :aria-expanded="advancedFiltersExpanded"
              data-testid="audit-advanced-toggle"
              @click="advancedFiltersExpanded = !advancedFiltersExpanded"
            >
              <template #icon><Icon name="filter" size="sm" /></template>
              {{ t('admin.audit.filters.advanced') }}{{ advancedFilterCount ? ` (${advancedFilterCount})` : '' }}
            </UiButton>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UiButton density="compact" variant="primary" :disabled="loading" @click="search">
              {{ t('common.search') }}
            </UiButton>
            <UiButton density="compact" :disabled="loading" @click="resetFilters">
              {{ t('common.reset') }}
            </UiButton>
            <UiButton class="ml-auto" density="compact" variant="danger" @click="openClearDialog">
              <template #icon><Icon name="trash" size="sm" /></template>
              {{ t('admin.audit.clearAll') }}
            </UiButton>
          </div>

          <div
            v-if="advancedFiltersExpanded || advancedFilterCount > 0"
            class="grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-2 xl:grid-cols-5 dark:border-dark-700"
            data-testid="audit-advanced-filters"
          >
            <UiTextField v-model="filters.actor_email" density="compact" :label="t('admin.audit.filters.actorEmail')" @enter="search" />
            <UiTextField v-model="filters.action" density="compact" :label="t('admin.audit.filters.action')" @enter="search" />
            <UiTextField v-model="filters.client_ip" density="compact" monospace :label="t('admin.audit.filters.clientIp')" @enter="search" />
            <UiSelect v-model="filters.method" :options="methodOptions" density="compact" :label="t('admin.audit.filters.method')" @change="search" />
            <UiSelect v-model="filters.auth_method" :options="authMethodOptions" density="compact" :label="t('admin.audit.filters.authMethod')" @change="search" />
          </div>
        </div>
      </template>

      <!-- Table -->
      <UiDataTable
        :columns="columns"
        :data="logs"
        :loading="loading"
        row-key="id"
        :aria-label="t('admin.audit.title')"
      >
          <template #cell-created_at="{ value }">
            <span class="whitespace-nowrap text-gray-600 dark:text-gray-300">{{ formatTime(value) }}</span>
          </template>

          <template #cell-actor="{ row }">
            <div class="min-w-0 max-w-[220px]">
              <div class="truncate font-medium text-gray-900 dark:text-white" :title="row.actor_email">
                {{ row.actor_email || '—' }}
              </div>
              <div class="mt-0.5 truncate text-xs text-gray-400">
                {{ row.actor_role }}<span v-if="row.auth_method"> · {{ authMethodLabel(row.auth_method) }}</span>
              </div>
            </div>
          </template>

          <template #cell-action="{ row }">
            <div class="min-w-0 max-w-xs">
              <div class="truncate font-mono text-sm text-gray-800 dark:text-gray-200" :title="row.action">
                {{ row.action }}
              </div>
              <div class="mt-0.5 truncate font-mono text-xs text-gray-400" :title="`${row.method} ${row.path}`">
                {{ row.method }} {{ row.path }}
              </div>
            </div>
          </template>

          <template #cell-status_code="{ row }">
            <UiStatusBadge :status="statusTone(row.status_code)" :label="String(row.status_code)" />
          </template>

          <template #cell-latency_ms="{ value }">
            <span class="whitespace-nowrap text-gray-500 dark:text-gray-400">{{ value }} ms</span>
          </template>

          <template #cell-client_ip="{ value }">
            <span class="whitespace-nowrap font-mono text-gray-600 dark:text-gray-300">{{ value || '—' }}</span>
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
            <UiEmptyState :title="emptyStateTitle" />
          </template>
      </UiDataTable>

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
          @update:page="onPageChange"
          @update:pageSize="onPageSizeChange"
        />
      </template>
    </UiServerTableWorkspace>

    <!-- Detail dialog -->
    <UiDrawer
      :show="detailVisible"
      :title="t('admin.audit.detail.title')"
      @close="closeDetail"
    >
      <div v-if="detailLoading" class="flex items-center justify-center py-16">
        <div class="flex flex-col items-center gap-3">
          <UiSpinner />
          <div class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</div>
        </div>
      </div>

      <div v-else-if="detail" class="space-y-5 py-2">
        <div class="flex flex-wrap items-center gap-3">
          <UiStatusBadge
            :status="statusTone(detail.status_code)"
            :label="`${detail.status_code} ${statusText(detail.status_code)}`"
          />
          <span class="break-all font-mono text-sm font-semibold">{{ detail.action }}</span>
        </div>

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
      </div>
    </UiDrawer>

    <!-- Custom time range dialog (与 /admin/ops 时间下拉一致的自定义范围，支持时分) -->
    <UiDialog
      :show="showCustomTimeRangeDialog"
      :title="t('admin.ops.timeRange.custom')"
      width="narrow"
      @close="handleCustomTimeRangeCancel"
    >
      <div class="space-y-4 py-2">
        <UiTextField v-model="customStartTimeInput" type="datetime-local" density="compact" :label="t('admin.ops.customTimeRange.startTime')" />
        <UiTextField v-model="customEndTimeInput" type="datetime-local" density="compact" :label="t('admin.ops.customTimeRange.endTime')" />
      </div>
      <template #footer>
        <UiButton density="compact" @click="handleCustomTimeRangeCancel">
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          density="compact"
          variant="primary"
          :disabled="!customStartTimeInput || !customEndTimeInput"
          @click="handleCustomTimeRangeConfirm"
        >
          {{ t('common.confirm') }}
        </UiButton>
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
      :z-index="60"
      @close="cancelClearTotp"
    >
      <div class="py-2">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('admin.audit.clearConfirm.totpHint') }}</p>
        <UiTextField
          v-model.trim="clearTotpCode"
          type="text"
          inputmode="numeric"
          :maxlength="6"
          autocomplete="one-time-code"
          class="mt-4"
          density="compact"
          monospace
          text-align="center"
          placeholder="••••••"
          @enter="submitClear"
        />
      </div>
      <template #footer>
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
  UiButton,
  UiCodeBlock,
  UiConfirmDialog,
  UiDataTable,
  UiDescriptionList,
  UiDialog,
  UiDrawer,
  UiEmptyState,
  UiIconButton,
  UiPagination,
  UiSearchInput,
  UiSelect,
  UiServerTableWorkspace,
  UiSpinner,
  UiStatusBadge,
  UiTextField
} from '@/components/ui'
import { useAppStore } from '@/stores'

const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(false)
const logs = ref<AuditLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

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
  if (!customStartTimeInput.value || !customEndTimeInput.value) return
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
  { value: 'admin_api_key', label: 'Admin API Key' }
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

async function fetchLogs() {
  const requestId = ++listRequestId
  loading.value = true
  try {
    const res = await adminAPI.audit.list(buildQuery())
    if (requestId !== listRequestId) return
    logs.value = res.items
    total.value = res.total
  } catch (err: any) {
    if (requestId !== listRequestId) return
    appStore.showError(err?.message || t('admin.audit.loadFailed'))
  } finally {
    if (requestId === listRequestId) loading.value = false
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
const detail = ref<AuditLog | null>(null)
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

async function openDetail(id: number) {
  const requestId = ++detailRequestId
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const response = await adminAPI.audit.get(id)
    if (requestId !== detailRequestId || !detailVisible.value) return
    detail.value = response
  } catch (err: any) {
    if (requestId !== detailRequestId) return
    appStore.showError(err?.message || t('admin.audit.loadFailed'))
    detailVisible.value = false
  } finally {
    if (requestId === detailRequestId) detailLoading.value = false
  }
}

function closeDetail() {
  detailRequestId++
  detailVisible.value = false
  detailLoading.value = false
  detail.value = null
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
})
</script>
