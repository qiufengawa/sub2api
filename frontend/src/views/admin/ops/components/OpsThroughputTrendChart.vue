<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Title, Tooltip } from 'chart.js'
import { Line } from 'vue-chartjs'
import type { ChartComponentRef } from 'vue-chartjs'
import type { OpsThroughputGroupBreakdownItem, OpsThroughputPlatformBreakdownItem, OpsThroughputTrendPoint } from '@/api/admin/ops'
import type { ChartState } from '../types'
import { formatHistoryLabel, sumNumbers } from '../utils/opsFormatters'
import {
  AppInline,
  UiButton,
  UiChartFrame,
  UiChartLegend,
  UiFieldHelp,
  UiIconButton,
} from '@/components/ui'
import { formatNumber } from '@/utils/format'

ChartJS.register(Title, Tooltip, Legend, LineElement, LinearScale, PointElement, CategoryScale, Filler)

interface Props {
  points: OpsThroughputTrendPoint[]
  loading: boolean
  timeRange: string
  byPlatform?: OpsThroughputPlatformBreakdownItem[]
  topGroups?: OpsThroughputGroupBreakdownItem[]
  fullscreen?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()
const emit = defineEmits<{
  (e: 'selectPlatform', platform: string): void
  (e: 'selectGroup', groupId: number): void
  (e: 'openDetails'): void
}>()

const throughputChartRef = ref<ChartComponentRef | null>(null)
watch(
  () => props.timeRange,
  () => {
    setTimeout(() => {
      const chart: any = throughputChartRef.value?.chart
      if (chart && typeof chart.resetZoom === 'function') {
        chart.resetZoom()
      }
    }, 100)
  }
)

const isDarkMode = computed(() => document.documentElement.classList.contains('dark'))
const colors = computed(() => ({
  blue: '#3b82f6',
  blueAlpha: '#3b82f620',
  cyan: '#06b6d4',
  cyanAlpha: '#06b6d420',
  grid: isDarkMode.value ? '#374151' : '#f3f4f6',
  text: isDarkMode.value ? '#9ca3af' : '#6b7280'
}))

const totalRequests = computed(() => sumNumbers(props.points.map((p) => p.request_count)))
const chartPoints = computed(() => {
  const points = props.points
  if (points.length <= 240) return points
  const step = (points.length - 1) / 239
  return Array.from({ length: 240 }, (_, index) => points[Math.round(index * step)])
})

const chartData = computed(() => {
  if (!chartPoints.value.length || totalRequests.value <= 0) return null
  return {
    labels: chartPoints.value.map((p) => formatHistoryLabel(p.bucket_start, props.timeRange)),
    datasets: [
      {
        label: 'QPS',
        data: chartPoints.value.map((p) => p.qps ?? 0),
        borderColor: colors.value.blue,
        backgroundColor: colors.value.blueAlpha,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 10
      },
      {
        label: t('admin.ops.tpsK'),
        data: chartPoints.value.map((p) => (p.tps ?? 0) / 1000),
        borderColor: colors.value.cyan,
        backgroundColor: colors.value.cyanAlpha,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 10,
        yAxisID: 'y1'
      }
    ]
  }
})

const state = computed<ChartState>(() => {
  if (chartData.value) return 'ready'
  if (props.loading) return 'loading'
  return 'empty'
})

const legendItems = computed(() => [
  { label: 'QPS', color: colors.value.blue },
  { label: t('admin.ops.tpsK'), color: colors.value.cyan },
])

const options = computed(() => {
  const c = colors.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' as const },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: { color: c.text, usePointStyle: true, boxWidth: 6, font: { size: 10 } }
      },
      tooltip: {
        backgroundColor: isDarkMode.value ? '#1f2937' : '#ffffff',
        titleColor: isDarkMode.value ? '#f3f4f6' : '#111827',
        bodyColor: isDarkMode.value ? '#d1d5db' : '#4b5563',
        borderColor: c.grid,
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || ''
            if (label) label += ': '
            if (context.raw !== null) label += context.parsed.y.toFixed(1)
            return label
          }
        }
      },
      // Optional: if chartjs-plugin-zoom is installed, these options will enable zoom/pan.
      zoom: {
        pan: { enabled: true, mode: 'x' as const, modifierKey: 'ctrl' as const },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' as const }
      }
    },
    scales: {
      x: {
        type: 'category' as const,
        grid: { display: false },
        ticks: {
          color: c.text,
          font: { size: 10 },
          maxTicksLimit: 8,
          autoSkip: true,
          autoSkipPadding: 10
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: { color: c.grid, borderDash: [4, 4] },
        ticks: { color: c.text, font: { size: 10 } }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: { display: false },
        ticks: { color: c.cyan, font: { size: 10 } }
      }
    }
  }
})

