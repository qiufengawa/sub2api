<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AppInline,
  UiDataCell,
  UiDataTable,
  UiErrorState,
  UiPagination,
  UiSelect,
  UiServerTableWorkspace,
  type Column,
} from '@/components/ui'
import { opsAPI, type OpsOpenAITokenStatsResponse, type OpsOpenAITokenStatsTimeRange } from '@/api/admin/ops'
import { formatNumber } from '@/utils/format'

interface Props {
  platformFilter?: string
  groupIdFilter?: number | null
  refreshToken: number
}

type ViewMode = 'topn' | 'pagination'

const props = withDefaults(defineProps<Props>(), {
  platformFilter: '',
  groupIdFilter: null
})

const { t } = useI18n()

const loading = ref(false)
const errorMessage = ref('')
const response = ref<OpsOpenAITokenStatsResponse | null>(null)

const timeRange = ref<OpsOpenAITokenStatsTimeRange>('30d')
const viewMode = ref<ViewMode>('topn')
const topN = ref<number>(20)
const page = ref<number>(1)
const pageSize = ref<number>(20)

const items = computed(() => response.value?.items ?? [])
const total = computed(() => response.value?.total ?? 0)
const totalPages = computed(() => {
  if (viewMode.value !== 'pagination') return 1
  const size = pageSize.value > 0 ? pageSize.value : 20
  return Math.max(1, Math.ceil(total.value / size))
})

const timeRangeOptions = computed(() => [
  { value: '30m', label: t('admin.ops.timeRange.30m') },
  { value: '1h', label: t('admin.ops.timeRange.1h') },
  { value: '1d', label: t('admin.ops.timeRange.1d') },
  { value: '15d', label: t('admin.ops.timeRange.15d') },
  { value: '30d', label: t('admin.ops.timeRange.30d') }
])

const viewModeOptions = computed(() => [
  { value: 'topn', label: t('admin.ops.openaiTokenStats.viewModeTopN') },
  { value: 'pagination', label: t('admin.ops.openaiTokenStats.viewModePagination') }
])

const topNOptions = computed(() => [
  { value: 10, label: 'Top 10' },
  { value: 20, label: 'Top 20' },
  { value: 50, label: 'Top 50' },
  { value: 100, label: 'Top 100' }
])

const pageSizeOptions = computed(() => [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' }
])

const columns = computed<Column[]>(() => [
  { key: 'model', label: t('admin.ops.openaiTokenStats.table.model') },
  { key: 'request_count', label: t('admin.ops.openaiTokenStats.table.requestCount') },
  { key: 'avg_tokens_per_sec', label: t('admin.ops.openaiTokenStats.table.avgTokensPerSec') },
  { key: 'avg_first_token_ms', label: t('admin.ops.openaiTokenStats.table.avgFirstTokenMs') },
  { key: 'total_output_tokens', label: t('admin.ops.openaiTokenStats.table.totalOutputTokens') },
  { key: 'avg_duration_ms', label: t('admin.ops.openaiTokenStats.table.avgDurationMs') },
  { key: 'requests_with_first_token', label: t('admin.ops.openaiTokenStats.table.requestsWithFirstToken') },
])

function formatRate(v?: number | null): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-'
  return v.toFixed(2)
}

function formatInt(v?: number | null): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-'
  return formatNumber(Math.round(v))
}

function buildParams() {
  const params: Record<string, any> = {
    time_range: timeRange.value,
    platform: props.platformFilter || undefined,
    group_id: typeof props.groupIdFilter === 'number' && props.groupIdFilter > 0 ? props.groupIdFilter : undefined
  }

  if (viewMode.value === 'topn') {
    params.top_n = topN.value
  } else {
    params.page = page.value
    params.page_size = pageSize.value
  }
  return params
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    response.value = await opsAPI.getOpenAITokenStats(buildParams())
    // 防御：若 total 变化导致当前页超出最大页，则回退到末页并重新拉取一次。
    if (viewMode.value === 'pagination' && page.value > totalPages.value) {
      page.value = totalPages.value
      response.value = await opsAPI.getOpenAITokenStats(buildParams())
    }
  } catch (err: any) {
    console.error('[OpsOpenAITokenStatsCard] Failed to load data', err)
    response.value = null
    errorMessage.value = err?.message || t('admin.ops.openaiTokenStats.failedToLoad')
  } finally {
    loading.value = false
  }
}

