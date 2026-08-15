<template>
  <UiDialog
    :show="show"
    :title="t('admin.accounts.usageStatistics')"
    width="extra-wide"
    @close="handleClose"
  >
    <AppStack :gap="20">
      <header v-if="account" class="account-stats__header">
        <div>
          <strong>{{ account.name }}</strong>
          <p>{{ t('admin.accounts.last30DaysUsage') }}</p>
        </div>
        <UiStatusBadge :status="account.status" :label="account.status" />
      </header>

      <AppGrid v-if="loading" min="180px" :gap="12" aria-busy="true">
        <UiSkeleton v-for="index in 4" :key="index" height="86px" />
      </AppGrid>

      <UiErrorState
        v-else-if="loadError"
        :title="t('admin.accounts.stats.loadFailed')"
        :description="loadError"
        :retry-text="t('common.retry')"
        @retry="loadStats"
      />

      <template v-else-if="stats">
        <AppGrid min="180px" :gap="12">
          <UiStatMetric
            :label="t('admin.accounts.stats.totalCost')"
            :value="`$${formatCost(stats.summary.total_cost)}`"
            :context="totalCostContext"
          />
          <UiStatMetric
            :label="t('admin.accounts.stats.totalRequests')"
            :value="formatNumber(stats.summary.total_requests)"
            :context="t('admin.accounts.stats.totalCalls')"
          />
          <UiStatMetric
            :label="t('admin.accounts.stats.avgDailyCost')"
            :value="`$${formatCost(stats.summary.avg_daily_cost)}`"
            :context="averageCostContext"
          />
          <UiStatMetric
            :label="t('admin.accounts.stats.avgDailyRequests')"
            :value="formatNumber(Math.round(stats.summary.avg_daily_requests))"
            :context="t('admin.accounts.stats.avgDailyUsage')"
          />
        </AppGrid>

        <AppGrid min="240px" :gap="20">
          <AppSection :title="t('admin.accounts.stats.todayOverview')" divided>
            <UiDescriptionList :items="todayDetails" :columns="1" />
          </AppSection>
          <AppSection :title="t('admin.accounts.stats.highestCostDay')" divided>
            <UiDescriptionList :items="highestCostDetails" :columns="1" />
          </AppSection>
          <AppSection :title="t('admin.accounts.stats.highestRequestDay')" divided>
            <UiDescriptionList :items="highestRequestDetails" :columns="1" />
          </AppSection>
        </AppGrid>

        <AppSection :title="t('admin.accounts.stats.performance')" divided>
          <UiDescriptionList :items="performanceDetails" :columns="3" />
        </AppSection>

        <UiChartFrame
          :title="t('admin.accounts.stats.usageTrend')"
          :empty="!trendChartData"
          :height="256"
        >
          <Line v-if="trendChartData" :data="trendChartData" :options="lineChartOptions" />
        </UiChartFrame>

        <ModelDistributionChart :model-stats="stats.models" :loading="false" />
        <EndpointDistributionChart
          :endpoint-stats="stats.endpoints || []"
          :loading="false"
          :title="t('usage.inboundEndpoint')"
        />
        <EndpointDistributionChart
          :endpoint-stats="stats.upstream_endpoints || []"
          :loading="false"
          :title="t('usage.upstreamEndpoint')"
        />
      </template>

      <UiEmptyState
        v-else
        icon="chartBar"
        :title="t('admin.accounts.stats.noData')"
      />
    </AppStack>

    <template #footer>
      <UiButton variant="secondary" @click="handleClose">
        {{ t('common.close') }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip
} from 'chart.js'
import { Line } from 'vue-chartjs'
import {
  AppGrid,
  AppSection,
  AppStack,
  UiButton,
  UiChartFrame,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiSkeleton,
  UiStatMetric,
  UiStatusBadge
} from '@/components/ui'
import EndpointDistributionChart from '@/components/charts/EndpointDistributionChart.vue'
import ModelDistributionChart from '@/components/charts/ModelDistributionChart.vue'
import { adminAPI } from '@/api/admin'
import type { Account, AccountUsageStatsResponse } from '@/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const { t } = useI18n()

const props = defineProps<{
  show: boolean
  account: Account | null
}>()

const emit = defineEmits<{
  close: []
}>()

const loading = ref(false)
const loadError = ref('')
const stats = ref<AccountUsageStatsResponse | null>(null)
let requestSequence = 0

const isDarkMode = computed(() => document.documentElement.classList.contains('dark'))
const chartColors = computed(() => ({
  text: isDarkMode.value ? '#e5e7eb' : '#374151',
  grid: isDarkMode.value ? '#374151' : '#e5e7eb'
}))

const totalCostContext = computed(() => {
  if (!stats.value) return ''
  return `${t('usage.userBilled')}: $${formatCost(stats.value.summary.total_user_cost)} · ${t('admin.accounts.stats.standardCost')}: $${formatCost(stats.value.summary.total_standard_cost)}`
})

const averageCostContext = computed(() => {
  if (!stats.value) return ''
  return `${t('admin.accounts.stats.basedOnActualDays', { days: stats.value.summary.actual_days_used })} · ${t('usage.userBilled')}: $${formatCost(stats.value.summary.avg_daily_user_cost)}`
})

const todayDetails = computed(() => {
  const today = stats.value?.summary.today
  return [
    { label: t('usage.accountBilled'), value: `$${formatCost(today?.cost || 0)}`, numeric: true },
    { label: t('usage.userBilled'), value: `$${formatCost(today?.user_cost || 0)}`, numeric: true },
    { label: t('admin.accounts.stats.requests'), value: formatNumber(today?.requests || 0), numeric: true },
    { label: t('admin.accounts.stats.tokens'), value: formatTokens(today?.tokens || 0), numeric: true }
  ]
})

