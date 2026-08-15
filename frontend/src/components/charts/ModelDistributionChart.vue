<template>
  <UiChartFrame
    class="model-distribution"
    :title="chartTitle"
    :height="220"
  >
    <template #actions>
      <div class="model-distribution__actions">
        <UiSegmentedControl
          v-if="showSourceToggle"
          :model-value="source"
          :options="sourceOptions"
          :label="t('admin.dashboard.sourceSelectorLabel')"
          @update:model-value="updateSource"
        />
        <UiSegmentedControl
          v-if="showMetricToggle"
          :model-value="metric"
          :options="metricOptions"
          :label="t('admin.dashboard.metricSelectorLabel')"
          @update:model-value="updateMetric"
        />
        <UiSegmentedControl
          v-if="enableRankingView"
          :model-value="activeView"
          :options="viewOptions"
          :label="t('admin.dashboard.viewSelectorLabel')"
          @update:model-value="updateActiveView"
        />
      </div>
    </template>

    <UiLoadingOverlay
      v-if="activeView === 'model_distribution' && loading"
      :show="true"
      :label="t('common.loading')"
    ><div class="chart-state-space" /></UiLoadingOverlay>
    <div
      v-else-if="activeView === 'model_distribution' && displayMode === 'ranking' && displayModelStats.length > 0"
      class="model-ranking"
      data-testid="model-distribution-ranking"
    >
      <div v-for="(model, index) in displayModelStats" :key="model.model" class="model-ranking__item">
        <div class="model-ranking__header">
          <div class="model-ranking__identity">
            <span class="model-ranking__index ui-numeric">{{ index + 1 }}</span>
            <span class="model-ranking__name" :title="model.model">{{ model.model }}</span>
          </div>
          <div class="model-ranking__values ui-numeric">
            <span>{{ formatNumber(model.requests) }} {{ t('admin.dashboard.requests') }}</span>
            <strong>{{ formatMetricValue(model) }}</strong>
          </div>
        </div>
        <div class="model-ranking__track">
          <div class="model-ranking__bar bg-primary-500" :style="rankingBarStyle(model, index)"></div>
        </div>
      </div>
    </div>
    <div
      v-else-if="activeView === 'model_distribution' && displayMode !== 'ranking' && displayModelStats.length > 0 && chartData"
      class="chart-split"
    >
      <div class="chart-split__visual">
        <Doughnut :data="chartData" :options="doughnutOptions" />
      </div>
      <UiMobileTableScroller class="chart-split__table" :label="t('admin.dashboard.modelDistribution')" min-width="620px">
        <table class="chart-table">
          <thead>
            <tr>
              <th>{{ t('admin.dashboard.model') }}</th>
              <th class="is-numeric">{{ t('admin.dashboard.requests') }}</th>
              <th class="is-numeric">{{ t('admin.dashboard.tokens') }}</th>
              <th class="is-numeric">{{ t('admin.dashboard.actual') }}</th>
              <th v-if="showAccountCost" class="is-numeric">{{ t('admin.dashboard.accountCost') }}</th>
              <th class="is-numeric">{{ t('admin.dashboard.standard') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="model in displayModelStats" :key="model.model">
              <tr
                :class="{ 'is-clickable': enableBreakdown }"
                @click="enableBreakdown && toggleBreakdown('model', model.model)"
              >
                <td
                  class="chart-table__primary"
                  :title="model.model"
                >
                  <button
                    v-if="enableBreakdown"
                    type="button"
                    class="chart-table__toggle"
                    :aria-expanded="expandedKey === `model-${model.model}`"
                    @click.stop="toggleBreakdown('model', model.model)"
                  >
                    <Icon
                      :name="expandedKey === `model-${model.model}` ? 'chevronDown' : 'chevronRight'"
                      size="xs"
                    />
                    {{ model.model }}
                  </button>
                  <span v-else class="chart-table__label">{{ model.model }}</span>
                </td>
                <td class="is-numeric">
                  {{ formatNumber(model.requests) }}
                </td>
                <td class="is-numeric">
                  {{ formatTokens(model.total_tokens) }}
                </td>
                <td class="is-numeric is-success">
                  ${{ formatCost(model.actual_cost) }}
                </td>
                <td v-if="showAccountCost" class="is-numeric is-warning">
                  ${{ formatCost(model.account_cost) }}
                </td>
                <td class="is-numeric is-muted">
                  ${{ formatCost(model.cost) }}
                </td>
              </tr>
              <tr v-if="expandedKey === `model-${model.model}`">
                  <td :colspan="distributionColspan" class="chart-table__details">
                  <UserBreakdownSubTable
                    :items="breakdownItems"
                    :loading="breakdownLoading"
                    :show-account-cost="showAccountCost"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </UiMobileTableScroller>
    </div>
    <UiEmptyState v-else-if="activeView === 'model_distribution'" :title="t('admin.dashboard.noDataAvailable')" />

    <UiLoadingOverlay v-else-if="rankingLoading" :show="true" :label="t('common.loading')"><div class="chart-state-space" /></UiLoadingOverlay>
    <UiErrorState v-else-if="rankingError" :title="t('admin.dashboard.failedToLoad')" :retry-text="''" />
    <div v-else-if="rankingDisplayItems.length > 0 && rankingChartData" class="chart-split">
      <div class="chart-split__visual">
        <Doughnut :data="rankingChartData" :options="rankingDoughnutOptions" />
      </div>
      <UiMobileTableScroller class="chart-split__table" :label="t('admin.dashboard.spendingRankingTitle')" min-width="480px">
        <table class="chart-table">
          <thead>
            <tr>
              <th>{{ t('admin.dashboard.spendingRankingUser') }}</th>
              <th class="is-numeric">{{ t('admin.dashboard.spendingRankingRequests') }}</th>
              <th class="is-numeric">{{ t('admin.dashboard.spendingRankingTokens') }}</th>
              <th class="is-numeric">{{ t('admin.dashboard.spendingRankingSpend') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in rankingDisplayItems"
              :key="item.isOther ? 'others' : `${item.user_id}-${index}`"
              :class="item.isOther ? 'is-summary' : 'is-clickable'"
              @click="item.isOther ? undefined : emit('ranking-click', item)"
            >
              <td>
                <component
                  :is="item.isOther ? 'div' : 'button'"
                  :type="item.isOther ? undefined : 'button'"
                  class="ranking-user"
                  @click.stop="item.isOther ? undefined : emit('ranking-click', item)"
                >
                  <span class="ranking-user__index ui-numeric">
                    {{ item.isOther ? 'Σ' : `#${index + 1}` }}
                  </span>
                  <span
                    class="ranking-user__label"
                    :title="getRankingRowLabel(item)"
                  >
                    {{ getRankingRowLabel(item) }}
                  </span>
                </component>
              </td>
              <td class="is-numeric">
                {{ formatNumber(item.requests) }}
              </td>
              <td class="is-numeric">
                {{ formatTokens(item.tokens) }}
              </td>
              <td class="is-numeric is-success">
                ${{ formatCost(item.actual_cost) }}
              </td>
            </tr>
          </tbody>
        </table>
      </UiMobileTableScroller>
    </div>
    <UiEmptyState v-else :title="t('admin.dashboard.noDataAvailable')" />
  </UiChartFrame>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import Icon from '@/components/icons/Icon.vue'
import {
  UiChartFrame,
  UiEmptyState,
  UiErrorState,
  UiLoadingOverlay,
  UiMobileTableScroller,
  UiSegmentedControl,
} from '@/components/ui'
import UserBreakdownSubTable from './UserBreakdownSubTable.vue'
import type { ModelStat, UserSpendingRankingItem, UserBreakdownItem } from '@/types'
import { getUserBreakdown } from '@/api/admin/dashboard'
import { getStableCategoryColor } from '@/utils/categoricalColors'

ChartJS.register(ArcElement, Tooltip, Legend)

const { t } = useI18n()

type DistributionMetric = 'tokens' | 'actual_cost'
type ModelSource = 'requested' | 'upstream' | 'mapping'
type DistributionDisplayMode = 'doughnut' | 'ranking'
type DistributionColorScheme = 'default' | 'blue' | 'categorical'
type RankingDisplayItem = UserSpendingRankingItem & { isOther?: boolean }
const props = withDefaults(defineProps<{
  modelStats: ModelStat[]
  upstreamModelStats?: ModelStat[]
  mappingModelStats?: ModelStat[]
  source?: ModelSource
  enableRankingView?: boolean
  rankingItems?: UserSpendingRankingItem[]
  rankingTotalActualCost?: number
  rankingTotalRequests?: number
  rankingTotalTokens?: number
  loading?: boolean
  metric?: DistributionMetric
  showSourceToggle?: boolean
  showMetricToggle?: boolean
  enableBreakdown?: boolean
  showAccountCost?: boolean
  rankingLoading?: boolean
  rankingError?: boolean
  startDate?: string
  endDate?: string
  filters?: Record<string, any>
  displayMode?: DistributionDisplayMode
  colorScheme?: DistributionColorScheme
  maxItems?: number
  aggregateOther?: boolean
}>(), {
  upstreamModelStats: () => [],
  mappingModelStats: () => [],
  source: 'requested',
  enableRankingView: false,
  rankingItems: () => [],
  rankingTotalActualCost: 0,
  rankingTotalRequests: 0,
  rankingTotalTokens: 0,
  loading: false,
  metric: 'tokens',
  showSourceToggle: false,
  showMetricToggle: false,
  enableBreakdown: true,
  showAccountCost: true,
  rankingLoading: false,
  rankingError: false,
  displayMode: 'doughnut',
  colorScheme: 'default',
  maxItems: 0,
  aggregateOther: false,
})

const expandedKey = ref<string | null>(null)
const breakdownItems = ref<UserBreakdownItem[]>([])
const breakdownLoading = ref(false)

const toggleBreakdown = async (type: string, id: string) => {
  const key = `${type}-${id}`
  if (expandedKey.value === key) {
    expandedKey.value = null
    return
  }
  expandedKey.value = key
  breakdownLoading.value = true
  breakdownItems.value = []
  try {
    const res = await getUserBreakdown({
      ...props.filters,
      start_date: props.startDate,
      end_date: props.endDate,
      model: id,
      model_source: props.source,
    })
    breakdownItems.value = res.users || []
  } catch {
    breakdownItems.value = []
  } finally {
    breakdownLoading.value = false
  }
}

const emit = defineEmits<{
  'update:metric': [value: DistributionMetric]
  'update:source': [value: ModelSource]
  'ranking-click': [item: UserSpendingRankingItem]
}>()

const enableRankingView = computed(() => props.enableRankingView)
const showAccountCost = computed(() => props.showAccountCost)
const distributionColspan = computed(() => showAccountCost.value ? 6 : 5)
const activeView = ref<'model_distribution' | 'spending_ranking'>('model_distribution')
const chartTitle = computed(() => !enableRankingView.value || activeView.value === 'model_distribution'
  ? t('admin.dashboard.modelDistribution')
  : t('admin.dashboard.spendingRankingTitle'))
const sourceOptions = computed(() => [
  { value: 'requested', label: t('usage.requestedModel') },
  { value: 'upstream', label: t('usage.upstreamModel') },
  { value: 'mapping', label: t('usage.mapping') },
])
const metricOptions = computed(() => [
  { value: 'tokens', label: t('admin.dashboard.metricTokens') },
  { value: 'actual_cost', label: t('admin.dashboard.metricActualCost') },
])
const viewOptions = computed(() => [
  { value: 'model_distribution', label: t('admin.dashboard.viewModelDistribution') },
  { value: 'spending_ranking', label: t('admin.dashboard.viewSpendingRanking') },
])
const updateSource = (value: string | number) => emit('update:source', value as ModelSource)
const updateMetric = (value: string | number) => emit('update:metric', value as DistributionMetric)
const updateActiveView = (value: string | number) => {
  activeView.value = value as typeof activeView.value
}

const chartColors = [
  '#366ef4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
  '#06b6d4',
  '#a855f7'
]
const blueChartColors = ['#366ef4', '#5b8ff9', '#7aa7f8', '#93b5ff', '#adc8ff', '#c6d8ff']

const displayModelStats = computed(() => {
  const sourceStats = props.source === 'upstream'
    ? props.upstreamModelStats
    : props.source === 'mapping'
      ? props.mappingModelStats
      : props.modelStats
  if (!sourceStats?.length) return []

  const metricKey = props.metric === 'actual_cost' ? 'actual_cost' : 'total_tokens'
  const sorted = [...sourceStats].sort((a, b) => toFiniteNumber(b[metricKey]) - toFiniteNumber(a[metricKey]))
  if (props.maxItems <= 0 || sorted.length <= props.maxItems) return sorted

  const visible = sorted.slice(0, props.maxItems)
  const remaining = sorted.slice(props.maxItems)
  if (!props.aggregateOther) return visible
  visible.push({
    model: t('usage.rankingOther'),
    requests: remaining.reduce((sum, item) => sum + toFiniteNumber(item.requests), 0),
    input_tokens: remaining.reduce((sum, item) => sum + toFiniteNumber(item.input_tokens), 0),
    output_tokens: remaining.reduce((sum, item) => sum + toFiniteNumber(item.output_tokens), 0),
    cache_creation_tokens: remaining.reduce((sum, item) => sum + toFiniteNumber(item.cache_creation_tokens), 0),
    cache_read_tokens: remaining.reduce((sum, item) => sum + toFiniteNumber(item.cache_read_tokens), 0),
    total_tokens: remaining.reduce((sum, item) => sum + toFiniteNumber(item.total_tokens), 0),
    actual_cost: remaining.reduce((sum, item) => sum + toFiniteNumber(item.actual_cost), 0),
    account_cost: remaining.reduce((sum, item) => sum + toFiniteNumber(item.account_cost), 0),
    cost: remaining.reduce((sum, item) => sum + toFiniteNumber(item.cost), 0),
  })
  return visible
})

const distributionColors = computed(() => props.colorScheme === 'blue' ? blueChartColors : chartColors)
const rankingMaxValue = computed(() => Math.max(...displayModelStats.value.map(metricValue), 0))

function metricValue(model: ModelStat): number {
  return toFiniteNumber(props.metric === 'actual_cost' ? model.actual_cost : model.total_tokens)
}

function formatMetricValue(model: ModelStat): string {
  const value = metricValue(model)
  return props.metric === 'actual_cost' ? `$${formatCost(value)}` : formatTokens(value)
}

function rankingBarStyle(model: ModelStat, index: number) {
  const percentage = rankingMaxValue.value > 0 ? (metricValue(model) / rankingMaxValue.value) * 100 : 0
  return {
    width: `${Math.max(percentage, 2)}%`,
    opacity: props.colorScheme === 'categorical' ? '1' : String(Math.max(0.48, 1 - index * 0.09)),
    backgroundColor: props.colorScheme === 'categorical'
      ? getStableCategoryColor(model.model, model.model === t('usage.rankingOther'))
      : undefined,
  }
}

const chartData = computed(() => {
  if (!displayModelStats.value.length) return null

  return {
    labels: displayModelStats.value.map((m) => m.model),
    datasets: [
      {
        data: displayModelStats.value.map((m) => toFiniteNumber(props.metric === 'actual_cost' ? m.actual_cost : m.total_tokens)),
        backgroundColor: displayModelStats.value.map((model, index) =>
          props.colorScheme === 'categorical'
            ? getStableCategoryColor(model.model, model.model === t('usage.rankingOther'))
            : distributionColors.value[index % distributionColors.value.length]
        ),
        borderWidth: 0
      }
    ]
  }
})

const rankingChartData = computed(() => {
  if (!props.rankingItems?.length) return null

  const labels = props.rankingItems.map((item, index) => `#${index + 1} ${getRankingUserLabel(item)}`)
  const data = props.rankingItems.map((item) => toFiniteNumber(item.actual_cost))
  const backgroundColor = chartColors.slice(0, props.rankingItems.length)

  if (otherRankingItem.value) {
    labels.push(t('admin.dashboard.spendingRankingOther'))
    data.push(otherRankingItem.value.actual_cost)
    backgroundColor.push('#94a3b8')
  }

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor,
        borderWidth: 0
      }
    ]
  }
})

const otherRankingItem = computed<RankingDisplayItem | null>(() => {
  if (!props.rankingItems?.length) return null

  const rankedActualCost = props.rankingItems.reduce((sum, item) => sum + toFiniteNumber(item.actual_cost), 0)
  const rankedRequests = props.rankingItems.reduce((sum, item) => sum + toFiniteNumber(item.requests), 0)
  const rankedTokens = props.rankingItems.reduce((sum, item) => sum + toFiniteNumber(item.tokens), 0)

  const otherActualCost = Math.max((props.rankingTotalActualCost || 0) - rankedActualCost, 0)
  const otherRequests = Math.max((props.rankingTotalRequests || 0) - rankedRequests, 0)
  const otherTokens = Math.max((props.rankingTotalTokens || 0) - rankedTokens, 0)

  if (otherActualCost <= 0.000001 && otherRequests <= 0 && otherTokens <= 0) return null

  return {
    user_id: 0,
    email: '',
    username: '',
    actual_cost: otherActualCost,
    requests: otherRequests,
    tokens: otherTokens,
    isOther: true
  }
})

const rankingDisplayItems = computed<RankingDisplayItem[]>(() => {
  if (!props.rankingItems?.length) return []
  return otherRankingItem.value
    ? [...props.rankingItems, otherRankingItem.value]
    : [...props.rankingItems]
})

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.raw as number
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          const formattedValue = props.metric === 'actual_cost'
            ? `$${formatCost(value)}`
            : formatTokens(value)
          return `${context.label}: ${formattedValue} (${percentage}%)`
        }
      }
    }
  }
}))

const rankingDoughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.raw as number
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0)
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          return `${context.label}: $${formatCost(value)} (${percentage}%)`
        }
      }
    }
  }
}))

const formatTokens = (value: number): string => {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toLocaleString()
}

const formatNumber = (value: number): string => {
  return toFiniteNumber(value).toLocaleString()
}

const getRankingUserLabel = (item: UserSpendingRankingItem): string => {
  if (item.username?.trim()) return item.username.trim()
  if (item.email?.trim()) return item.email.trim()
  return t('admin.redeem.userPrefix', { id: item.user_id })
}

const getRankingRowLabel = (item: RankingDisplayItem): string => {
  if (item.isOther) return t('admin.dashboard.spendingRankingOther')
  return getRankingUserLabel(item)
}

const toFiniteNumber = (value: unknown): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const formatCost = (value: number | null | undefined): string => {
  const safeValue = toFiniteNumber(value)
  if (safeValue >= 1000) {
    return (safeValue / 1000).toFixed(2) + 'K'
  } else if (safeValue >= 1) {
    return safeValue.toFixed(2)
  } else if (safeValue >= 0.01) {
    return safeValue.toFixed(3)
  }
  return safeValue.toFixed(4)
}
</script>

<style scoped>
.model-distribution__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.chart-state-space { min-height: 192px; }
.model-ranking { display: grid; gap: 10px; padding: 2px 0; }
.model-ranking__item { display: grid; gap: 5px; }
.model-ranking__header,
.model-ranking__identity,
.model-ranking__values,
.ranking-user { display: flex; align-items: center; }
.model-ranking__header { justify-content: space-between; gap: 12px; font-size: 12px; }
.model-ranking__identity,
.ranking-user { min-width: 0; gap: 7px; }
.model-ranking__index { width: 18px; flex: none; color: var(--ui-text-soft); font-size: 10px; }
.model-ranking__name,
.ranking-user__label { min-width: 0; overflow: hidden; color: var(--ui-text); font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.model-ranking__values { flex: none; gap: 8px; color: var(--ui-text-soft); font-size: 10px; }
.model-ranking__values strong { color: var(--ui-text); font-size: 12px; font-weight: 600; }
.model-ranking__track { height: 6px; margin-left: 25px; overflow: hidden; border-radius: 2px; background: var(--ui-surface-muted); }
.model-ranking__bar { height: 100%; border-radius: inherit; }
.chart-split { display: grid; grid-template-columns: 192px minmax(0, 1fr); align-items: center; gap: 14px; min-width: 0; }
.chart-split__visual { width: 192px; height: 192px; }
.chart-split__table { max-height: 192px; }
.chart-table { width: 100%; border-collapse: collapse; color: var(--ui-text-muted); font-size: 12px; }
.chart-table th,
.chart-table td { padding: 7px 8px; border-bottom: 1px solid var(--ui-border-soft); text-align: left; white-space: nowrap; }
.chart-table th { color: var(--ui-text-soft); font-size: 11px; font-weight: 500; }
.chart-table tbody tr:last-child > td { border-bottom: 0; }
.chart-table tr.is-clickable { cursor: pointer; transition: background var(--ui-motion-fast); }
.chart-table tr.is-clickable:hover,
.chart-table tr.is-summary { background: var(--ui-surface-muted); }
.chart-table .is-numeric { text-align: right; font-variant-numeric: tabular-nums; }
.chart-table__primary { max-width: 150px; overflow: hidden; color: var(--ui-text); font-weight: 500; text-overflow: ellipsis; }
.chart-table__label { display: inline-flex; max-width: 100%; align-items: center; gap: 4px; }
.chart-table__toggle,
.ranking-user:is(button) { padding: 0; border: 0; color: inherit; background: transparent; font: inherit; cursor: pointer; }
.chart-table__toggle { display: inline-flex; max-width: 100%; align-items: center; gap: 4px; }
.chart-table__toggle:focus-visible,
.ranking-user:is(button):focus-visible { border-radius: 2px; outline: 2px solid var(--ui-focus); outline-offset: 2px; }
.chart-table__details { padding: 0 !important; }
.is-success { color: var(--ui-success); }
.is-warning { color: var(--ui-warning); }
.is-muted,
.ranking-user__index { color: var(--ui-text-soft); }
.ranking-user__index { flex: none; font-size: 11px; font-weight: 600; }
.ranking-user__label { display: block; max-width: 180px; }
.model-distribution :deep(.ui-chart-frame__tools) { min-width: 0; flex-wrap: wrap; justify-content: flex-end; }
@media (max-width: 760px) {
  .chart-split { grid-template-columns: minmax(0, 1fr); }
  .chart-split__visual { justify-self: center; }
  .model-distribution__actions { justify-content: flex-start; }
}
</style>
