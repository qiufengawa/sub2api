<template>
  <AppLayout>
    <div class="space-y-4" data-testid="usage-page">
      <section class="overflow-hidden rounded border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800">
        <header class="flex flex-col items-stretch gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-dark-700">
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('usage.queryConditions') }}
            </h2>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">
              {{ t('usage.queryConditionsHint') }}
            </p>
          </div>
          <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
            <button
              type="button"
              class="btn btn-secondary btn-sm flex-1 sm:flex-none md:hidden"
              data-testid="usage-advanced-filter-toggle"
              @click="advancedFiltersExpanded = !advancedFiltersExpanded"
            >
              {{ advancedFiltersExpanded ? t('common.collapse') : t('usage.moreFilters') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm flex-1 sm:flex-none" @click="resetFilters">
              {{ t('common.reset') }}
            </button>
            <button type="button" class="btn btn-primary btn-sm flex-1 sm:flex-none" data-testid="usage-apply-filters" @click="applyFilters">
              {{ t('usage.queryAction') }}
            </button>
          </div>
        </header>

        <div class="grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-5">
          <div class="min-w-0 md:col-span-2">
            <label class="input-label">{{ t('admin.dashboard.timeRange') }}</label>
            <DateRangePicker
              v-model:start-date="startDate"
              v-model:end-date="endDate"
              @change="onDateRangeChange"
            />
          </div>
          <div>
            <label class="input-label">{{ t('admin.dashboard.granularity') }}</label>
            <Select v-model="granularity" :options="granularityOptions" />
          </div>
          <div>
            <label class="input-label">{{ t('usage.apiKeyFilter') }}</label>
            <Select v-model="filters.api_key_id" :options="apiKeyOptions" />
          </div>
          <div>
            <label class="input-label">{{ t('usage.model') }}</label>
            <Select v-model="filters.model" :options="modelOptions" searchable />
          </div>
          <div :class="advancedFiltersExpanded ? '' : 'hidden md:block'">
            <label class="input-label">{{ t('admin.usage.group') }}</label>
            <Select v-model="filters.group_id" :options="groupOptions" searchable />
          </div>
          <div :class="advancedFiltersExpanded ? '' : 'hidden md:block'">
            <label class="input-label">{{ t('usage.type') }}</label>
            <Select v-model="filters.request_type" :options="requestTypeOptions" />
          </div>
          <div :class="advancedFiltersExpanded ? '' : 'hidden md:block'">
            <label class="input-label">{{ t('admin.usage.billingType') }}</label>
            <Select v-model="filters.billing_type" :options="billingTypeOptions" />
          </div>
          <div :class="advancedFiltersExpanded ? '' : 'hidden md:block'">
            <label class="input-label">{{ t('admin.usage.billingMode') }}</label>
            <Select v-model="filters.billing_mode" :options="billingModeOptions" />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-2.5 dark:border-dark-700" data-testid="usage-applied-filters">
          <span class="text-[11px] font-medium text-gray-500 dark:text-dark-400">
            {{ t('usage.appliedConditions') }}
          </span>
          <span
            v-for="chip in appliedFilterChips"
            :key="chip"
            class="rounded-[3px] border border-primary-100 bg-primary-50 px-2 py-0.5 text-[10px] text-primary-700 dark:border-primary-900 dark:bg-primary-950/30 dark:text-primary-300"
          >
            {{ chip }}
          </span>
        </div>
      </section>

      <UsageStatsCards
        :stats="usageStats"
        :show-account-cost="false"
        :strike-standard-cost="true"
        compact
        user-variant
        show-cache-hit-rate
      />

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="usage-chart-grid">
        <TokenUsageTrend
          class="md:col-span-2 xl:col-span-3"
          data-testid="usage-token-trend"
          :trend-data="trendData"
          :loading="chartsLoading"
          compact
          color-scheme="categorical"
        />
        <ModelDistributionChart
          v-model:metric="modelDistributionMetric"
          :model-stats="requestedModelStats"
          :loading="modelStatsLoading"
          display-mode="ranking"
          color-scheme="categorical"
          :max-items="5"
          aggregate-other
          :enable-breakdown="false"
          :show-account-cost="false"
          show-metric-toggle
        />
        <GroupDistributionChart
          v-model:metric="groupDistributionMetric"
          :group-stats="groupStats"
          :loading="chartsLoading"
          display-mode="ranking"
          color-scheme="categorical"
          :max-items="5"
          aggregate-other
          :enable-breakdown="false"
          :show-account-cost="false"
          show-metric-toggle
        />
        <EndpointDistributionChart
          class="md:col-span-2 xl:col-span-1"
          v-model:metric="endpointDistributionMetric"
          :endpoint-stats="inboundEndpointStats"
          :loading="endpointStatsLoading"
          display-mode="ranking"
          color-scheme="categorical"
          :max-items="5"
          aggregate-other
          :enable-breakdown="false"
          show-metric-toggle
        />
      </section>

      <section class="overflow-hidden rounded border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800">
        <header class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div v-if="errorViewEnabled" class="flex gap-1 rounded-[3px] bg-gray-100 p-0.5 dark:bg-dark-900">
            <button class="tab" :class="{ 'tab-active': activeTab === 'usage' }" @click="activeTab = 'usage'">
              {{ t('usage.tabs.usage') }}
            </button>
            <button class="tab" :class="{ 'tab-active': activeTab === 'errors' }" @click="switchToErrors">
              {{ t('usage.tabs.errors') }}
            </button>
          </div>
          <h2 v-else class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('usage.tabs.usage') }}
          </h2>

          <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button type="button" @click="refreshData" :disabled="activeTab === 'errors' ? errorLoading : loading" class="btn btn-secondary btn-sm">
              {{ t('common.refresh') }}
            </button>
            <div class="relative" ref="columnDropdownRef">
              <button
                type="button"
                @click="showColumnDropdown = !showColumnDropdown"
                class="btn btn-secondary btn-sm px-2 md:px-3"
                :title="t('admin.users.columnSettings')"
              >
                <Icon name="grid" size="sm" />
                <span class="hidden md:inline">{{ t('admin.users.columnSettings') }}</span>
              </button>
              <div
                v-if="showColumnDropdown"
                class="absolute right-0 top-full z-50 mt-1 max-h-80 w-48 overflow-y-auto rounded border border-gray-200 bg-white py-1 shadow-lg dark:border-dark-600 dark:bg-dark-800"
              >
                <button
                  v-for="col in currentToggleableColumns"
                  :key="col.key"
                  type="button"
                  @click="toggleCurrentColumn(col.key)"
                  class="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-700"
                >
                  <span>{{ col.label }}</span>
                  <Icon v-if="isCurrentColumnVisible(col.key)" name="check" size="sm" class="text-primary-500" />
                </button>
              </div>
            </div>
            <button v-if="activeTab !== 'errors'" type="button" @click="exportToCSV" :disabled="exporting" class="btn btn-primary btn-sm">
              {{ exporting ? t('usage.exporting') : t('usage.exportCsv') }}
            </button>
          </div>
        </header>

        <div v-if="activeTab === 'errors'" class="grid gap-3 border-t border-gray-100 p-4 sm:grid-cols-2 xl:grid-cols-4 dark:border-dark-700">
          <div>
              <label class="input-label">{{ t('usage.errors.keyName') }}</label>
              <Select v-model="errorFilter.api_key_id" :options="errorKeyOptions" @change="applyErrorFilters" />
            </div>
          <div>
              <label class="input-label">{{ t('usage.errors.model') }}</label>
              <Select
                v-model="errorFilter.model"
                :options="errorModelOptions"
                searchable
                creatable
                clearable
                :placeholder="t('usage.errors.modelPlaceholder')"
                @change="applyErrorFilters"
              />
            </div>
          <div>
              <label class="input-label">{{ t('usage.errors.category') }}</label>
              <Select v-model="errorFilter.category" :options="errorCategoryOptions" @change="applyErrorFilters" />
            </div>
          <div>
              <label class="input-label">{{ t('usage.errors.status') }}</label>
              <Select v-model="errorFilter.status_code" :options="errorStatusOptions" @change="applyErrorFilters" />
            </div>
        </div>

      <template v-if="activeTab === 'usage'">
        <div class="border-t border-gray-100 dark:border-dark-700">
          <UsageTable
            :data="usageLogs"
            :loading="loading"
            :columns="visibleColumns"
            mobile-table
            :server-side-sort="true"
            :show-account-billing="false"
            :show-upstream-endpoint="false"
            default-sort-key="created_at"
            default-sort-order="desc"
            @sort="handleSort"
            @ipGeoBatchFailed="handleIpGeoBatchFailed"
          />
        </div>

        <div v-if="pagination.total > 0" class="border-t border-gray-100 px-3 py-2 dark:border-dark-700">
          <Pagination
            :page="pagination.page"
            :total="pagination.total"
            :page-size="pagination.page_size"
            @update:page="handlePageChange"
            @update:pageSize="handlePageSizeChange"
          />
        </div>
      </template>

        <div v-else-if="errorViewEnabled" class="border-t border-gray-100 dark:border-dark-700">
          <UserErrorRequestsTable
            :rows="errorRows"
            :total="errorTotal"
            :loading="errorLoading"
            :page="errorPage"
            :page-size="errorPageSize"
            :visible-column-keys="errVisibleColumnKeys"
            @sort="onErrorSort"
            @update:page="onErrorPage"
            @update:pageSize="onErrorPageSize"
            @ipGeoBatchFailed="handleIpGeoBatchFailed"
          />
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { keysAPI, usageAPI, userGroupsAPI } from '@/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import Pagination from '@/components/common/Pagination.vue'
import Select, { type SelectOption } from '@/components/common/Select.vue'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import UsageStatsCards from '@/components/admin/usage/UsageStatsCards.vue'
import UsageTable from '@/components/admin/usage/UsageTable.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import ModelDistributionChart from '@/components/charts/ModelDistributionChart.vue'
import GroupDistributionChart from '@/components/charts/GroupDistributionChart.vue'
import EndpointDistributionChart from '@/components/charts/EndpointDistributionChart.vue'
import Icon from '@/components/icons/Icon.vue'
import UserErrorRequestsTable from '@/components/user/UserErrorRequestsTable.vue'
import { getPersistedPageSize } from '@/composables/usePersistedPageSize'
import { formatReasoningEffort } from '@/utils/format'
import { BILLING_MODE_IMAGE, getBillingModeLabel } from '@/utils/billingMode'
import { resolveUsageRequestType, requestTypeToLegacyStream } from '@/utils/usageRequestType'
import type {
  ApiKey,
  EndpointStat,
  Group,
  GroupStat,
  ModelStat,
  TrendDataPoint,
  UsageLog,
  UsageQueryParams,
  UsageStatsResponse,
  UserErrorRequest,
} from '@/types'
import type { Column } from '@/components/common/types'
import { COMMON_ERROR_STATUS_CODES } from '@/utils/errorBadges'