const highestCostDetails = computed(() => {
  const day = stats.value?.summary.highest_cost_day
  return [
    { label: t('admin.accounts.stats.date'), value: day?.label || '-' },
    { label: t('usage.accountBilled'), value: `$${formatCost(day?.cost || 0)}`, numeric: true },
    { label: t('usage.userBilled'), value: `$${formatCost(day?.user_cost || 0)}`, numeric: true },
    { label: t('admin.accounts.stats.requests'), value: formatNumber(day?.requests || 0), numeric: true }
  ]
})

const highestRequestDetails = computed(() => {
  const day = stats.value?.summary.highest_request_day
  return [
    { label: t('admin.accounts.stats.date'), value: day?.label || '-' },
    { label: t('admin.accounts.stats.requests'), value: formatNumber(day?.requests || 0), numeric: true },
    { label: t('usage.accountBilled'), value: `$${formatCost(day?.cost || 0)}`, numeric: true },
    { label: t('usage.userBilled'), value: `$${formatCost(day?.user_cost || 0)}`, numeric: true }
  ]
})

const performanceDetails = computed(() => {
  const summary = stats.value?.summary
  if (!summary) return []
  return [
    { label: t('admin.accounts.stats.totalTokens'), value: formatTokens(summary.total_tokens), numeric: true },
    { label: t('admin.accounts.stats.dailyAvgTokens'), value: formatTokens(Math.round(summary.avg_daily_tokens)), numeric: true },
    { label: t('admin.accounts.stats.avgResponseTime'), value: formatDuration(summary.avg_duration_ms), numeric: true },
    { label: t('admin.accounts.stats.daysActive'), value: `${summary.actual_days_used} / ${summary.days}`, numeric: true },
    { label: t('admin.accounts.stats.todayRequests'), value: formatNumber(summary.today?.requests || 0), numeric: true },
    { label: t('admin.accounts.stats.todayCost'), value: `$${formatCost(summary.today?.cost || 0)}`, numeric: true }
  ]
})

const trendChartData = computed(() => {
  if (!stats.value?.history?.length) return null
  return {
    labels: stats.value.history.map(item => item.label),
    datasets: [
      {
        label: `${t('usage.accountBilled')} (USD)`,
        data: stats.value.history.map(item => item.actual_cost),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        yAxisID: 'y'
      },
      {
        label: `${t('usage.userBilled')} (USD)`,
        data: stats.value.history.map(item => item.user_cost),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        fill: false,
        tension: 0.3,
        borderDash: [5, 5],
        yAxisID: 'y'
      },
      {
        label: t('admin.accounts.stats.requests'),
        data: stats.value.history.map(item => item.requests),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: false,
        tension: 0.3,
        yAxisID: 'y1'
      }
    ]
  }
})

const lineChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' as const },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        color: chartColors.value.text,
        usePointStyle: true,
        pointStyle: 'circle' as const,
        padding: 15,
        font: { size: 11 }
      }
    },
    tooltip: {
      callbacks: {
        label: (context: { dataset: { label?: string }; raw: unknown }) => {
          const label = context.dataset.label || ''
          const value = Number(context.raw)
          return label.includes('USD')
            ? `${label}: $${formatCost(value)}`
            : `${label}: ${formatNumber(value)}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { color: chartColors.value.grid },
      ticks: { color: chartColors.value.text, font: { size: 10 }, maxRotation: 45, minRotation: 0 }
    },
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      grid: { color: chartColors.value.grid },
      ticks: {
        color: '#3b82f6',
        font: { size: 10 },
        callback: (value: string | number) => `$${formatCost(Number(value))}`
      },
      title: {
        display: true,
        text: `${t('usage.accountBilled')} (USD)`,
        color: '#3b82f6',
        font: { size: 11 }
      }
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      grid: { drawOnChartArea: false },
      ticks: {
        color: '#f97316',
        font: { size: 10 },
        callback: (value: string | number) => formatNumber(Number(value))
      },
      title: {
        display: true,
        text: t('admin.accounts.stats.requests'),
        color: '#f97316',
        font: { size: 11 }
      }
    }
  }
}))

watch(
  () => [props.show, props.account?.id] as const,
  ([show, accountId]) => {
    if (show && accountId != null) void loadStats()
    else resetState()
  },
  { immediate: true }
)

async function loadStats(): Promise<void> {
  const accountId = props.account?.id
  if (!props.show || accountId == null) return
  const sequence = ++requestSequence
  loading.value = true
  loadError.value = ''
  try {
    const response = await adminAPI.accounts.getStats(accountId, 30)
    if (sequence !== requestSequence || !props.show || props.account?.id !== accountId) return
    stats.value = response
  } catch (error) {
    if (sequence !== requestSequence || !props.show || props.account?.id !== accountId) return
    stats.value = null
    loadError.value = error instanceof Error ? error.message : t('admin.accounts.stats.loadFailed')
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function resetState(): void {
  requestSequence += 1
  loading.value = false
  loadError.value = ''
  stats.value = null
}

function handleClose(): void {
  emit('close')
}

function formatCost(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
  if (value >= 1) return value.toFixed(2)
  if (value >= 0.01) return value.toFixed(3)
  return value.toFixed(4)
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toLocaleString()
}

function formatTokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toLocaleString()
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`
}
</script>

<style scoped>
.account-stats__header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--ui-border-soft)}
.account-stats__header strong{display:block;color:var(--ui-text);font-size:14px;font-weight:600;overflow-wrap:anywhere}
.account-stats__header p{margin:3px 0 0;color:var(--ui-text-muted);font-size:11px;line-height:18px}
</style>
