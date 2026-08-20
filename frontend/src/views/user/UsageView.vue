<template>
  <AppLayout>
    <AppPage density="compact" data-testid="usage-page">
      <AppPageHeader
        :title="t('usage.tabs.usage')"
        :description="t('usage.queryConditionsHint')"
      />

      <AppSection
        class="usage-filter-section"
        :title="t('usage.queryConditions')"
        :description="t('usage.queryConditionsHint')"
        divided
      >
        <UiFilterBar>
          <div class="usage-filter-field usage-filter-field--range">
            <label class="usage-filter-label" for="usage-time-range">{{ t('admin.dashboard.timeRange') }}</label>
            <UiDateRangePicker
              id="usage-time-range"
              v-model:start-date="startDate"
              v-model:end-date="endDate"
              :aria-label="t('admin.dashboard.timeRange')"
              density="compact"
              @change="onDateRangeChange"
            />
          </div>
          <UiSelect
            v-model="granularity"
            class="usage-filter-field"
            :label="t('admin.dashboard.granularity')"
            :options="granularityOptions"
            density="compact"
          />
          <UiSelect
            v-model="filters.api_key_id"
            class="usage-filter-field"
            :label="t('usage.apiKeyFilter')"
            :options="apiKeyOptions"
            density="compact"
          />
          <UiSelect
            v-model="filters.model"
            class="usage-filter-field"
            :label="t('usage.model')"
            :options="modelOptions"
            searchable
            density="compact"
          />
          <div id="usage-advanced-filters" class="usage-advanced-filter-fields">
            <UiSelect
              v-model="filters.group_id"
              class="usage-filter-field"
              :class="{ 'usage-filter-field--mobile-hidden': !advancedFiltersExpanded }"
              :label="t('admin.usage.group')"
              :options="groupOptions"
              searchable
              density="compact"
            />
            <UiSelect
              v-model="filters.request_type"
              class="usage-filter-field"
              :class="{ 'usage-filter-field--mobile-hidden': !advancedFiltersExpanded }"
              :label="t('usage.type')"
              :options="requestTypeOptions"
              density="compact"
            />
            <UiSelect
              v-model="filters.billing_type"
              class="usage-filter-field"
              :class="{ 'usage-filter-field--mobile-hidden': !advancedFiltersExpanded }"
              :label="t('admin.usage.billingType')"
              :options="billingTypeOptions"
              density="compact"
            />
            <UiSelect
              v-model="filters.billing_mode"
              class="usage-filter-field"
              :class="{ 'usage-filter-field--mobile-hidden': !advancedFiltersExpanded }"
              :label="t('admin.usage.billingMode')"
              :options="billingModeOptions"
              density="compact"
            />
          </div>
          <template #actions>
            <UiButton
              variant="quiet"
              density="compact"
              class="usage-advanced-filter-toggle"
              data-testid="usage-advanced-filter-toggle"
              :aria-expanded="advancedFiltersExpanded"
              aria-controls="usage-advanced-filters"
              @click="advancedFiltersExpanded = !advancedFiltersExpanded"
            >
              {{ advancedFiltersExpanded ? t('common.collapse') : t('usage.moreFilters') }}
            </UiButton>
            <UiButton density="compact" @click="resetFilters">
              {{ t('common.reset') }}
            </UiButton>
            <UiButton
              variant="primary"
              density="compact"
              data-testid="usage-apply-filters"
              @click="applyFilters"
            >
              {{ t('usage.queryAction') }}
            </UiButton>
          </template>
        </UiFilterBar>

        <div class="usage-applied-filters" data-testid="usage-applied-filters">
          <span>{{ t('usage.appliedConditions') }}</span>
          <UiBadge v-for="chip in appliedFilterChips" :key="chip" :label="chip" tone="neutral" />
        </div>
      </AppSection>

      <div class="usage-stats-region" :aria-busy="statsLoading">
          <div
            v-if="statsLoading && !usageStats"
            class="usage-stats-loading"
            data-testid="usage-stats-loading"
            role="status"
            aria-live="polite"
            :aria-label="t('common.loading')"
          >
            <UiSkeleton v-for="index in 4" :key="index" variant="rect" height="96px" />
          </div>
          <UiErrorState
            v-else-if="statsError && !usageStats"
            data-testid="usage-stats-error"
            :title="t('usage.failedToLoad')"
            :retry-text="t('common.retry')"
            @retry="loadStats"
          />
          <template v-else>
            <div v-if="statsError" class="usage-retry-banner">
              <UiBanner tone="danger" :message="t('usage.failedToLoad')" />
              <UiButton density="dense" @click="loadStats">{{ t('common.retry') }}</UiButton>
            </div>
            <UsageStatsCards
              v-else
              :stats="usageStats"
              :show-account-cost="false"
              :strike-standard-cost="true"
              compact
              user-variant
              show-cache-hit-rate
            />
          </template>
      </div>

      <section class="usage-analytics-grid" data-testid="usage-chart-grid">
        <div class="usage-analytics-grid__item usage-analytics-grid__trend">
          <UiErrorState
            v-if="chartsError && trendData.length === 0"
            data-testid="usage-trend-error"
            :title="t('usage.failedToLoad')"
            :retry-text="t('common.retry')"
            @retry="loadChartData"
          />
          <template v-else>
            <div v-if="chartsError" class="usage-retry-banner">
              <UiBanner tone="danger" :message="t('usage.failedToLoad')" />
              <UiButton density="dense" @click="loadChartData">{{ t('common.retry') }}</UiButton>
            </div>
            <TokenUsageTrend
              data-testid="usage-token-trend"
              :trend-data="trendData"
              :loading="chartsLoading"
              compact
              color-scheme="categorical"
            />
          </template>
        </div>
        <div class="usage-analytics-grid__item">
          <UiErrorState
            v-if="modelStatsError && requestedModelStats.length === 0"
            data-testid="usage-model-error"
            :title="t('usage.failedToLoad')"
            :retry-text="t('common.retry')"
            @retry="loadModelStats"
          />
          <template v-else>
            <div v-if="modelStatsError" class="usage-retry-banner">
              <UiBanner tone="danger" :message="t('usage.failedToLoad')" />
              <UiButton density="dense" @click="loadModelStats">{{ t('common.retry') }}</UiButton>
            </div>
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
          </template>
        </div>
        <div class="usage-analytics-grid__item">
          <UiErrorState
            v-if="chartsError && groupStats.length === 0"
            data-testid="usage-group-error"
            :title="t('usage.failedToLoad')"
            :retry-text="t('common.retry')"
            @retry="loadChartData"
          />
          <template v-else>
            <div v-if="chartsError" class="usage-retry-banner">
              <UiBanner tone="danger" :message="t('usage.failedToLoad')" />
              <UiButton density="dense" @click="loadChartData">{{ t('common.retry') }}</UiButton>
            </div>
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
          </template>
        </div>
        <div class="usage-analytics-grid__item usage-analytics-grid__endpoint">
          <UiErrorState
            v-if="statsError && inboundEndpointStats.length === 0"
            data-testid="usage-endpoint-error"
            :title="t('usage.failedToLoad')"
            :retry-text="t('common.retry')"
            @retry="loadStats"
          />
          <template v-else>
            <div v-if="statsError" class="usage-retry-banner">
              <UiBanner tone="danger" :message="t('usage.failedToLoad')" />
              <UiButton density="dense" @click="loadStats">{{ t('common.retry') }}</UiButton>
            </div>
            <EndpointDistributionChart
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
          </template>
        </div>
      </section>

      <UiServerTableWorkspace
        :loading="activeTab === 'errors' ? errorLoading : loading"
        :loading-text="t('common.loading')"
      >
        <template #header>
          <div v-if="errorViewEnabled" class="usage-tabs">
            <UiSegmentedControl
              v-model="activeTab"
              :options="usageTabOptions"
              :label="t('usage.tabs.usage')"
              @update:model-value="(value) => value === 'errors' && switchToErrors()"
            />
          </div>
          <h2 v-else class="usage-workspace-title">{{ t('usage.tabs.usage') }}</h2>
        </template>

        <template #actions>
          <UiIconButton
            icon="refresh"
            variant="ghost"
            density="dense"
            :label="t('common.refresh')"
            :disabled="activeTab === 'errors' ? errorLoading : loading"
            @click="refreshData"
          />
          <UiColumnPicker
            :model-value="currentVisibleColumnKeys"
            :columns="currentColumnPickerColumns"
            :label="t('admin.users.columnSettings')"
            @update:model-value="updateCurrentVisibleColumns"
          />
          <UiButton
            v-if="activeTab !== 'errors'"
            variant="primary"
            density="dense"
            :loading="exporting"
            @click="exportToCSV"
          >
            {{ t('usage.exportCsv') }}
          </UiButton>
        </template>

        <template v-if="activeTab === 'errors'" #filters>
          <div class="usage-error-filters">
            <UiSelect
              v-model="errorFilter.api_key_id"
              :label="t('usage.errors.keyName')"
              :options="errorKeyOptions"
              density="compact"
              @change="applyErrorFilters"
            />
            <UiSelect
              v-model="errorFilter.model"
              :label="t('usage.errors.model')"
              :options="errorModelOptions"
              searchable
              creatable
              clearable
              density="compact"
              :placeholder="t('usage.errors.modelPlaceholder')"
              @change="applyErrorFilters"
            />
            <UiSelect
              v-model="errorFilter.category"
              :label="t('usage.errors.category')"
              :options="errorCategoryOptions"
              density="compact"
              @change="applyErrorFilters"
            />
            <UiSelect
              v-model="errorFilter.status_code"
              :label="t('usage.errors.status')"
              :options="errorStatusOptions"
              density="compact"
              @change="applyErrorFilters"
            />
          </div>
        </template>

        <template v-if="activeTab === 'usage'">
          <UiErrorState
            v-if="logsError && usageLogs.length === 0"
            data-testid="usage-logs-error"
            :title="t('usage.failedToLoad')"
            :retry-text="t('common.retry')"
            @retry="loadLogs"
          />
          <template v-else>
            <div v-if="logsError" class="usage-retry-banner">
              <UiBanner tone="danger" :message="t('usage.failedToLoad')" />
              <UiButton density="dense" @click="loadLogs">{{ t('common.retry') }}</UiButton>
            </div>
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
          </template>
        </template>

        <template v-else-if="errorViewEnabled">
          <UiErrorState
            v-if="errorRowsError && errorRows.length === 0"
            data-testid="usage-error-rows-error"
            :title="t('usage.errors.failedToLoad')"
            :retry-text="t('common.retry')"
            @retry="loadErrors"
          />
          <template v-else>
            <div v-if="errorRowsError" class="usage-retry-banner">
              <UiBanner tone="danger" :message="t('usage.errors.failedToLoad')" />
              <UiButton density="dense" @click="loadErrors">{{ t('common.retry') }}</UiButton>
            </div>
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
          </template>
        </template>

        <template v-if="activeTab === 'usage' && pagination.total > 0" #pagination>
          <UiPagination
            :page="pagination.page"
            :total="pagination.total"
            :page-size="pagination.page_size"
            :page-size-options="paginationPageSizeOptions"
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
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { keysAPI, usageAPI, userGroupsAPI } from '@/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  UiBadge,
  UiBanner,
  UiButton,
  UiColumnPicker,
  UiDateRangePicker,
  UiErrorState,
  UiFilterBar,
  UiIconButton,
  UiPagination,
  UiSelect,
  UiSegmentedControl,
  UiServerTableWorkspace,
  UiSkeleton,
  type Column,
  type SelectOption,
} from '@/components/ui'
import UsageStatsCards from '@/components/admin/usage/UsageStatsCards.vue'
import UsageTable from '@/components/admin/usage/UsageTable.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import ModelDistributionChart from '@/components/charts/ModelDistributionChart.vue'
import GroupDistributionChart from '@/components/charts/GroupDistributionChart.vue'
import EndpointDistributionChart from '@/components/charts/EndpointDistributionChart.vue'
import UserErrorRequestsTable from '@/components/user/UserErrorRequestsTable.vue'
import { getPersistedPageSize, setPersistedPageSize } from '@/composables/usePersistedPageSize'
import {
  getConfiguredTablePageSizeOptions,
  normalizeTablePageSize,
} from '@/utils/tablePreferences'
import { formatReasoningEffort } from '@/utils/format'
import { getBillingModeLabel, getDisplayBillingMode as resolveDisplayBillingMode } from '@/utils/billingMode'
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
const statsLoading = ref(false)
const logsError = ref<string | null>(null)
const statsError = ref<string | null>(null)
const modelStatsError = ref<string | null>(null)
const chartsError = ref<string | null>(null)
const exporting = ref(false)
const advancedFiltersExpanded = ref(false)
const errorRows = ref<UserErrorRequest[]>([])
const errorLoading = ref(false)
const errorRowsError = ref<string | null>(null)
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
let errorReqSeq = 0

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
const activeTab = ref<'usage' | 'errors'>(route.query.tab === 'errors' && errorViewEnabled.value ? 'errors' : 'usage')
const usageTabOptions = computed(() => [
  { value: 'usage' as const, label: t('usage.tabs.usage') },
  { value: 'errors' as const, label: t('usage.tabs.errors') },
])

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
const paginationPageSizeOptions = computed(() => Array.from(new Set([
  ...getConfiguredTablePageSizeOptions(),
  normalizeTablePageSize(pagination.page_size),
])).sort((a, b) => a - b))
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
  logsError.value = null
  try {
    const res = await usageAPI.query(buildUsageListParams(pagination.page, pagination.page_size), {
      signal: controller.signal,
    })
    if (!controller.signal.aborted) {
      usageLogs.value = res.items
      pagination.total = res.total
    }
  } catch (error: any) {
    if (
      abortController === controller &&
      error?.name !== 'AbortError' &&
      error?.code !== 'ERR_CANCELED'
    ) {
      logsError.value = t('usage.failedToLoad')
      appStore.showError(t('usage.failedToLoad'))
    }
  } finally {
    if (abortController === controller) loading.value = false
  }
}