const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()

type DistributionMetric = 'tokens' | 'actual_cost'

const usageStats = ref<UsageStatsResponse | null>(null)
const usageLogs = ref<UsageLog[]>([])
const trendData = ref<TrendDataPoint[]>([])
const requestedModelStats = ref<ModelStat[]>([])
const groupStats = ref<GroupStat[]>([])
const inboundEndpointStats = ref<EndpointStat[]>([])

const loading = ref(false)
const chartsLoading = ref(false)
const modelStatsLoading = ref(false)
const endpointStatsLoading = ref(false)
const exporting = ref(false)
const advancedFiltersExpanded = ref(false)
const errorRows = ref<UserErrorRequest[]>([])
const errorLoading = ref(false)
const errorPage = ref(1)
const errorPageSize = ref(20)
const errorSortBy = ref('created_at')
const errorSortOrder = ref<'asc' | 'desc'>('desc')
const errorTotal = ref(0)
const errorFilter = ref<{ model: string | null; category: string; api_key_id: number | null; status_code: number | null }>({
  model: '',
  category: '',
  api_key_id: null,
  status_code: null,
})

const errorKeyOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.errors.allKeys') },
  ...apiKeys.value.map((k) => ({ value: k.id, label: k.name })),
])

// 模型候选取自当前已加载错误中出现过的模型；creatable 允许输入任意片段做后端模糊。
const errorModelOptions = computed<SelectOption[]>(() => {
  const seen = new Set<string>()
  const opts: SelectOption[] = []
  for (const r of errorRows.value) {
    if (r.model && !seen.has(r.model)) {
      seen.add(r.model)
      opts.push({ value: r.model, label: r.model })
    }
  }
  return opts
})

