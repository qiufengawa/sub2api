<template>
  <AppLayout>
    <AppPage width="full" density="compact" class="dashboard-page">
      <AppPageHeader :title="t('admin.dashboard.title')" :description="t('admin.dashboard.description')">
        <template #actions>
          <UiButton
            type="button"
            density="compact"
            :loading="loading || chartsLoading"
            :disabled="loading || chartsLoading"
            @click="loadDashboardStats"
          >
            <template #icon><Icon name="refresh" size="sm" /></template>
            {{ t('common.refresh') }}
          </UiButton>
        </template>
      </AppPageHeader>

      <!-- Loading State -->
      <AppGrid v-if="loading" min="210px" :gap="8" aria-live="polite">
        <UiSkeleton v-for="index in 8" :key="index" height="96px" />
      </AppGrid>

      <UiErrorState
        v-else-if="!stats && snapshotError"
        data-testid="dashboard-error"
        :title="t('admin.dashboard.failedToLoad')"
        :retry-text="t('common.retry')"
        @retry="loadDashboardStats"
      />

      <template v-else-if="stats">
        <UiAlert v-if="snapshotError" tone="danger" :message="t('admin.dashboard.failedToLoad')">
          <template #default>
            {{ t('admin.dashboard.failedToLoad') }}
            <UiButton variant="quiet" density="dense" @click="loadDashboardStats">{{ t('common.retry') }}</UiButton>
          </template>
        </UiAlert>

        <!-- Dashboard Stats -->
        <AppGrid class="dashboard-stat-grid" min="210px" :gap="8">
          <UiStatMetric
            :label="t('admin.dashboard.apiKeys')"
            :value="formatNumber(stats.total_api_keys)"
          >
            <template #status>
              <span class="dashboard-status dashboard-status--success">{{ t('common.enabled') }}</span>
            </template>
            <template #context>
              <span class="dashboard-stat-context">
                <span class="dashboard-status-item dashboard-status-item--success">
                  <span class="dashboard-status-dot" aria-hidden="true" />
                  {{ formatNumber(stats.active_api_keys) }} {{ t('common.active') }}
                </span>
                <span class="dashboard-status-item dashboard-status-item--muted">
                  {{ formatNumber(disabledApiKeys) }} {{ t('common.disabled') }}
                </span>
              </span>
            </template>
          </UiStatMetric>
          <UiStatMetric
            :label="t('admin.dashboard.accounts')"
            :value="formatNumber(stats.total_accounts)"
          >
            <template #status>
              <span class="dashboard-status dashboard-status--success">{{ t('common.enabled') }}</span>
            </template>
            <template #context>
              <span class="dashboard-stat-context">
                <span class="dashboard-status-item dashboard-status-item--success">
                  <span class="dashboard-status-dot" aria-hidden="true" />
                  {{ formatNumber(stats.normal_accounts) }} {{ t('common.active') }}
                </span>
                <span v-if="stats.error_accounts > 0" class="dashboard-status-item dashboard-status-item--danger">
                  {{ formatNumber(stats.error_accounts) }} {{ t('common.error') }}
                </span>
              </span>
            </template>
          </UiStatMetric>
          <UiStatMetric
            :label="t('admin.dashboard.todayRequests')"
            :value="formatNumber(stats.today_requests)"
          >
            <template #status>
              <span class="dashboard-status dashboard-status--success">{{ t('admin.dashboard.realtime') }}</span>
            </template>
            <template #context>
              <span class="dashboard-stat-context">
                <span>{{ t('common.total') }}: {{ formatNumber(stats.total_requests) }}</span>
                <span
                  v-if="growthLabel(stats.today_requests_growth_percent)"
                  class="dashboard-growth"
                  :class="growthTone(stats.today_requests_growth_percent)"
                  data-testid="today-requests-growth"
                >{{ growthLabel(stats.today_requests_growth_percent) }}</span>
              </span>
            </template>
          </UiStatMetric>
          <UiStatMetric
            :label="t('admin.dashboard.users')"
            :value="`+${formatNumber(stats.today_new_users)}`"
            :context="`${t('common.total')}: ${formatNumber(stats.total_users)}`"
          />
          <UiStatMetric
            :label="t('admin.dashboard.todayTokens')"
            :value="formatTokens(stats.today_tokens)"
          >
            <template #status>
              <span class="dashboard-status dashboard-status--success">{{ t('admin.dashboard.realtime') }}</span>
            </template>
            <template #context>
              <span class="dashboard-stat-context">
                <span>{{ t('common.total') }}: {{ formatTokens(stats.total_tokens) }}</span>
                <span
                  v-if="growthLabel(stats.today_tokens_growth_percent)"
                  class="dashboard-growth"
                  :class="growthTone(stats.today_tokens_growth_percent)"
                  data-testid="today-tokens-growth"
                >{{ growthLabel(stats.today_tokens_growth_percent) }}</span>
              </span>
            </template>
          </UiStatMetric>
          <UiStatMetric
            :label="t('admin.dashboard.totalTokens')"
            :value="formatTokens(stats.total_tokens)"
            :context="totalCostContext"
          />
          <UiStatMetric
            :label="t('admin.dashboard.performance')"
            :value="formatRate(stats.rpm)"
            unit="RPM"
            :context="`TPM ${formatRate(stats.tpm)}`"
          />
          <UiStatMetric
            :label="t('admin.dashboard.avgResponse')"
            :value="formatDuration(stats.average_duration_ms)"
            :context="`${formatNumber(stats.active_users)} ${t('admin.dashboard.activeUsers')}`"
          />
        </AppGrid>
        <!-- Quick Actions -->
        <AppSection :title="t('admin.dashboard.quickActions')" divided>
          <AppGrid min="240px" :gap="8">
            <UiButton
              v-if="canUseBatchImage"
              class="dashboard-action"
              to="/batch-image"
            >
              <template #icon><Icon name="sparkles" size="sm" /></template>
              {{ t('admin.dashboard.batchImage') }}
            </UiButton>
            <UiButton
              class="dashboard-action"
              to="/admin/groups"
            >
              <template #icon><Icon name="grid" size="sm" /></template>
              {{ t('admin.dashboard.groupPricing') }}
            </UiButton>
          </AppGrid>
        </AppSection>

        <!-- Charts Section -->
        <AppStack :gap="16">
          <!-- Date Range Filter -->
          <AppToolbar class="dashboard-chart-toolbar">
            <AppInline class="dashboard-chart-toolbar__controls" justify="space-between">
              <AppInline class="dashboard-chart-range-controls">
                <UiFormField :label="t('admin.dashboard.timeRange')">
                <UiDateRangePicker
                  v-model:start-date="startDate"
                  v-model:end-date="endDate"
                  density="compact"
                  :aria-label="t('admin.dashboard.timeRange')"
                  @change="onDateRangeChange"
                />
                </UiFormField>
              <UiButton density="compact" :loading="chartsLoading" :disabled="chartsLoading" @click="loadDashboardStats">
                <template #icon><Icon name="refresh" size="sm" /></template>
                {{ t('common.refresh') }}
              </UiButton>
              </AppInline>
              <UiFormField class="dashboard-granularity-field" :label="t('admin.dashboard.granularity')">
                  <UiSelect
                    density="compact"
                    v-model="granularity"
                    :options="granularityOptions"
                    @change="loadChartData"
                  />
              </UiFormField>
            </AppInline>
          </AppToolbar>

          <!-- Charts Grid -->
          <AppGrid min="420px" :gap="16">
            <ModelDistributionChart
              :model-stats="modelStats"
              :enable-ranking-view="true"
              :ranking-items="rankingItems"
              :ranking-total-actual-cost="rankingTotalActualCost"
              :ranking-total-requests="rankingTotalRequests"
              :ranking-total-tokens="rankingTotalTokens"
              :loading="chartsLoading"
              :ranking-loading="rankingLoading"
              :ranking-error="rankingError"
              :start-date="startDate"
              :end-date="endDate"
              @ranking-click="goToUserUsage"
            />
            <TokenUsageTrend :trend-data="trendData" :loading="chartsLoading" />
          </AppGrid>

          <!-- User Usage Trend (Full Width) -->
          <UiChartFrame
            :title="`${t('admin.dashboard.recentUsage')} (Top 12)`"
            :loading="userTrendLoading"
            :empty="!userTrendChartData"
            :height="288"
          >
            <div class="dashboard-user-trend">
              <Line v-if="userTrendChartData" :data="userTrendChartData" :options="lineOptions" />
            </div>
          </UiChartFrame>
        </AppStack>
      </template>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const { t } = useI18n()