const loadStats = async () => {
  const seq = ++statsReqSeq
  statsLoading.value = true
  endpointStatsLoading.value = true
  statsError.value = null
  try {
    const stats = await usageAPI.getStats(normalizedFilters.value)
    if (seq !== statsReqSeq) return
    usageStats.value = stats
    inboundEndpointStats.value = stats.endpoints || []
  } catch (error) {
    if (seq !== statsReqSeq) return
    console.error('Failed to load usage stats:', error)
    statsError.value = t('usage.failedToLoad')
  } finally {
    if (seq === statsReqSeq) {
      statsLoading.value = false
      endpointStatsLoading.value = false
    }
  }
}

const loadModelStats = async () => {
  const seq = ++modelStatsReqSeq
  modelStatsLoading.value = true
  modelStatsError.value = null
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
    modelStatsError.value = t('usage.failedToLoad')
  } finally {
    if (seq === modelStatsReqSeq) modelStatsLoading.value = false
  }
}

const loadChartData = async () => {
  const seq = ++chartReqSeq
  chartsLoading.value = true
  chartsError.value = null
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
    chartsError.value = t('usage.failedToLoad')
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
  // The date picker is the user's explicit confirmation. Apply the complete
  // range immediately so the list, stats, and charts cannot show stale data.
  applyFilters()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  void loadLogs()
}