const errorCategoryCodes = ['auth', 'rate_limit', 'quota', 'invalid_request', 'service_unavailable', 'upstream', 'internal', 'cyber']

const errorCategoryOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('usage.errors.allCategories') },
  ...errorCategoryCodes.map((c) => ({ value: c, label: t('usage.errors.categories.' + c) })),
])

// 状态码候选用固定常用列表(与管理端 UsageFilters 共用常量),不受当前页数据限制:
// 后端 status_code 过滤对全量生效,若只列当前页出现过的码,用户就选不到仅在后续页的码。
const errorStatusOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.errors.allStatuses') },
  ...COMMON_ERROR_STATUS_CODES.map((c) => ({ value: c, label: String(c) })),
])

const applyErrorFilters = () => {
  errorPage.value = 1
  void loadErrors()
}

let abortController: AbortController | null = null
let chartReqSeq = 0
let statsReqSeq = 0
let modelStatsReqSeq = 0

const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const getLast24HoursRangeDates = () => {
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return { start: formatLocalDate(start), end: formatLocalDate(end) }
}

const getGranularityForRange = (start: string, end: string): 'day' | 'hour' => {
  const startTime = new Date(`${start}T00:00:00`).getTime()
  const endTime = new Date(`${end}T00:00:00`).getTime()
  return Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24)) <= 1 ? 'hour' : 'day'
}

