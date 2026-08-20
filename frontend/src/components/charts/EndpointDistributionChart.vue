<template>
  <div class="ui-panel p-3">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ title || t('usage.endpointDistribution') }}
      </h3>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <div
          v-if="showSourceToggle"
          class="inline-flex rounded-[3px] border border-gray-200 bg-gray-50 p-0.5 dark:border-dark-700 dark:bg-dark-800"
        >
          <UiSegmentedControl
            :model-value="source"
            :options="sourceOptions"
            :label="t('admin.dashboard.sourceSelectorLabel')"
            @update:model-value="emit('update:source', $event as EndpointSource)"
          />
        </div>

        <div
          v-if="showMetricToggle"
          class="inline-flex rounded-[3px] border border-gray-200 bg-gray-50 p-0.5 dark:border-dark-700 dark:bg-dark-800"
        >
          <UiSegmentedControl
            :model-value="metric"
            :options="metricOptions"
            :label="t('admin.dashboard.metricSelectorLabel')"
            @update:model-value="emit('update:metric', $event as DistributionMetric)"
          />
        </div>
      </div>
    </div>
    <div v-if="loading" class="flex h-48 items-center justify-center">
      <UiSpinner />
    </div>
    <div v-else-if="displayMode === 'ranking' && displayEndpointStats.length > 0" class="space-y-2.5 py-1" data-testid="endpoint-distribution-ranking">
      <div v-for="(item, index) in displayEndpointStats" :key="item.endpoint" class="space-y-1">
        <div class="flex items-center justify-between gap-3 text-xs">
          <div class="flex min-w-0 items-center gap-2">
            <span class="w-4 shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-dark-500">{{ index + 1 }}</span>
            <span class="truncate font-medium text-gray-700 dark:text-gray-200" :title="item.endpoint">{{ item.endpoint }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-2 tabular-nums">
            <span class="text-[10px] text-gray-400 dark:text-dark-500">{{ formatNumber(item.requests) }} {{ t('admin.dashboard.requests') }}</span>
            <span class="font-medium text-gray-800 dark:text-gray-100">{{ formatMetricValue(item) }}</span>
          </div>
        </div>
        <div class="ml-6 h-1.5 overflow-hidden rounded-sm bg-primary-50 dark:bg-dark-700">
          <div class="h-full rounded-sm bg-primary-500" :style="rankingBarStyle(item, index)"></div>
        </div>
      </div>
    </div>
    <div v-else-if="displayEndpointStats.length > 0 && chartData" class="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
      <div class="h-48 w-48 shrink-0" role="img" :aria-label="title || t('usage.endpointDistribution')">
        <Doughnut :data="chartData" :options="doughnutOptions" />
      </div>
      <div class="max-h-48 w-full min-w-0 flex-1 overflow-auto">
        <table class="w-full text-xs" :aria-label="title || t('usage.endpointDistribution')">
          <caption class="sr-only">{{ title || t('usage.endpointDistribution') }}</caption>
          <thead>
            <tr class="text-gray-500 dark:text-gray-400">
              <th class="pb-2 text-left">{{ t('usage.endpoint') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.requests') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.tokens') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.actual') }}</th>
              <th class="pb-2 text-right">{{ t('admin.dashboard.standard') }}</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in displayEndpointStats" :key="item.endpoint">
              <tr
                class="border-t border-gray-100 transition-colors dark:border-dark-700"
                :class="enableBreakdown ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700/40' : ''"
                :role="enableBreakdown ? 'button' : undefined"
                :tabindex="enableBreakdown ? 0 : undefined"
                :aria-expanded="enableBreakdown ? expandedKey === item.endpoint : undefined"
                :aria-controls="enableBreakdown ? `endpoint-breakdown-${encodeURIComponent(item.endpoint)}` : undefined"
                @click="enableBreakdown && toggleBreakdown(item.endpoint)"
                @keydown="handleEndpointRowKeydown($event, item.endpoint)"
              >
                <td class="max-w-[180px] truncate py-1.5 font-medium" :class="enableBreakdown ? 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300' : 'text-gray-900 dark:text-white'" :title="item.endpoint">
                  <span class="inline-flex items-center gap-1">
                    <Icon v-if="enableBreakdown" :name="expandedKey === item.endpoint ? 'chevronDown' : 'chevronRight'" size="xs" />
                    {{ item.endpoint }}
                  </span>
                </td>
                <td class="py-1.5 text-right text-gray-600 dark:text-gray-400">
                  {{ formatNumber(item.requests) }}
                </td>
                <td class="py-1.5 text-right text-gray-600 dark:text-gray-400">
                  {{ formatTokens(item.total_tokens) }}
                </td>
                <td class="py-1.5 text-right text-green-600 dark:text-green-400">
                  ${{ formatCost(item.actual_cost) }}
                </td>
                <td class="py-1.5 text-right text-gray-400 dark:text-gray-500">
                  ${{ formatCost(item.cost) }}
                </td>
              </tr>
              <tr v-if="expandedKey === item.endpoint" :id="`endpoint-breakdown-${encodeURIComponent(item.endpoint)}`">
                <td colspan="5" class="p-0">
                  <UserBreakdownSubTable
                    :items="breakdownItems"
                    :loading="breakdownLoading"
                  />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('admin.dashboard.noDataAvailable') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import { UiSegmentedControl, UiSpinner } from '@/components/ui'
import Icon from '@/components/icons/Icon.vue'
import UserBreakdownSubTable from './UserBreakdownSubTable.vue'
import type { EndpointStat, UserBreakdownItem } from '@/types'
import { getUserBreakdown } from '@/api/admin/dashboard'
import { getStableCategoryColor } from '@/utils/categoricalColors'
import { useReducedMotion } from '@/composables/useReducedMotion'

ChartJS.register(ArcElement, Tooltip, Legend)

const { t } = useI18n()
const reducedMotion = useReducedMotion()

type DistributionMetric = 'tokens' | 'actual_cost'
type EndpointSource = 'inbound' | 'upstream' | 'path'
type DistributionDisplayMode = 'doughnut' | 'ranking'
type DistributionColorScheme = 'default' | 'blue' | 'categorical'

const props = withDefaults(
  defineProps<{
    endpointStats: EndpointStat[]
    upstreamEndpointStats?: EndpointStat[]
    endpointPathStats?: EndpointStat[]
    loading?: boolean
    title?: string
    metric?: DistributionMetric
    source?: EndpointSource
    showMetricToggle?: boolean
    showSourceToggle?: boolean
    enableBreakdown?: boolean
    startDate?: string
    endDate?: string
    filters?: Record<string, any>
    displayMode?: DistributionDisplayMode
    colorScheme?: DistributionColorScheme
    maxItems?: number
    aggregateOther?: boolean
  }>(),
  {
    upstreamEndpointStats: () => [],
    endpointPathStats: () => [],
    loading: false,
    title: '',
    metric: 'tokens',
    source: 'inbound',
    showMetricToggle: false,
    showSourceToggle: false,
    enableBreakdown: true,
    displayMode: 'doughnut',
    colorScheme: 'default',
    maxItems: 0,
    aggregateOther: false,
  }
)

const emit = defineEmits<{
  'update:metric': [value: DistributionMetric]
  'update:source': [value: EndpointSource]
}>()

const sourceOptions = computed(() => [
  { value: 'inbound' as EndpointSource, label: t('usage.inbound') },
  { value: 'upstream' as EndpointSource, label: t('usage.upstream') },
  { value: 'path' as EndpointSource, label: t('usage.path') },
])

const metricOptions = computed(() => [
  { value: 'tokens' as DistributionMetric, label: t('admin.dashboard.metricTokens') },
  { value: 'actual_cost' as DistributionMetric, label: t('admin.dashboard.metricActualCost') },
])

const expandedKey = ref<string | null>(null)
const breakdownItems = ref<UserBreakdownItem[]>([])
const breakdownLoading = ref(false)

const toggleBreakdown = async (endpoint: string) => {
  if (expandedKey.value === endpoint) {
    expandedKey.value = null
    return
  }
  expandedKey.value = endpoint
  breakdownLoading.value = true
  breakdownItems.value = []
  try {
    const res = await getUserBreakdown({
      ...props.filters,
      start_date: props.startDate,
      end_date: props.endDate,
      endpoint,
      endpoint_type: props.source,
    })
    breakdownItems.value = res.users || []
  } catch {
    breakdownItems.value = []
  } finally {
    breakdownLoading.value = false
  }
}

const handleEndpointRowKeydown = (event: KeyboardEvent, endpoint: string) => {
  if (!props.enableBreakdown) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  void toggleBreakdown(endpoint)
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

const displayEndpointStats = computed(() => {
  const sourceStats = props.source === 'upstream'
    ? props.upstreamEndpointStats
    : props.source === 'path'
      ? props.endpointPathStats
      : props.endpointStats
  if (!sourceStats?.length) return []

  const metricKey = props.metric === 'actual_cost' ? 'actual_cost' : 'total_tokens'
  const sorted = [...sourceStats].sort((a, b) => toFiniteNumber(b[metricKey]) - toFiniteNumber(a[metricKey]))
  if (props.maxItems <= 0 || sorted.length <= props.maxItems) return sorted

  const visible = sorted.slice(0, props.maxItems)
  const remaining = sorted.slice(props.maxItems)
  if (!props.aggregateOther) return visible
  visible.push({
    endpoint: t('usage.rankingOther'),
    requests: remaining.reduce((sum, item) => sum + toFiniteNumber(item.requests), 0),
    total_tokens: remaining.reduce((sum, item) => sum + toFiniteNumber(item.total_tokens), 0),
    actual_cost: remaining.reduce((sum, item) => sum + toFiniteNumber(item.actual_cost), 0),
    cost: remaining.reduce((sum, item) => sum + toFiniteNumber(item.cost), 0),
  })
  return visible
})

const distributionColors = computed(() => props.colorScheme === 'blue' ? blueChartColors : chartColors)
const rankingMaxValue = computed(() => Math.max(...displayEndpointStats.value.map(metricValue), 0))

function metricValue(item: EndpointStat): number {
  return toFiniteNumber(props.metric === 'actual_cost' ? item.actual_cost : item.total_tokens)
}

function formatMetricValue(item: EndpointStat): string {
  const value = metricValue(item)
  return props.metric === 'actual_cost' ? `$${formatCost(value)}` : formatTokens(value)
}

function rankingBarStyle(item: EndpointStat, index: number) {
  const percentage = rankingMaxValue.value > 0 ? (metricValue(item) / rankingMaxValue.value) * 100 : 0
  return {
    width: `${Math.max(percentage, 2)}%`,
    opacity: props.colorScheme === 'categorical' ? '1' : String(Math.max(0.48, 1 - index * 0.09)),
    backgroundColor: props.colorScheme === 'categorical'
      ? getStableCategoryColor(item.endpoint, item.endpoint === t('usage.rankingOther'))
      : undefined,
  }
}

const chartData = computed(() => {
  if (!displayEndpointStats.value?.length) return null

  return {
    labels: displayEndpointStats.value.map((item) => item.endpoint),
    datasets: [
      {
        data: displayEndpointStats.value.map((item) =>
          props.metric === 'actual_cost' ? item.actual_cost : item.total_tokens
        ),
        backgroundColor: displayEndpointStats.value.map((item, index) =>
          props.colorScheme === 'categorical'
            ? getStableCategoryColor(item.endpoint, item.endpoint === t('usage.rankingOther'))
            : distributionColors.value[index % distributionColors.value.length]
        ),
        borderWidth: 0
      }
    ]
  }
})

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  ...(reducedMotion.value ? { animation: false } : {}),
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

const toFiniteNumber = (value: unknown): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const formatCost = (value: number): string => {
  if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K'
  } else if (value >= 1) {
    return value.toFixed(2)
  } else if (value >= 0.01) {
    return value.toFixed(3)
  }
  return value.toFixed(4)
}
</script>