import { adminAPI } from '@/api/admin'
import type {
  DashboardStats,
  TrendDataPoint,
  ModelStat,
  UserUsageTrendPoint,
  UserSpendingRankingItem
} from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import ModelDistributionChart from '@/components/charts/ModelDistributionChart.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
import {
  AppGrid,
  AppInline,
  AppPage,
  AppPageHeader,
  AppSection,
  AppStack,
  AppToolbar,
  UiButton,
  UiAlert,
  UiChartFrame,
  UiDateRangePicker,
  UiErrorState,
  UiFormField,
  UiSelect,
  UiSkeleton,
  UiStatMetric,
} from '@/components/ui'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
)

const appStore = useAppStore()
const router = useRouter()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()
const stats = ref<DashboardStats | null>(null)
const loading = ref(false)
const chartsLoading = ref(false)
const userTrendLoading = ref(false)
const rankingLoading = ref(false)
const rankingError = ref(false)
const snapshotError = ref(false)

// Chart data
const trendData = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const userTrend = ref<UserUsageTrendPoint[]>([])
const rankingItems = ref<UserSpendingRankingItem[]>([])
const rankingTotalActualCost = ref(0)
const rankingTotalRequests = ref(0)
const rankingTotalTokens = ref(0)
let chartLoadSeq = 0
let usersTrendLoadSeq = 0
let rankingLoadSeq = 0
const rankingLimit = 12