function resetZoom() {
  const chart: any = throughputChartRef.value?.chart
  if (chart && typeof chart.resetZoom === 'function') chart.resetZoom()
}

function downloadChart() {
  const chart: any = throughputChartRef.value?.chart
  if (!chart || typeof chart.toBase64Image !== 'function') return
  const url = chart.toBase64Image('image/png', 1)
  const a = document.createElement('a')
  a.href = url
  a.download = `ops-throughput-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`
  a.click()
}
</script>

<template>
  <UiChartFrame
    data-testid="throughput-chart-header"
    :title="t('admin.ops.throughputTrend')"
    :loading="state === 'loading'"
    :loading-label="t('common.loading')"
    :empty="state === 'empty'"
    :empty-title="t('common.noData')"
    :empty-description="t('admin.ops.charts.emptyRequest')"
    :height="300"
  >
    <template #legend>
      <UiChartLegend :items="legendItems" />
    </template>
    <template #actions>
      <AppInline
        data-testid="throughput-chart-toolbar"
        :gap="4"
      >
        <UiFieldHelp v-if="!props.fullscreen" :content="t('admin.ops.tooltips.throughputTrend')" />
        <template v-if="!props.fullscreen">
          <UiIconButton
            icon="eye"
            density="dense"
            variant="ghost"
            :disabled="state !== 'ready'"
            :label="t('admin.ops.requestDetails.title')"
            @click="emit('openDetails')"
          />
          <UiIconButton
            icon="refresh"
            density="dense"
            variant="ghost"
            :disabled="state !== 'ready'"
            :label="t('admin.ops.charts.resetZoomHint')"
            @click="resetZoom"
          />
          <UiIconButton
            icon="download"
            density="dense"
            variant="ghost"
            :disabled="state !== 'ready'"
            :label="t('admin.ops.charts.downloadChartHint')"
            @click="downloadChart"
          />
        </template>
      </AppInline>
    </template>

    <div v-if="(props.topGroups?.length ?? 0) > 0" class="ops-throughput__drilldown">
      <UiButton
        v-for="g in props.topGroups"
        :key="g.group_id"
        density="mini"
        variant="secondary"
        @click="emit('selectGroup', g.group_id)"
      >
        <span class="ops-throughput__name">{{ g.group_name || `#${g.group_id}` }}</span>
        <span class="ops-throughput__count">{{ formatNumber(g.request_count) }}</span>
      </UiButton>
    </div>

    <div v-else-if="(props.byPlatform?.length ?? 0) > 0" class="ops-throughput__drilldown">
      <UiButton
        v-for="p in props.byPlatform"
        :key="p.platform"
        density="mini"
        variant="secondary"
        @click="emit('selectPlatform', p.platform)"
      >
        <span class="ops-throughput__platform">{{ p.platform }}</span>
        <span class="ops-throughput__count">{{ formatNumber(p.request_count) }}</span>
      </UiButton>
    </div>

    <div v-if="chartData" class="ops-throughput__canvas">
      <Line ref="throughputChartRef" :data="chartData" :options="options" />
    </div>
  </UiChartFrame>
</template>

<style scoped>
.ops-throughput__drilldown{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.ops-throughput__name{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ops-throughput__platform{text-transform:uppercase}.ops-throughput__count{color:var(--ui-text-soft);font-variant-numeric:tabular-nums}.ops-throughput__canvas{position:relative;width:100%;height:260px;min-height:0;overflow:hidden}.ops-throughput__canvas :deep(canvas){display:block!important;width:100%!important;height:100%!important;max-height:260px}
</style>
