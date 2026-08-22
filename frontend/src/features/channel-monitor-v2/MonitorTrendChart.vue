<template>
  <UiChartFrame
    :title="t('channelMonitorV2.chart.title')"
    :description="t('channelMonitorV2.chart.description')"
    :loading="loading"
    :loading-label="t('common.loading')"
    :empty="!chartData"
    :empty-title="t('channelMonitorV2.chart.emptyTitle')"
    :empty-description="t('channelMonitorV2.empty.description')"
    :height="300"
  >
    <template #legend>
      <UiChartLegend :items="legendItems" />
    </template>
    <template #actions>
      <UiBadge>{{ bucketLabel }}</UiBadge>
      <UiButton
        density="dense"
        variant="quiet"
        :disabled="!zoomed"
        @click="resetChartZoom"
      >
        {{ t('channelMonitorV2.chart.resetZoom') }}
      </UiButton>
    </template>

    <div v-if="chartData" ref="chartRef" class="trend-chart" @wheel="onChartWheel">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </UiChartFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref, watch } from 'vue'
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
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { MonitorCoverage, MonitorMetric, MonitorHealth } from '@/api/channelMonitorV2'
import { UiBadge, UiButton, UiChartFrame, UiChartLegend } from '@/components/ui'
import { formatMonitorMs, formatMonitorPercent } from '@/features/channel-monitor-v2/monitorFormat'
import {
  applyWheelZoom,
  clientXRatio,
  isZoomed,
  resetZoom,
  sliceByZoom,
  type ZoomState,
} from '@/features/channel-monitor-v2/monitorZoom'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)
const { t, locale } = useI18n()

const props = defineProps<{
  trend: Array<{ bucket_start: string; metrics: MonitorMetric; health: MonitorHealth }>
  coverage: MonitorCoverage | null
  loading?: boolean
}>()

const chartRef = ref<HTMLElement | null>(null)
const zoom = ref<ZoomState>(resetZoom())
const zoomed = computed(() => isZoomed(zoom.value))
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value || undefined, {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}))

function colorToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

const chartColors = computed(() => ({
  danger: colorToken('--ui-danger', '#ef4444'),
  dangerSoft: colorToken('--ui-danger-soft', 'rgba(239, 68, 68, .10)'),
  success: colorToken('--ui-success', '#10b981'),
  successSoft: colorToken('--ui-success-soft', 'rgba(16, 185, 129, .08)'),
  info: colorToken('--ui-info', '#0ea5e9'),
  infoSoft: colorToken('--ui-info-soft', 'rgba(14, 165, 233, .08)'),
  text: colorToken('--ui-text-muted', '#6b7280'),
  textStrong: colorToken('--ui-text', '#111827'),
  surface: colorToken('--ui-surface', '#ffffff'),
  border: colorToken('--ui-border-soft', '#f3f4f6'),
}))

const legendItems = computed(() => [
  { label: t('channelMonitorV2.chart.errorLegend'), color: chartColors.value.danger },
  { label: t('channelMonitorV2.chart.cacheLegend'), color: chartColors.value.success },
  { label: t('channelMonitorV2.chart.ttftLegend'), color: chartColors.value.info },
])

const bucketLabel = computed(() => {
  const seconds = props.coverage?.bucket_seconds || 60
  const minutes = seconds / 60
  if (minutes < 60) return t('channelMonitorV2.bucket.minutes', { count: minutes })
  const hours = minutes / 60
  if (hours < 24) return t('channelMonitorV2.bucket.hours', { count: hours })
  return t('channelMonitorV2.bucket.days', { count: hours / 24 })
})