const handlePageSizeChange = (pageSize: number) => {
  const normalized = normalizeTablePageSize(pageSize)
  setPersistedPageSize(normalized)
  pagination.page_size = normalized
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
): string | null | undefined => resolveDisplayBillingMode(row)

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
      log.subscription?.plan_name || (log.subscription?.plan_id ? `#${log.subscription.plan_id}` : '') || (log.subscription_id ? `#${log.subscription_id}` : ''),
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
  { key: 'billing_source', label: t('usage.billingSource'), sortable: false },
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
const loadSavedErrColumns = () => {
  try {
    const saved = localStorage.getItem(ERR_HIDDEN_COLUMNS_KEY)
    const values = saved ? (JSON.parse(saved) as string[]) : ERR_DEFAULT_HIDDEN_COLUMNS
    values.forEach((key) => errHiddenColumns.add(key))
  } catch {
    ERR_DEFAULT_HIDDEN_COLUMNS.forEach((key) => errHiddenColumns.add(key))
  }
}

const currentColumnPickerColumns = computed(() => {
  const columns = activeTab.value === 'errors' ? errAllColumns.value : allColumns.value
  const required = new Set(activeTab.value === 'errors' ? ERR_ALWAYS_VISIBLE : ALWAYS_VISIBLE)
  return columns.map(column => ({
    key: column.key,
    label: column.label,
    required: required.has(column.key),
  }))
})