// Helper function to format date in local timezone
const formatLocalDate = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const getLast24HoursRangeDates = (): { start: string; end: string } => {
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end)
  }
}

// Date range
const granularity = ref<'day' | 'hour'>('hour')
const defaultRange = getLast24HoursRangeDates()
const startDate = ref(defaultRange.start)
const endDate = ref(defaultRange.end)

// Granularity options for Select component
const granularityOptions = computed(() => [
  { value: 'day', label: t('admin.dashboard.day') },
  { value: 'hour', label: t('admin.dashboard.hour') }
])

// Dark mode detection
const isDarkMode = computed(() => {
  return document.documentElement.classList.contains('dark')
})

// Chart colors
const chartColors = computed(() => ({
  text: isDarkMode.value ? '#e5e7eb' : '#374151',
  grid: isDarkMode.value ? '#374151' : '#e5e7eb'
}))

// Line chart options (for user trend chart)
const lineOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
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
        padding: 15,
        font: {
          size: 11
        }
      }
    },
    tooltip: {
      itemSort: (a: any, b: any) => {
        const aValue = typeof a?.raw === 'number' ? a.raw : Number(a?.parsed?.y ?? 0)
        const bValue = typeof b?.raw === 'number' ? b.raw : Number(b?.parsed?.y ?? 0)
        return bValue - aValue
      },
      callbacks: {
        label: (context: any) => {
          return `${context.dataset.label}: ${formatTokens(context.raw)}`
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
    }
  }
}))

// User trend chart data
const userTrendChartData = computed(() => {
  if (!userTrend.value?.length) return null

  const getDisplayName = (point: UserUsageTrendPoint): string => {
    const username = point.username?.trim()
    if (username) {
      return username
    }

    const email = point.email?.trim()
    if (email) {
      return email
    }

    return t('admin.redeem.userPrefix', { id: point.user_id })
  }

  // Group by user_id to avoid merging different users with the same display name
  const userGroups = new Map<number, { name: string; data: Map<string, number> }>()
  const allDates = new Set<string>()

  userTrend.value.forEach((point) => {
    allDates.add(point.date)
    const key = point.user_id
    if (!userGroups.has(key)) {
      userGroups.set(key, { name: getDisplayName(point), data: new Map() })
    }
    userGroups.get(key)!.data.set(point.date, point.tokens)
  })

  const sortedDates = Array.from(allDates).sort()
  const colors = [
    '#3b82f6',
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

  const datasets = Array.from(userGroups.values()).map((group, idx) => ({
    label: group.name,
    data: sortedDates.map((date) => group.data.get(date) || 0),
    borderColor: colors[idx % colors.length],
    backgroundColor: `${colors[idx % colors.length]}20`,
    fill: false,
    tension: 0.3
  }))

  return {
    labels: sortedDates,
    datasets
  }
})

// Format helpers
const formatTokens = (value: number | undefined): string => {
  if (value === undefined || value === null) return '0'
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }
  return value.toLocaleString()
}