const defaultRange = getLast24HoursRangeDates()
const startDate = ref(defaultRange.start)
const endDate = ref(defaultRange.end)
const granularity = ref<'day' | 'hour'>(getGranularityForRange(startDate.value, endDate.value))
const appliedStartDate = ref(startDate.value)
const appliedEndDate = ref(endDate.value)
const appliedGranularity = ref(granularity.value)

const modelDistributionMetric = ref<DistributionMetric>('tokens')
const groupDistributionMetric = ref<DistributionMetric>('tokens')
const endpointDistributionMetric = ref<DistributionMetric>('tokens')
const errorViewEnabled = computed(() => appStore.cachedPublicSettings?.allow_user_view_error_requests ?? false)
const subscriptionGroupBillingEnabled = computed(
  () => appStore.cachedPublicSettings?.subscription_group_billing_enabled === true
)
const activeTab = ref<'usage' | 'errors'>(route.query.tab === 'errors' && errorViewEnabled.value ? 'errors' : 'usage')

const filters = ref<UsageQueryParams>({
  start_date: startDate.value,
  end_date: endDate.value,
  request_type: undefined,
  billing_type: null,
  billing_mode: null,
})
const appliedFilters = ref<UsageQueryParams>({ ...filters.value })

const pagination = reactive({
  page: 1,
  page_size: getPersistedPageSize(),
  total: 0,
})
const sortState = reactive({
  sort_by: 'created_at',
  sort_order: 'desc' as 'asc' | 'desc',
})

const granularityOptions = computed<SelectOption[]>(() => [
  { value: 'day', label: t('admin.dashboard.day') },
  { value: 'hour', label: t('admin.dashboard.hour') },
])
const requestTypeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allTypes') },
  { value: 'ws_v2', label: t('usage.ws') },
  { value: 'live', label: t('usage.live') },
  { value: 'stream', label: t('usage.stream') },
  { value: 'sync', label: t('usage.sync') },
])
const billingTypeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allBillingTypes') },
  { value: 0, label: t('admin.usage.billingTypeBalance') },
  { value: 1, label: t('admin.usage.billingTypeSubscription') },
])
const billingModeOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allBillingModes') },
  { value: 'token', label: t('admin.usage.billingModeToken') },
  { value: 'per_request', label: t('admin.usage.billingModePerRequest') },
  { value: 'image', label: t('admin.usage.billingModeImage') },
  { value: 'video', label: t('admin.usage.billingModeVideo') },
])

const apiKeys = ref<ApiKey[]>([])
const groups = ref<Group[]>([])
const modelOptionValues = ref<string[]>([])

const apiKeyOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('usage.allApiKeys') },
  ...apiKeys.value.map((key) => ({ value: key.id, label: key.name })),
])
const groupOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allGroups') },
  ...groups.value.map((group) => ({ value: group.id, label: group.name })),
])
const modelOptions = computed<SelectOption[]>(() => [
  { value: null, label: t('admin.usage.allModels') },
  ...modelOptionValues.value.map((model) => ({ value: model, label: model })),
])

const normalizedFilters = computed<UsageQueryParams>(() => {
  const requestType = appliedFilters.value.request_type
  const legacyStream = requestType ? requestTypeToLegacyStream(requestType) : appliedFilters.value.stream
  return {
    ...appliedFilters.value,
    start_date: appliedStartDate.value,
    end_date: appliedEndDate.value,
    stream: legacyStream === null ? undefined : legacyStream,
  }
})