const currentVisibleColumnKeys = computed(() => activeTab.value === 'errors'
  ? errVisibleColumnKeys.value
  : visibleColumns.value.map(column => column.key)
)

function updateCurrentVisibleColumns(keys: string[]) {
  const selected = new Set(keys)
  if (activeTab.value === 'errors') {
    errToggleableColumns.value.forEach(column => {
      if (selected.has(column.key)) errHiddenColumns.delete(column.key)
      else errHiddenColumns.add(column.key)
    })
    localStorage.setItem(ERR_HIDDEN_COLUMNS_KEY, JSON.stringify([...errHiddenColumns]))
    return
  }

  toggleableColumns.value.forEach(column => {
    if (selected.has(column.key)) hiddenColumns.delete(column.key)
    else hiddenColumns.add(column.key)
  })
  localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify([...hiddenColumns]))
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
  const seq = ++errorReqSeq
  errorLoading.value = true
  errorRowsError.value = null
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
    if (seq === errorReqSeq) {
      errorRows.value = resp.items
      errorTotal.value = resp.total
    }
  } catch (error) {
    if (seq !== errorReqSeq) return
    console.error('[UsageView] loadErrors failed:', error)
    errorRowsError.value = t('usage.errors.failedToLoad')
    appStore.showError(t('usage.errors.failedToLoad'))
  } finally {
    if (seq === errorReqSeq) errorLoading.value = false
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
  void loadFilterOptions()
  refreshData()
})

