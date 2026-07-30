<template>
  <section class="card relative flex h-full min-h-[360px] flex-col overflow-hidden xl:h-[470px] xl:min-h-[470px]" data-testid="dashboard-trend-card">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700">
      <div>
        <h2 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('dashboard.overview.usageTrend') }}</h2>
        <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">
          {{ t('dashboard.overview.periodSummary', { cost: formatMoney(periodCost), requests: formatNumber(periodRequests) }) }}
        </p>
        <p v-if="!loading" class="mt-0.5 text-[11px] text-gray-400 dark:text-dark-500">
          {{ t('dashboard.overview.periodComparison', { cost: formatChange(periodCost, previousPeriodCost), requests: formatChange(periodRequests, previousPeriodRequests) }) }}
        </p>
      </div>
      <div class="inline-flex rounded-[3px] border border-gray-200 bg-gray-50 p-0.5 dark:border-dark-600 dark:bg-dark-800">
        <button
          v-for="days in ranges"
          :key="days"
          type="button"
          class="min-h-7 rounded-[2px] px-2.5 text-xs font-medium transition-colors"
          :class="rangeDays === days ? 'bg-white text-primary-700 shadow-sm dark:bg-dark-700 dark:text-primary-300' : 'text-gray-500 hover:text-gray-900 dark:text-dark-400 dark:hover:text-gray-200'"
          @click="$emit('update:rangeDays', days)"
        >
          {{ t(days === 7 ? 'dashboard.overview.last7Days' : 'dashboard.overview.last30Days') }}
        </button>
      </div>
    </div>

    <div class="relative min-h-[258px] flex-1 p-4">
      <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-dark-800/70">
        <LoadingSpinner size="md" />
      </div>
      <Chart v-if="hasData" :type="chartType" :data="chartData" :options="chartOptions" />
      <div v-else class="flex h-full flex-col items-center justify-center text-center">
        <div class="flex h-9 w-9 items-center justify-center rounded-[3px] bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Icon name="chartBar" size="md" />
        </div>
        <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('dashboard.overview.noTrendTitle') }}</p>
        <p class="mt-1 max-w-sm text-xs leading-5 text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.noTrendDescription') }}</p>
        <router-link :to="hasApiKey ? '/available-channels' : '/keys'" class="btn btn-secondary btn-sm mt-3">
          {{ t(hasApiKey ? 'dashboard.overview.viewAvailableModels' : 'dashboard.overview.viewApiKeys') }}
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import type { TrendDataPoint } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const props = defineProps<{
  loading: boolean
  rangeDays: 7 | 30
  trend: TrendDataPoint[]
  previousTrend?: TrendDataPoint[]
  hasApiKey?: boolean
}>()

defineEmits<{
  'update:rangeDays': [days: 7 | 30]
}>()

const { t, locale } = useI18n()
const ranges = [7, 30] as const
type MixedChartType = 'bar' | 'line'
const chartType: MixedChartType = 'bar'
const hasData = computed(() => props.trend.some((item) => item.requests > 0 || item.actual_cost > 0))
const periodCost = computed(() => props.trend.reduce((sum, item) => sum + item.actual_cost, 0))
const periodRequests = computed(() => props.trend.reduce((sum, item) => sum + item.requests, 0))
const previousPeriodCost = computed(() => (props.previousTrend ?? []).reduce((sum, item) => sum + item.actual_cost, 0))
const previousPeriodRequests = computed(() => (props.previousTrend ?? []).reduce((sum, item) => sum + item.requests, 0))

const labels = computed(() => props.trend.map((item) => {
  const date = new Date(`${item.date}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? item.date
    : new Intl.DateTimeFormat(locale.value, { month: 'numeric', day: 'numeric' }).format(date)
}))

const chartData = computed<ChartData<MixedChartType, number[], string>>(() => ({
  labels: labels.value,
  datasets: [
    {
      type: 'line',
      label: t('dashboard.overview.actualCost'),
      data: props.trend.map((item) => item.actual_cost),
      borderColor: '#366ef4',
      backgroundColor: 'rgba(97, 141, 255, 0.12)',
      pointBackgroundColor: '#366ef4',
      pointBorderWidth: 0,
      pointRadius: props.rangeDays === 7 ? 2.5 : 0,
      pointHoverRadius: 4,
      borderWidth: 2,
      tension: 0.32,
      fill: true,
      yAxisID: 'yCost',
      order: 1,
    },
    {
      type: 'bar',
      label: t('dashboard.overview.requests'),
      data: props.trend.map((item) => item.requests),
      backgroundColor: 'rgba(181, 199, 255, 0.46)',
      borderColor: 'rgba(142, 171, 255, 0.75)',
      borderWidth: 1,
      borderRadius: 2,
      maxBarThickness: 18,
      yAxisID: 'yRequests',
      order: 2,
    },
  ],
}))

const chartOptions = computed<ChartOptions<MixedChartType>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
  plugins: {
    legend: {
      position: 'bottom',
      align: 'start',
      labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'rectRounded', padding: 16 },
    },
    tooltip: {
      callbacks: {
        label: (context: TooltipItem<MixedChartType>) => context.dataset.yAxisID === 'yCost'
          ? `${context.dataset.label}: ${formatMoney(Number(context.parsed.y ?? 0))}`
          : `${context.dataset.label}: ${formatNumber(Number(context.parsed.y ?? 0))}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: props.rangeDays === 7 ? 7 : 8, maxRotation: 0, color: '#8b8b8b' },
      border: { display: false },
    },
    yCost: {
      position: 'left',
      beginAtZero: true,
      grid: { color: 'rgba(166, 166, 166, 0.16)' },
      border: { display: false },
      ticks: { color: '#8b8b8b', callback: (value: string | number) => `$${Number(value).toFixed(2)}` },
    },
    yRequests: {
      position: 'right',
      beginAtZero: true,
      grid: { display: false },
      border: { display: false },
      ticks: { color: '#8b8b8b', precision: 0 },
    },
  },
}))

const formatMoney = (value: number) => `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`
const formatNumber = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const formatChange = (current: number, previous: number) => {
  if (previous <= 0) return current > 0 ? t('dashboard.overview.newInPeriod') : '0%'
  const percent = Math.round(((current - previous) / previous) * 100)
  return `${percent > 0 ? '+' : ''}${percent}%`
}
</script>
