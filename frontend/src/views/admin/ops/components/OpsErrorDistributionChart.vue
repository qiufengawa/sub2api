<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Chart as ChartJS, ArcElement, Legend, Tooltip } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import type { OpsErrorDistributionResponse } from '@/api/admin/ops'
import type { ChartState } from '../types'
import { UiChartFrame, UiChartLegend, UiFieldHelp, UiIconButton } from '@/components/ui'

ChartJS.register(ArcElement, Tooltip, Legend)

interface Props {
  data: OpsErrorDistributionResponse | null
  loading: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'openDetails'): void
}>()
const { t } = useI18n()

const isDarkMode = computed(() => document.documentElement.classList.contains('dark'))
const colors = computed(() => ({
  blue: '#3b82f6',
  red: '#ef4444',
  orange: '#f59e0b',
  gray: '#9ca3af',
  text: isDarkMode.value ? '#9ca3af' : '#6b7280'
}))

const totalSlaErrors = computed(() =>
  (props.data?.items ?? []).reduce((total, item) => total + Number(item.sla || 0), 0)
)

const hasData = computed(() => totalSlaErrors.value > 0)

const state = computed<ChartState>(() => {
  if (hasData.value) return 'ready'
  if (props.loading) return 'loading'
  return 'empty'
})

interface ErrorCategory {
  label: string
  count: number
  color: string
}

const categories = computed<ErrorCategory[]>(() => {
  if (!props.data) return []

  let upstream = 0 // 502, 503, 504
  let client = 0 // 4xx
  let system = 0 // 500
  let other = 0

  for (const item of props.data.items || []) {
    const code = Number(item.status_code || 0)
    const count = Number(item.sla || 0)
    if (!Number.isFinite(code) || !Number.isFinite(count)) continue

    if ([502, 503, 504].includes(code)) upstream += count
    else if (code >= 400 && code < 500) client += count
    else if (code === 500) system += count
    else other += count
  }

  const out: ErrorCategory[] = []
  if (upstream > 0) out.push({ label: t('admin.ops.upstream'), count: upstream, color: colors.value.orange })
  if (client > 0) out.push({ label: t('admin.ops.client'), count: client, color: colors.value.blue })
  if (system > 0) out.push({ label: t('admin.ops.system'), count: system, color: colors.value.red })
  if (other > 0) out.push({ label: t('admin.ops.other'), count: other, color: colors.value.gray })
  return out
})

const topReason = computed(() => {
  if (categories.value.length === 0) return null
  return categories.value.reduce((prev, cur) => (cur.count > prev.count ? cur : prev))
})

const chartData = computed(() => {
  if (!hasData.value || categories.value.length === 0) return null
  return {
    labels: categories.value.map((c) => c.label),
    datasets: [
      {
        data: categories.value.map((c) => c.count),
        backgroundColor: categories.value.map((c) => c.color),
        borderWidth: 0
      }
    ]
  }
})

const legendItems = computed(() => categories.value.map((item) => ({
  label: item.label,
  color: item.color,
  value: item.count,
})))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: isDarkMode.value ? '#1f2937' : '#ffffff',
      titleColor: isDarkMode.value ? '#f3f4f6' : '#111827',
      bodyColor: isDarkMode.value ? '#d1d5db' : '#4b5563'
    }
  }
}))
</script>

<template>
  <UiChartFrame
    :title="t('admin.ops.errorDistribution')"
    :loading="state === 'loading'"
    :loading-label="t('common.loading')"
    :empty="state === 'empty'"
    :empty-title="t('common.noData')"
    :empty-description="t('admin.ops.charts.emptyError')"
    :height="160"
  >
    <template #actions>
      <UiFieldHelp :content="t('admin.ops.tooltips.errorDistribution')" />
      <UiIconButton
        icon="eye"
        density="dense"
        variant="ghost"
        :disabled="state !== 'ready'"
        :label="t('admin.ops.requestDetails.details')"
        @click="emit('openDetails')"
      />
    </template>

    <div v-if="chartData" class="ops-error-distribution__chart">
      <Doughnut :data="chartData" :options="{ ...options, cutout: '65%' }" />
    </div>

    <template v-if="chartData" #footer>
      <span v-if="topReason" class="ops-error-distribution__top">
        {{ t('admin.ops.top') }}:
        <b :style="{ color: topReason.color }">{{ topReason.label }}</b>
      </span>
      <UiChartLegend :items="legendItems" />
    </template>
  </UiChartFrame>
</template>

<style scoped>
.ops-error-distribution__chart{width:100%;height:100%;min-height:0}.ops-error-distribution__top{margin-right:auto;color:var(--ui-text-muted);font-size:11px}.ops-error-distribution__top b{font-weight:600}
</style>