const chartData = computed(() => {
  const points = visibleTrend.value
  if (!points.length) return null
  const labels = points.map((p) => dateFormatter.value.format(new Date(p.bucket_start)))
  const errorRates = smoothTrend(points.map((p) => (p.metrics.error_rate || 0) * 100))
  const cacheRates = smoothTrend(points.map((p) => (p.metrics.cache_rate || 0) * 100))
  const ttftP50 = smoothTrend(points.map((p) => p.metrics.ttft?.p50_ms ?? null))
  return {
    labels,
    datasets: [
      {
        label: t('channelMonitorV2.chart.errorDataset'),
        data: errorRates,
        borderColor: chartColors.value.danger,
        backgroundColor: chartColors.value.dangerSoft,
        yAxisID: 'yPct',
        tension: 0.4,
        cubicInterpolationMode: 'monotone' as const,
        fill: 'origin' as const,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 10,
        borderWidth: 2,
      },
      {
        label: t('channelMonitorV2.chart.cacheDataset'),
        data: cacheRates,
        borderColor: chartColors.value.success,
        backgroundColor: chartColors.value.successSoft,
        yAxisID: 'yPct',
        tension: 0.4,
        cubicInterpolationMode: 'monotone' as const,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 10,
        borderWidth: 2,
      },
      {
        label: t('channelMonitorV2.chart.ttftDataset'),
        data: ttftP50,
        borderColor: chartColors.value.info,
        backgroundColor: chartColors.value.infoSoft,
        yAxisID: 'yTtft',
        tension: 0.4,
        cubicInterpolationMode: 'monotone' as const,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 10,
        borderWidth: 2,
        spanGaps: true,
      },
    ],
  }
})

/** Window the series by zoom state around the cursor — not always the last N points. */
const visibleTrend = computed(() => downsampleTrend(sliceByZoom(props.trend || [], zoom.value), 240))

/** Keep Chart.js responsive even when an API returns thousands of buckets. */
function downsampleTrend(points: Array<{ bucket_start: string; metrics: MonitorMetric; health: MonitorHealth }>, maxPoints: number) {
  if (points.length <= maxPoints) return points
  const step = (points.length - 1) / (maxPoints - 1)
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * step)])
}

function onChartWheel(event: WheelEvent) {
  // Plain vertical wheel zooms X (narrower time range); shift/horizontal pans.
  event.preventDefault()
  const ratio = clientXRatio(event.clientX, chartRef.value)
  zoom.value = applyWheelZoom(zoom.value, event, ratio)
}

function resetChartZoom() {
  zoom.value = resetZoom()
}

watch(() => props.trend, () => {
  zoom.value = resetZoom()
})

function smoothTrend(values: Array<number | null>): Array<number | null> {
  if (values.length <= 2) return values
  return values.map((value, index) => {
    if (value == null) return null
    const neighbors = values.slice(Math.max(0, index - 1), Math.min(values.length, index + 2))
      .filter((item): item is number => item != null)
    if (!neighbors.length) return value
    return neighbors.reduce((sum, item) => sum + item, 0) / neighbors.length
  })
}

const chartOptions = computed(() => {
  const text = chartColors.value.text
  const grid = chartColors.value.border
  const tooltipBg = chartColors.value.surface
  const tooltipTitle = chartColors.value.textStrong
  const tooltipBody = chartColors.value.text
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        borderColor: grid,
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        callbacks: {
          label(ctx: { dataset: { label?: string }; parsed: { y: number | null } }) {
            const label = ctx.dataset.label || ''
            const y = ctx.parsed.y
            if (y == null) return `${label}: -`
            if (label === t('channelMonitorV2.chart.errorDataset') || label === t('channelMonitorV2.chart.cacheDataset')) {
              return `${label}: ${formatMonitorPercent(y / 100)}`
            }
            return `${label}: ${formatMonitorMs(y)}`
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: text, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, autoSkipPadding: 10, font: { size: 10 } },
        grid: { display: false },
      },
      yPct: {
        type: 'linear' as const,
        position: 'left' as const,
        min: 0,
        suggestedMax: 100,
        ticks: {
          color: text,
          font: { size: 10 },
          callback: (v: string | number) => `${v}%`,
        },
        grid: { color: grid, borderDash: [4, 4] },
        title: { display: true, text: t('channelMonitorV2.chart.percentAxis'), color: text, font: { size: 11 } },
      },
      yTtft: {
        type: 'linear' as const,
        position: 'right' as const,
        min: 0,
        ticks: {
          color: chartColors.value.info,
          font: { size: 10 },
          callback: (v: string | number) => formatMonitorMs(Number(v)),
        },
        grid: { display: false },
        title: { display: true, text: t('channelMonitorV2.metrics.ttftP50'), color: chartColors.value.info, font: { size: 11 } },
      },
    },
  }
})
</script>

<style scoped>
.trend-chart {
  height: 300px;
  min-width: 0;
}
</style>