const optionLabel = (options: SelectOption[], value: unknown): string =>
  options.find((option) => option.value === value)?.label || ''

const appliedFilterChips = computed(() => {
  const chips = [
    `${appliedStartDate.value} — ${appliedEndDate.value}`,
    optionLabel(granularityOptions.value, appliedGranularity.value),
  ]
  const selected = appliedFilters.value
  const optionalLabels = [
    optionLabel(apiKeyOptions.value, selected.api_key_id),
    optionLabel(modelOptions.value, selected.model),
    optionLabel(groupOptions.value, selected.group_id),
    optionLabel(requestTypeOptions.value, selected.request_type),
    optionLabel(billingTypeOptions.value, selected.billing_type),
    optionLabel(billingModeOptions.value, selected.billing_mode),
  ]
  return [...chips, ...optionalLabels.filter(Boolean)]
})

const buildUsageListParams = (page: number, pageSize: number): UsageQueryParams => ({
  page,
  page_size: pageSize,
  ...normalizedFilters.value,
  sort_by: sortState.sort_by,
  sort_order: sortState.sort_order,
})

const loadLogs = async () => {
  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  loading.value = true
  try {
    const res = await usageAPI.query(buildUsageListParams(pagination.page, pagination.page_size), {
      signal: controller.signal,
    })
    if (!controller.signal.aborted) {
      usageLogs.value = res.items
      pagination.total = res.total
    }
  } catch (error: any) {
    if (error?.name !== 'AbortError' && error?.code !== 'ERR_CANCELED') {
      appStore.showError(t('usage.failedToLoad'))
    }
  } finally {
    if (abortController === controller) loading.value = false
  }
}

const loadStats = async () => {
  const seq = ++statsReqSeq
  endpointStatsLoading.value = true
  try {
    const stats = await usageAPI.getStats(normalizedFilters.value)
    if (seq !== statsReqSeq) return
    usageStats.value = stats
    inboundEndpointStats.value = stats.endpoints || []
  } catch (error) {
    if (seq !== statsReqSeq) return
    console.error('Failed to load usage stats:', error)
    inboundEndpointStats.value = []
  } finally {
    if (seq === statsReqSeq) endpointStatsLoading.value = false
  }
}

const loadModelStats = async () => {
  const seq = ++modelStatsReqSeq
  modelStatsLoading.value = true
  try {
    const response = await usageAPI.getDashboardModels({
      ...normalizedFilters.value,
      model_source: 'requested',
    })
    if (seq !== modelStatsReqSeq) return
    requestedModelStats.value = response.models || []
    refreshModelOptions(response.models || [])
  } catch (error) {
    if (seq !== modelStatsReqSeq) return
    console.error('Failed to load model stats:', error)
    requestedModelStats.value = []
  } finally {
    if (seq === modelStatsReqSeq) modelStatsLoading.value = false
  }
}

const loadChartData = async () => {
  const seq = ++chartReqSeq
  chartsLoading.value = true
  try {
    const snapshot = await usageAPI.getDashboardSnapshotV2({
      ...normalizedFilters.value,
      granularity: appliedGranularity.value,
      include_trend: true,
      include_model_stats: false,
      include_group_stats: true,
    })
    if (seq !== chartReqSeq) return
    trendData.value = snapshot.trend || []
    groupStats.value = snapshot.groups || []
  } catch (error) {
    if (seq !== chartReqSeq) return
    console.error('Failed to load chart data:', error)
    trendData.value = []
    groupStats.value = []
  } finally {
    if (seq === chartReqSeq) chartsLoading.value = false
  }
}

const refreshModelOptions = (models: ModelStat[]) => {
  const current = filters.value.model
  const set = new Set(modelOptionValues.value)
  models.forEach((item) => {
    if (item.model) set.add(item.model)
  })
  if (current) set.add(current)
  modelOptionValues.value = Array.from(set).sort()
}

const applyFilters = () => {
  appliedStartDate.value = startDate.value
  appliedEndDate.value = endDate.value
  appliedGranularity.value = granularity.value
  appliedFilters.value = {
    ...filters.value,
    start_date: startDate.value,
    end_date: endDate.value,
  }
  pagination.page = 1
  void loadLogs()
  void loadStats()
  void loadModelStats()
  void loadChartData()
  resetErrorRows()
}

const refreshData = () => {
  void loadLogs()
  void loadStats()
  void loadModelStats()
  void loadChartData()
  if (activeTab.value === 'errors') void loadErrors()
}