watch(
  () => ({
    timeRange: timeRange.value,
    viewMode: viewMode.value,
    topN: topN.value,
    page: page.value,
    pageSize: pageSize.value,
    platform: props.platformFilter,
    groupId: props.groupIdFilter,
    refreshToken: props.refreshToken
  }),
  (next, prev) => {
    // 避免“筛选变化 -> 重置页码 -> 触发两次请求”：
    // 先只重置页码，等待下一次 watch（仅 page 变化）再发起请求。
    const filtersChanged = !prev ||
      next.timeRange !== prev.timeRange ||
      next.viewMode !== prev.viewMode ||
      next.pageSize !== prev.pageSize ||
      next.platform !== prev.platform ||
      next.groupId !== prev.groupId

    if (next.viewMode === 'pagination' && filtersChanged && next.page !== 1) {
      page.value = 1
      return
    }

    void loadData()
  },
  { immediate: true }
)

function updatePage(value: number) {
  if (viewMode.value === 'pagination') page.value = value
}

function updatePageSize(value: number) {
  if (viewMode.value !== 'pagination') return
  pageSize.value = value
}
</script>

<template>
  <UiServerTableWorkspace
    :title="t('admin.ops.openaiTokenStats.title')"
    :loading="loading"
    :loading-text="t('admin.ops.loadingText')"
    :empty="!errorMessage && items.length === 0"
    :empty-title="t('common.noData')"
    :empty-description="t('admin.ops.openaiTokenStats.empty')"
  >
    <template #actions>
      <AppInline class="ops-token-stats__filters" :gap="8">
        <UiSelect v-model="timeRange" :options="timeRangeOptions" density="compact" />
        <UiSelect v-model="viewMode" :options="viewModeOptions" density="compact" />
        <UiSelect
          v-if="viewMode === 'topn'"
          v-model="topN"
          :options="topNOptions"
          density="compact"
        />
      </AppInline>
    </template>

    <UiErrorState
      v-if="errorMessage"
      :title="t('admin.ops.openaiTokenStats.failedToLoad')"
      :description="errorMessage"
      :retry-text="t('common.retry')"
      @retry="loadData"
    />
    <div v-else-if="items.length" class="ops-token-stats__table">
      <UiDataTable
        :columns="columns"
        :data="items"
        :loading="false"
        :mobile-table="true"
        :aria-label="t('admin.ops.openaiTokenStats.title')"
      >
        <template #cell-model="{ row }">
          <UiDataCell :value="row.model" mono />
        </template>
        <template #cell-request_count="{ row }">{{ formatInt(row.request_count) }}</template>
        <template #cell-avg_tokens_per_sec="{ row }">{{ formatRate(row.avg_tokens_per_sec) }}</template>
        <template #cell-avg_first_token_ms="{ row }">{{ formatRate(row.avg_first_token_ms) }}</template>
        <template #cell-total_output_tokens="{ row }">{{ formatInt(row.total_output_tokens) }}</template>
        <template #cell-avg_duration_ms="{ row }">{{ formatInt(row.avg_duration_ms) }}</template>
        <template #cell-requests_with_first_token="{ row }">{{ formatInt(row.requests_with_first_token) }}</template>
      </UiDataTable>
    </div>

    <template #footer>
      <span v-if="viewMode === 'topn'" class="ops-token-stats__summary">
        {{ t('admin.ops.openaiTokenStats.totalModels', { total }) }}
      </span>
    </template>
    <template v-if="viewMode === 'pagination' && total > 0" #pagination>
      <UiPagination
        :page="page"
        :page-size="pageSize"
        :page-size-options="pageSizeOptions.map((option) => Number(option.value))"
        :total="total"
        @update:page="updatePage"
        @update:page-size="updatePageSize"
      />
    </template>
  </UiServerTableWorkspace>
</template>

<style scoped>
.ops-token-stats__filters > * {
  width: 144px;
}

.ops-token-stats__filters > *:last-child {
  width: 112px;
}

.ops-token-stats__table {
  max-height: 520px;
  overflow: auto;
}

.ops-token-stats__summary {
  color: var(--ui-text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .ops-token-stats__filters {
    width: 100%;
  }

  .ops-token-stats__filters > * {
    width: min(100%, 144px);
  }
}
</style>