onUnmounted(() => {
  abortController?.abort()
})

</script>

<style scoped>
.usage-filter-section {
  padding-top: 16px;
}

.usage-filter-field {
  width: min(100%, 190px);
  min-width: 150px;
  flex: 1 1 160px;
}

.usage-filter-field--range {
  display: grid;
  width: min(100%, 390px);
  min-width: 260px;
  flex-basis: 310px;
  gap: 4px;
}

.usage-filter-label {
  min-height: 22px;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: 22px;
}

.usage-applied-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-top: 10px;
}

.usage-applied-filters > span:first-child {
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 500;
}

.usage-stats-region,
.usage-analytics-grid__item {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.usage-stats-loading {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.usage-retry-banner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.usage-analytics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 20px 0;
}

.usage-analytics-grid__trend {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .usage-stats-loading {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.usage-tabs {
  display: flex;
  align-items: center;
}

.usage-workspace-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.usage-error-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.usage-advanced-filter-toggle {
  display: none;
}

.usage-advanced-filter-fields {
  display: contents;
}

@media (max-width: 1023px) {
  .usage-analytics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .usage-analytics-grid__endpoint {
    grid-column: 1 / -1;
  }

  .usage-error-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .usage-advanced-filter-toggle {
    display: inline-flex;
  }
  .usage-retry-banner {
    grid-template-columns: minmax(0, 1fr);
  }

  .usage-filter-field--mobile-hidden {
    display: none;
  }

  .usage-filter-field,
  .usage-filter-field--range {
    width: 100%;
    min-width: 0;
    flex-basis: 100%;
  }

  .usage-analytics-grid,
  .usage-error-filters {
    grid-template-columns: minmax(0, 1fr);
  }

  .usage-analytics-grid__endpoint {
    grid-column: auto;
  }
}

</style>