const resetFilters = () => {
  const range = getLast24HoursRangeDates()
  startDate.value = range.start
  endDate.value = range.end
  filters.value = {
    start_date: range.start,
    end_date: range.end,
    request_type: undefined,
    billing_type: null,
    billing_mode: null,
  }
  granularity.value = getGranularityForRange(range.start, range.end)
  applyFilters()
  if (activeTab.value === 'errors') {
    errorFilter.value = { model: '', category: '', api_key_id: null, status_code: null }
    applyErrorFilters()
  }
}

const onDateRangeChange = (range: { startDate: string; endDate: string; preset: string | null }) => {
  startDate.value = range.startDate
  endDate.value = range.endDate
  filters.value.start_date = range.startDate
  filters.value.end_date = range.endDate
  granularity.value = getGranularityForRange(range.startDate, range.endDate)
}

const handlePageChange = (page: number) => {
  pagination.page = page
  void loadLogs()
}

const handlePageSizeChange = (pageSize: number) => {
  pagination.page_size = pageSize
  pagination.page = 1
  void loadLogs()
}

const handleSort = (key: string, order: 'asc' | 'desc') => {
  sortState.sort_by = key
  sortState.sort_order = order
  pagination.page = 1
  void loadLogs()
}

const handleIpGeoBatchFailed = () => {
  appStore.showError(t('usage.ipGeo.batchFailed'))
}

const getRequestTypeExportText = (log: UsageLog): string => {
  const requestType = resolveUsageRequestType(log)
  if (requestType === 'cyber') return 'Cyber'
  if (requestType === 'live') return 'Live'
  if (requestType === 'ws_v2') return 'WS'
  if (requestType === 'stream') return 'Stream'
  if (requestType === 'sync') return 'Sync'
  return 'Unknown'
}

const getDisplayBillingMode = (
  row: Pick<UsageLog, 'billing_mode' | 'image_count'> | null | undefined
): string | null | undefined => {
  if ((row?.image_count ?? 0) > 0) return BILLING_MODE_IMAGE
  return row?.billing_mode
}