const formatRate = (value: number | undefined): string => formatTokens(value)

const toFiniteNumber = (value: unknown): number => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

const formatNumber = (value: number | null | undefined): string => {
  return toFiniteNumber(value).toLocaleString()
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

const disabledApiKeys = computed(() => {
  if (!stats.value) return 0
  return Math.max(0, toFiniteNumber(stats.value.total_api_keys) - toFiniteNumber(stats.value.active_api_keys))
})

const growthLabel = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  const sign = value > 0 ? '↑' : value < 0 ? '↓' : '→'
  return `${sign} ${Math.abs(value).toFixed(1)}%`
}

const growthTone = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  if (value < 0) return 'dashboard-growth--down'
  if (value === 0) return 'dashboard-growth--flat'
  return 'dashboard-growth--up'
}

const totalCostContext = computed(() => {
  if (!stats.value) return ''
  return `${t('admin.dashboard.actual')}: $${formatCost(stats.value.total_actual_cost)} · ${t('admin.dashboard.accountCost')}: $${formatCost(stats.value.total_account_cost)} · ${t('admin.dashboard.standard')}: $${formatCost(stats.value.total_cost)}`
})

const formatDuration = (ms: number): string => {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`
  }
  return `${Math.round(ms)}ms`
}

const goToUserUsage = (item: UserSpendingRankingItem) => {
  void router.push({
    path: '/admin/usage',
    query: {
      user_id: String(item.user_id),
      start_date: startDate.value,
      end_date: endDate.value
    }
  })
}

// Date range change handler
const onDateRangeChange = (range: {
  startDate: string
  endDate: string
  preset: string | null
}) => {
  // Auto-select granularity based on date range
  const start = new Date(range.startDate)
  const end = new Date(range.endDate)
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  // If range is 1 day, use hourly granularity
  if (daysDiff <= 1) {
    granularity.value = 'hour'
  } else {
    granularity.value = 'day'
  }

  loadChartData()
}

// Load data
const loadDashboardSnapshot = async (includeStats: boolean) => {
  const currentSeq = ++chartLoadSeq
  snapshotError.value = false
  if (includeStats && !stats.value) {
    loading.value = true
  }
  chartsLoading.value = true
  try {
    const response = await adminAPI.dashboard.getSnapshotV2({
      start_date: startDate.value,
      end_date: endDate.value,
      granularity: granularity.value,
      include_stats: includeStats,
      include_trend: true,
      include_model_stats: true,
      include_group_stats: false,
      include_users_trend: false
    })
    if (currentSeq !== chartLoadSeq) return
    if (includeStats && response.stats) {
      stats.value = response.stats
    }
    if (includeStats && !stats.value) {
      throw new Error('Dashboard snapshot did not include statistics')
    }
    trendData.value = response.trend || []
    modelStats.value = response.models || []
  } catch (error) {
    if (currentSeq !== chartLoadSeq) return
    snapshotError.value = true
    appStore.showError(t('admin.dashboard.failedToLoad'))
    console.error('Error loading dashboard snapshot:', error)
  } finally {
    if (currentSeq === chartLoadSeq) {
      loading.value = false
      chartsLoading.value = false
    }
  }
}

const loadUsersTrend = async () => {
  const currentSeq = ++usersTrendLoadSeq
  userTrendLoading.value = true
  try {
    const response = await adminAPI.dashboard.getUserUsageTrend({
      start_date: startDate.value,
      end_date: endDate.value,
      granularity: granularity.value,
      limit: 12
    })
    if (currentSeq !== usersTrendLoadSeq) return
    userTrend.value = response.trend || []
  } catch (error) {
    if (currentSeq !== usersTrendLoadSeq) return
    console.error('Error loading users trend:', error)
    userTrend.value = []
  } finally {
    if (currentSeq === usersTrendLoadSeq) {
      userTrendLoading.value = false
    }
  }
}

const loadUserSpendingRanking = async () => {
  const currentSeq = ++rankingLoadSeq
  rankingLoading.value = true
  rankingError.value = false
  try {
    const response = await adminAPI.dashboard.getUserSpendingRanking({
      start_date: startDate.value,
      end_date: endDate.value,
      limit: rankingLimit
    })
    if (currentSeq !== rankingLoadSeq) return
    rankingItems.value = response.ranking || []
    rankingTotalActualCost.value = response.total_actual_cost || 0
    rankingTotalRequests.value = response.total_requests || 0
    rankingTotalTokens.value = response.total_tokens || 0
  } catch (error) {
    if (currentSeq !== rankingLoadSeq) return
    console.error('Error loading user spending ranking:', error)
    rankingItems.value = []
    rankingTotalActualCost.value = 0
    rankingTotalRequests.value = 0
    rankingTotalTokens.value = 0
    rankingError.value = true
  } finally {
    if (currentSeq === rankingLoadSeq) {
      rankingLoading.value = false
    }
  }
}

const loadDashboardStats = async () => {
  await Promise.all([
    loadDashboardSnapshot(true),
    loadUsersTrend(),
    loadUserSpendingRanking()
  ])
}

const loadChartData = async () => {
  await Promise.all([
    loadDashboardSnapshot(false),
    loadUsersTrend(),
    loadUserSpendingRanking()
  ])
}

onMounted(() => {
  void refreshBatchImageAccess()
  loadDashboardStats()
})
</script>

<style scoped>
.dashboard-page{display:grid;gap:16px}.dashboard-action{justify-content:flex-start;width:100%}.dashboard-user-trend{height:288px}.dashboard-chart-range-controls{align-items:flex-end;min-width:0}.dashboard-chart-range-controls :deep(.ui-form-field){min-width:0}.dashboard-chart-range-controls :deep(.ui-date-range__trigger){min-width:0;width:100%}.dashboard-chart-toolbar__controls{min-width:0}.dashboard-granularity-field{min-width:87px}
.dashboard-status{display:inline-flex;align-items:center;min-height:18px;padding:0 5px;border-radius:4px;font-size:10px;font-weight:500;line-height:16px;white-space:nowrap}.dashboard-status--success{color:var(--ui-success);background:color-mix(in srgb,var(--ui-success) 12%,transparent)}
:deep(.dashboard-stat-context){display:flex;min-width:0;align-items:center;flex-wrap:wrap;gap:4px 8px}.dashboard-status-item{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}.dashboard-status-item--success{color:var(--ui-success)}.dashboard-status-item--danger{color:var(--ui-danger)}.dashboard-status-item--muted{color:var(--ui-text-soft)}.dashboard-status-dot{width:6px;height:6px;flex:none;border-radius:50%;background:currentColor}.dashboard-growth{display:inline-flex;align-items:center;min-height:18px;padding:0 5px;border-radius:4px;font-size:10px;font-weight:600;line-height:16px;white-space:nowrap}.dashboard-growth--up{color:var(--ui-success);background:color-mix(in srgb,var(--ui-success) 12%,transparent)}.dashboard-growth--down{color:var(--ui-danger);background:color-mix(in srgb,var(--ui-danger) 12%,transparent)}.dashboard-growth--flat{color:var(--ui-text-soft);background:var(--ui-surface-muted)}
.dashboard-chart-toolbar:has(.dashboard-granularity-field .ui-select__trigger--open){margin-bottom:68px}
.dashboard-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
@media(min-width:1280px){.dashboard-stat-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:640px){.dashboard-stat-grid{grid-template-columns:1fr}}
@media(max-width:640px){
  .dashboard-chart-toolbar{min-height:140px;flex:none}
  .dashboard-chart-toolbar :deep(.dashboard-chart-toolbar__controls){display:grid;grid-template-columns:minmax(0,1fr);align-items:stretch;gap:8px;width:100%}
  .dashboard-chart-toolbar :deep(.dashboard-chart-range-controls){display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px;width:100%}
  .dashboard-chart-toolbar :deep(.dashboard-granularity-field){width:100%;min-width:0}
  .dashboard-chart-toolbar :deep(.dashboard-granularity-field .ui-select),
  .dashboard-chart-toolbar :deep(.dashboard-granularity-field .ui-select__trigger){width:100%;min-width:0}
}
</style>
