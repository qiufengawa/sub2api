<template>
  <UiChartFrame
    class="token-usage-trend"
    :class="{ 'token-usage-trend--compact': props.compact }"
    :title="t('admin.dashboard.tokenUsageTrend')"
    :height="220"
  >
    <UiLoadingOverlay v-if="loading" :show="true" :label="t('common.loading')">
      <div class="token-usage-trend__state" />
    </UiLoadingOverlay>
    <div v-else-if="trendData.length > 0 && chartData" class="token-usage-trend__chart" role="img" :aria-label="t('admin.dashboard.tokenUsageTrend')">
      <Line :data="chartData" :options="lineOptions" />
    </div>
    <UiEmptyState v-else :title="t('admin.dashboard.noDataAvailable')" />
  </UiChartFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import { UiChartFrame, UiEmptyState, UiLoadingOverlay } from '@/components/ui'
import type { TrendDataPoint } from '@/types'
import { calculateCacheTokenReuseRate } from '@/utils/usageMetrics'
import { useReducedMotion } from '@/composables/useReducedMotion'
import { useDarkMode } from '@/composables/useDarkMode'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const { t } = useI18n()
const reducedMotion = useReducedMotion()
const isDarkMode = useDarkMode()

const props = withDefaults(defineProps<{
  trendData: TrendDataPoint[]
  loading?: boolean
  compact?: boolean
  colorScheme?: 'default' | 'blue' | 'categorical'
}>(), {
  loading: false,
  compact: false,
  colorScheme: 'default',
})

const chartColors = computed(() => ({
  text: isDarkMode.value ? '#e5e7eb' : '#374151',
  grid: isDarkMode.value ? '#374151' : '#e5e7eb',
  input: props.colorScheme === 'categorical' ? '#4f46e5' : '#366ef4',
  output: props.colorScheme === 'blue' ? '#5b8ff9' : props.colorScheme === 'categorical' ? '#8b5cf6' : '#10b981',
  cacheCreation: props.colorScheme === 'blue' ? '#93b5ff' : '#f59e0b',
  cacheRead: props.colorScheme === 'blue' ? '#b6d2ff' : '#06b6d4',
  cacheHitRate: props.colorScheme === 'blue' ? '#64748b' : props.colorScheme === 'categorical' ? '#db2777' : '#8b5cf6'
}))

const chartData = computed(() => {
  if (!props.trendData?.length) return null

  return {
    labels: props.trendData.map((d) => d.date),
    datasets: [
      {
        label: 'Input',
        data: props.trendData.map((d) => d.input_tokens),
        borderColor: chartColors.value.input,
        backgroundColor: `${chartColors.value.input}20`,
        fill: true,
        pointRadius: 0,
        tension: 0.3
      },
      {
        label: 'Output',
        data: props.trendData.map((d) => d.output_tokens),
        borderColor: chartColors.value.output,
        backgroundColor: `${chartColors.value.output}20`,
        fill: props.colorScheme !== 'blue',
        pointRadius: 0,
        tension: 0.3
      },
      {
        label: 'Cache Creation',
        data: props.trendData.map((d) => d.cache_creation_tokens),
        borderColor: chartColors.value.cacheCreation,
        backgroundColor: `${chartColors.value.cacheCreation}20`,
        borderDash: props.colorScheme === 'blue' ? [5, 3] : undefined,
        fill: props.colorScheme !== 'blue',
        pointRadius: 0,
        tension: 0.3
      },
      {
        label: 'Cache Read',
        data: props.trendData.map((d) => d.cache_read_tokens),
        borderColor: chartColors.value.cacheRead,
        backgroundColor: `${chartColors.value.cacheRead}20`,
        borderDash: props.colorScheme === 'blue' ? [2, 3] : undefined,
        fill: props.colorScheme !== 'blue',
        pointRadius: 0,
        tension: 0.3
      },
      {
        label: t('usage.cacheHitRate'),
        data: props.trendData.map((d) => calculateCacheTokenReuseRate(
          d.input_tokens,
          d.cache_creation_tokens,
          d.cache_read_tokens
        )),
        borderColor: chartColors.value.cacheHitRate,
        backgroundColor: `${chartColors.value.cacheHitRate}20`,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0,
        tension: 0.3,
        yAxisID: 'yPercent'
      }
    ]
  }
})

const lineOptions = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  ...(reducedMotion.value ? { animation: false } : {}),
  interaction: {
    intersect: false,
    mode: 'index' as const
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: chartColors.value.text,
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 10,
        font: {
          size: 11
        }
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          if (context.dataset.yAxisID === 'yPercent') {
            return `${context.dataset.label}: ${context.raw.toFixed(1)}%`
          }
          return `${context.dataset.label}: ${formatTokens(context.raw)}`
        },
        footer: (tooltipItems: any) => {
          const dataIndex = tooltipItems[0]?.dataIndex
          if (dataIndex !== undefined && props.trendData[dataIndex]) {
            const data = props.trendData[dataIndex]
            return `Actual: $${formatCost(data.actual_cost)} | Standard: $${formatCost(data.cost)}`
          }
          return ''
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        color: chartColors.value.grid
      },
      ticks: {
        color: chartColors.value.text,
        font: {
          size: 10
        }
      }
    },
    y: {
      grid: {
        color: chartColors.value.grid
      },
      ticks: {
        color: chartColors.value.text,
        font: {
          size: 10
        },
        callback: (value: string | number) => formatTokens(Number(value))
      }
    },
    yPercent: {
      position: 'right' as const,
      min: 0,
      max: 100,
      grid: {
        drawOnChartArea: false
      },
      ticks: {
        color: chartColors.value.cacheHitRate,
        font: {
          size: 10
        },
        callback: (value: string | number) => `${value}%`
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

<style scoped>
.token-usage-trend__chart,
.token-usage-trend__state {
  height: 192px;
}

.token-usage-trend--compact :deep(.ui-chart-frame__body) {
  padding: 8px;
}
</style>