const escapeCSVValue = (value: unknown): string => {
  if (value == null) return ''
  const str = String(value)
  const escaped = str.replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(str)) return `"\'${escaped}"`
  if (/[,"\n\r]/.test(str)) return `"${escaped}"`
  return str
}

const exportToCSV = async () => {
  if (pagination.total === 0) {
    appStore.showWarning(t('usage.noDataToExport'))
    return
  }
  exporting.value = true
  appStore.showInfo(t('usage.preparingExport'))
  try {
    const allLogs: UsageLog[] = []
    const pageSize = 100
    const totalPages = Math.ceil(pagination.total / pageSize)
    for (let page = 1; page <= totalPages; page++) {
      const response = await usageAPI.query(buildUsageListParams(page, pageSize))
      allLogs.push(...response.items)
    }
    if (allLogs.length === 0) {
      appStore.showWarning(t('usage.noDataToExport'))
      return
    }
    const headers = [
      'Time',
      'API Key Name',
      'Model',
      'Reasoning Effort',
      'Inbound Endpoint',
      'Upstream Endpoint',
      'Group',
      'IP Address',
      'User Agent',
      'Type',
      'Billing Mode',
      'Billing Source',
      'Subscription Plan',
      'Billing Preference',
      'Billing Fallback Reason',
      'Input Tokens',
      'Output Tokens',
      'Cache Read Tokens',
      'Cache Creation Tokens',
      'Rate Multiplier',
      'Billed Cost',
      'Original Cost',
      'First Token (ms)',
      'Duration (ms)',
    ]
    const rows = allLogs.map((log) => [
      log.created_at,
      log.api_key?.name || '',
      log.model,
      formatReasoningEffort(log.reasoning_effort),
      log.inbound_endpoint || '',
      log.upstream_endpoint || '',
      log.group?.name || '',
      log.ip_address || '',
      log.user_agent || '',
      getRequestTypeExportText(log),
      getBillingModeLabel(getDisplayBillingMode(log), t),
      log.billing_source || 'legacy',
      log.subscription?.plan_name || log.subscription?.group?.name || (log.subscription_id ? `#${log.subscription_id}` : ''),
      log.billing_preference || '',
      log.billing_fallback_reason || '',
      log.input_tokens,
      log.output_tokens,
      log.cache_read_tokens,
      log.cache_creation_tokens,
      log.rate_multiplier,
      log.actual_cost.toFixed(8),
      log.total_cost.toFixed(8),
      log.first_token_ms ?? '',
      log.duration_ms ?? '',
    ].map(escapeCSVValue))
    const csvContent = [
      headers.map(escapeCSVValue).join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `usage_${appliedStartDate.value}_to_${appliedEndDate.value}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
    appStore.showSuccess(t('usage.exportSuccess'))
  } catch (error) {
    console.error('CSV Export failed:', error)
    appStore.showError(t('usage.exportFailed'))
  } finally {
    exporting.value = false
  }
}

const ALWAYS_VISIBLE = ['created_at']
const DEFAULT_HIDDEN_COLUMNS = ['stream', 'group', 'endpoint', 'ip_address', 'user_agent']
const HIDDEN_COLUMNS_KEY = 'user-usage-hidden-columns'

const allColumns = computed<Column[]>(() => [
  { key: 'api_key', label: t('usage.apiKeyFilter'), sortable: false },
  { key: 'model', label: t('usage.model'), sortable: true },
  { key: 'reasoning_effort', label: t('usage.reasoningEffort'), sortable: false },
  { key: 'tokens', label: t('usage.tokens'), sortable: false },
  { key: 'cost', label: t('usage.cost'), sortable: false },
  { key: 'latency', label: t('usage.latency'), sortable: false },
  { key: 'billing_mode', label: t('admin.usage.billingMode'), sortable: false },
  ...(subscriptionGroupBillingEnabled.value
    ? [{ key: 'billing_source', label: t('usage.billingSource'), sortable: false }]
    : []),
  { key: 'created_at', label: t('usage.time'), sortable: true },
  { key: 'stream', label: t('usage.type'), sortable: false },
  { key: 'group', label: t('admin.usage.group'), sortable: false },
  { key: 'endpoint', label: t('usage.endpoint'), sortable: false },
  { key: 'ip_address', label: 'IP', sortable: false },
  { key: 'user_agent', label: t('usage.userAgent'), sortable: false },
])

const hiddenColumns = reactive<Set<string>>(new Set())
const toggleableColumns = computed(() => allColumns.value.filter((col) => !ALWAYS_VISIBLE.includes(col.key)))
const visibleColumns = computed(() =>
  allColumns.value.filter((col) => ALWAYS_VISIBLE.includes(col.key) || !hiddenColumns.has(col.key))
)
const isColumnVisible = (key: string) => !hiddenColumns.has(key)
const toggleColumn = (key: string) => {
  if (hiddenColumns.has(key)) hiddenColumns.delete(key)
  else hiddenColumns.add(key)
  localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...hiddenColumns]))
}
const loadSavedColumns = () => {
  try {
    const saved = localStorage.getItem(HIDDEN_COLUMNS_KEY)
    const values = saved ? JSON.parse(saved) as string[] : DEFAULT_HIDDEN_COLUMNS
    const validKeys = new Set(allColumns.value.map((column) => column.key))
    values.forEach((key) => {
      if (validKeys.has(key)) hiddenColumns.add(key)
    })
  } catch {
    DEFAULT_HIDDEN_COLUMNS.forEach((key) => hiddenColumns.add(key))
  }
}

// 错误请求 tab 独立列设置(机制同用量列设置,存储互不影响)
const ERR_ALWAYS_VISIBLE = ['status', 'created_at']
const ERR_DEFAULT_HIDDEN_COLUMNS = ['user_agent']
const ERR_HIDDEN_COLUMNS_KEY = 'user-usage-error-hidden-columns'

// key 须与 UserErrorRequestsTable 的 allColumns 一致
const errAllColumns = computed<Column[]>(() => [
  { key: 'key_name', label: t('usage.errors.keyName') },
  { key: 'model', label: t('usage.errors.model') },
  { key: 'endpoint', label: t('usage.errors.endpoint') },
  { key: 'client_ip', label: 'IP' },
  { key: 'group', label: t('admin.usage.group') },
  { key: 'type', label: t('usage.type') },
  { key: 'platform', label: t('usage.errors.platform') },
  { key: 'category', label: t('usage.errors.category') },
  { key: 'status', label: t('usage.errors.status') },
  { key: 'message', label: t('usage.errors.message') },
  { key: 'created_at', label: t('usage.errors.time') },
  { key: 'user_agent', label: t('usage.userAgent') },
])

const errHiddenColumns = reactive<Set<string>>(new Set())
const errToggleableColumns = computed(() =>
  errAllColumns.value.filter((col) => !ERR_ALWAYS_VISIBLE.includes(col.key))
)
const errVisibleColumnKeys = computed(() =>
  errAllColumns.value
    .filter((col) => ERR_ALWAYS_VISIBLE.includes(col.key) || !errHiddenColumns.has(col.key))
    .map((col) => col.key)
)
const isErrColumnVisible = (key: string) => !errHiddenColumns.has(key)
const toggleErrColumn = (key: string) => {
  if (errHiddenColumns.has(key)) errHiddenColumns.delete(key)
  else errHiddenColumns.add(key)
  localStorage.setItem(ERR_HIDDEN_COLUMNS_KEY, JSON.stringify([...errHiddenColumns]))
}
const loadSavedErrColumns = () => {
  try {
    const saved = localStorage.getItem(ERR_HIDDEN_COLUMNS_KEY)
    const values = saved ? (JSON.parse(saved) as string[]) : ERR_DEFAULT_HIDDEN_COLUMNS
    values.forEach((key) => errHiddenColumns.add(key))
  } catch {
    ERR_DEFAULT_HIDDEN_COLUMNS.forEach((key) => errHiddenColumns.add(key))
  }
}

// 列设置下拉按当前 tab 分发
const currentToggleableColumns = computed(() =>
  activeTab.value === 'errors' ? errToggleableColumns.value : toggleableColumns.value
)
const isCurrentColumnVisible = (key: string) =>
  activeTab.value === 'errors' ? isErrColumnVisible(key) : isColumnVisible(key)
const toggleCurrentColumn = (key: string) => {
  if (activeTab.value === 'errors') toggleErrColumn(key)
  else toggleColumn(key)
}

const showColumnDropdown = ref(false)
const columnDropdownRef = ref<HTMLElement | null>(null)
const handleColumnClickOutside = (event: MouseEvent) => {
  if (columnDropdownRef.value && !columnDropdownRef.value.contains(event.target as HTMLElement)) {
    showColumnDropdown.value = false
  }
}

const loadFilterOptions = async () => {
  try {
    const [keys, availableGroups] = await Promise.all([
      keysAPI.list(1, 100),
      userGroupsAPI.getAvailable(),
    ])
    apiKeys.value = keys.items
    groups.value = availableGroups
  } catch (error) {
    console.error('Failed to load usage filter options:', error)
  }
}

const resetErrorRows = () => {
  errorPage.value = 1
  if (activeTab.value === 'errors') {
    void loadErrors()
  } else {
    errorRows.value = []
    errorTotal.value = 0
  }
}

const loadErrors = async () => {
  errorLoading.value = true
  try {
    const resp = await usageAPI.listMyErrorRequests({
      page: errorPage.value,
      page_size: errorPageSize.value,
      start_date: appliedStartDate.value,
      end_date: appliedEndDate.value,
      model: (errorFilter.value.model ?? '').trim() || undefined,
      category: errorFilter.value.category || undefined,
      api_key_id: errorFilter.value.api_key_id ?? undefined,
      status_code: errorFilter.value.status_code ?? undefined,
      sort_by: errorSortBy.value,
      sort_order: errorSortOrder.value,
    })
    errorRows.value = resp.items
    errorTotal.value = resp.total
  } catch (error) {
    console.error('[UsageView] loadErrors failed:', error)
    appStore.showError(t('usage.errors.failedToLoad'))
  } finally {
    errorLoading.value = false
  }
}

const onErrorSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
  errorSortBy.value = sortBy
  errorSortOrder.value = sortOrder
  errorPage.value = 1
  void loadErrors()
}

const onErrorPage = (page: number) => {
  errorPage.value = page
  void loadErrors()
}

const onErrorPageSize = (pageSize: number) => {
  errorPageSize.value = pageSize
  errorPage.value = 1
  void loadErrors()
}

const switchToErrors = () => {
  activeTab.value = 'errors'
  if (errorRows.value.length === 0) void loadErrors()
}

onMounted(() => {
  loadSavedColumns()
  loadSavedErrColumns()
  document.addEventListener('click', handleColumnClickOutside)
  void loadFilterOptions()
  refreshData()
})

onUnmounted(() => {
  abortController?.abort()
  document.removeEventListener('click', handleColumnClickOutside)
})

</script>
