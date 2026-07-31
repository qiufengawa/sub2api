<template>
  <AppLayout>
    <div class="space-y-4">
      <div v-if="loading" class="flex min-h-[420px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>

      <template v-else-if="stats">
        <section class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-semibold tracking-tight text-gray-950 dark:text-white lg:hidden">{{ t('dashboard.overview.title') }}</h1>
              <span class="inline-flex min-h-5 items-center rounded-[3px] border px-1.5 text-[11px] font-medium" :class="headerStatusClass">
                {{ headerStatusLabel }}
              </span>
            </div>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">{{ headerDescription }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2">
            <router-link to="/keys" class="btn btn-primary btn-sm">
              <Icon name="plus" size="xs" :stroke-width="2" />
              {{ t('dashboard.createApiKey') }}
            </router-link>
            <router-link v-if="!authStore.isSimpleMode" :to="fundingPath" class="btn btn-secondary btn-sm">
              <Icon name="gift" size="xs" />
              {{ fundingLabel }}
            </router-link>
          </div>
        </section>

        <section v-if="alerts.length" class="space-y-2" aria-live="polite">
          <div
            v-for="alert in alerts"
            :key="alert.id"
            class="flex flex-col gap-2 rounded-[3px] border px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
            :class="alert.tone === 'danger' ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200'"
          >
            <div class="flex items-start gap-2">
              <Icon :name="alert.tone === 'danger' ? 'exclamationCircle' : 'exclamationTriangle'" size="sm" class="mt-0.5 shrink-0" />
              <span>{{ alert.message }}</span>
            </div>
            <router-link :to="alert.to" class="shrink-0 text-xs font-semibold underline-offset-2 hover:underline">{{ alert.action }}</router-link>
          </div>
        </section>

        <UserDashboardStats
          :stats="stats"
          :balance="user?.balance || 0"
          :frozen-balance="user?.frozen_balance || 0"
          :is-simple="authStore.isSimpleMode"
          :account-disabled="user?.status === 'disabled'"
          :subscription-summary="subscriptionSummary"
          :recent-usage="recentUsage"
          :recent-errors="recentErrors"
          :error-view-enabled="errorViewEnabled"
          :yesterday-cost="yesterdayCost"
          :quota-percent="highestQuotaPercent"
          :nearest-expiry-days="nearestExpiryDays"
          :funding-path="fundingPath"
          :funding-label="fundingLabel"
        />

        <UserDashboardGettingStarted
          v-if="dashboardStage !== 'active'"
          :has-api-key="dashboardStage === 'ready'"
          :api-base-url="appStore.apiBaseUrl"
          :doc-url="appStore.docUrl"
        />

        <div v-if="dashboardStage === 'ready'" class="grid grid-cols-1 items-stretch gap-4">
          <UserDashboardCharts
            v-model:range-days="rangeDays"
            :loading="false"
            :trend="[]"
            :previous-trend="[]"
            has-api-key
          />
          <UserDashboardModelBreakdown :models="[]" :loading="false" />
        </div>

        <template v-else-if="dashboardStage === 'active'">
          <div
            data-testid="dashboard-content-grid"
            class="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2"
          >
            <UserDashboardCharts
              class="xl:col-span-2"
              v-model:range-days="rangeDays"
              :loading="loadingCharts"
              :trend="trendData"
              :previous-trend="previousTrendData"
            />
            <UserDashboardQuickActions
              :subscription-summary="subscriptionSummary"
              :platform-quotas="platformQuotas"
              :balance="user?.balance || 0"
              :frozen-balance="user?.frozen_balance || 0"
              :is-simple="authStore.isSimpleMode"
            />
            <UserDashboardModelBreakdown :models="modelStats" :loading="loadingCharts" />
            <UserDashboardRecentUsage
              class="xl:col-span-2"
              :data="recentUsage"
              :errors="errorViewEnabled ? recentErrors : []"
              :show-errors="errorViewEnabled"
              :loading="loadingUsage"
            />
          </div>
        </template>
      </template>

      <section v-else class="card flex min-h-[360px] flex-col items-center justify-center p-6 text-center">
        <Icon name="exclamationCircle" size="lg" class="text-red-500" />
        <h2 class="mt-3 text-base font-semibold text-gray-900 dark:text-white">{{ t('dashboard.overview.loadFailedTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.loadFailedDescription') }}</p>
        <button type="button" class="btn btn-secondary btn-sm mt-4" @click="refreshAll">{{ t('dashboard.overview.retry') }}</button>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { usageAPI, type UserDashboardStats as UserStatsType } from '@/api/usage'
import subscriptionsAPI, { type SubscriptionSummary } from '@/api/subscriptions'
import { getMyPlatformQuotas } from '@/api/user'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import UserDashboardStats from '@/components/user/dashboard/UserDashboardStats.vue'
import UserDashboardCharts from '@/components/user/dashboard/UserDashboardCharts.vue'
import UserDashboardRecentUsage from '@/components/user/dashboard/UserDashboardRecentUsage.vue'
import UserDashboardQuickActions from '@/components/user/dashboard/UserDashboardQuickActions.vue'
import UserDashboardModelBreakdown from '@/components/user/dashboard/UserDashboardModelBreakdown.vue'
import UserDashboardGettingStarted from '@/components/user/dashboard/UserDashboardGettingStarted.vue'
import type { UsageLog, TrendDataPoint, ModelStat, PlatformQuotaItem, UserErrorRequest } from '@/types'
import { formatDateLocalInput, formatRelativeTime } from '@/utils/format'

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()
const user = computed(() => authStore.user)
const stats = ref<UserStatsType | null>(null)
const loading = ref(false)
const loadingUsage = ref(false)
const loadingCharts = ref(false)
const trendData = ref<TrendDataPoint[]>([])
const previousTrendData = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const recentUsage = ref<UsageLog[]>([])
const recentErrors = ref<UserErrorRequest[]>([])
const platformQuotas = ref<PlatformQuotaItem[]>([])
const subscriptionSummary = ref<SubscriptionSummary | null>(null)
const rangeDays = ref<7 | 30>(7)
const yesterdayCost = ref(0)
const optionalDataLoaded = ref(false)

const errorViewEnabled = computed(() => appStore.cachedPublicSettings?.allow_user_view_error_requests ?? false)
const dashboardStage = computed<'new' | 'ready' | 'active'>(() => {
  if (!stats.value || stats.value.total_api_keys <= 0) return 'new'
  if (stats.value.total_requests <= 0) return 'ready'
  return 'active'
})
const latestSuccess = computed(() => recentUsage.value[0]?.created_at ?? null)
const highestQuotaPercent = computed(() => {
  const values: number[] = []
  for (const item of subscriptionSummary.value?.subscriptions ?? []) {
    for (const [used, limit] of [[item.daily_used_usd, item.daily_limit_usd], [item.weekly_used_usd, item.weekly_limit_usd], [item.monthly_used_usd, item.monthly_limit_usd]]) {
      if (typeof limit === 'number' && limit > 0) values.push(((used ?? 0) / limit) * 100)
    }
  }
  for (const item of platformQuotas.value) {
    for (const [used, limit] of [[item.daily_usage_usd, item.daily_limit_usd], [item.weekly_usage_usd, item.weekly_limit_usd], [item.monthly_usage_usd, item.monthly_limit_usd]]) {
      if (typeof limit === 'number' && limit > 0) values.push((Number(used ?? 0) / limit) * 100)
    }
  }
  return values.length ? Math.max(...values) : 0
})
const recent24hErrors = computed(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  return recentErrors.value.filter((item) => new Date(item.created_at).getTime() >= cutoff).length
})
const nearestExpiryDays = computed<number | null>(() => {
  const now = Date.now()
  const values = (subscriptionSummary.value?.subscriptions ?? [])
    .map((item) => item.expires_at ? Math.ceil((new Date(item.expires_at).getTime() - now) / 86_400_000) : null)
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0)
  return values.length ? Math.min(...values) : null
})
const fundingPath = computed(() => appStore.cachedPublicSettings?.payment_enabled ? '/purchase' : '/redeem')
const fundingLabel = computed(() => t(appStore.cachedPublicSettings?.payment_enabled ? 'dashboard.overview.topUpOrSubscribe' : 'dashboard.overview.redeemBalance'))
const balanceUnavailable = computed(() => optionalDataLoaded.value
  && !authStore.isSimpleMode
  && (user.value?.balance ?? 0) <= 0
  && !(subscriptionSummary.value?.active_count ?? 0))

const headerStatus = computed<'healthy' | 'warning' | 'danger'>(() => {
  if (user.value?.status === 'disabled' || (stats.value?.total_api_keys && !stats.value.active_api_keys)) return 'danger'
  if (!stats.value?.total_api_keys) return 'warning'
  if (balanceUnavailable.value || (optionalDataLoaded.value && (highestQuotaPercent.value >= 80 || recent24hErrors.value >= 3 || (nearestExpiryDays.value !== null && nearestExpiryDays.value <= 7)))) return 'warning'
  return 'healthy'
})
const headerStatusLabel = computed(() => t(`dashboard.overview.status.${headerStatus.value}`))
const headerStatusClass = computed(() => ({
  healthy: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/25 dark:text-red-300',
}[headerStatus.value]))
const headerDescription = computed(() => {
  if (user.value?.status === 'disabled') return t('dashboard.overview.headerAccountDisabled')
  if (dashboardStage.value === 'new') return t('dashboard.overview.headerNoKey')
  if (balanceUnavailable.value) return t('dashboard.overview.headerLowBalance')
  if (highestQuotaPercent.value >= 80) return t('dashboard.overview.headerQuotaNearLimit')
  if (dashboardStage.value === 'ready') return t('dashboard.overview.headerReady')
  if (latestSuccess.value) return t('dashboard.overview.headerHealthy', { time: formatRelativeTime(latestSuccess.value) })
  return t('dashboard.overview.headerDefault')
})

interface DashboardAlert { id: string; tone: 'warning' | 'danger'; message: string; action: string; to: string }
const alerts = computed<DashboardAlert[]>(() => {
  const result: DashboardAlert[] = []
  if (user.value?.status === 'disabled') {
    result.push({ id: 'disabled', tone: 'danger', message: t('dashboard.overview.alertAccountDisabled'), action: t('dashboard.overview.viewProfile'), to: '/profile' })
  } else if (stats.value && stats.value.total_api_keys > 0 && stats.value.active_api_keys <= 0) {
    result.push({ id: 'keys', tone: 'danger', message: t('dashboard.overview.alertNoActiveKey'), action: t('dashboard.overview.manageKeys'), to: '/keys' })
  }
  if (optionalDataLoaded.value && !authStore.isSimpleMode && (user.value?.balance ?? 0) <= 0 && !(subscriptionSummary.value?.active_count ?? 0)) {
    result.push({ id: 'balance', tone: 'warning', message: t('dashboard.overview.alertLowBalance'), action: fundingLabel.value, to: fundingPath.value })
  }
  if (highestQuotaPercent.value >= 80) {
    result.push({ id: 'quota', tone: highestQuotaPercent.value >= 95 ? 'danger' : 'warning', message: t('dashboard.overview.alertQuota', { percent: Math.round(highestQuotaPercent.value) }), action: t(authStore.isSimpleMode ? 'dashboard.overview.viewUsage' : 'dashboard.overview.viewSubscriptions'), to: authStore.isSimpleMode ? '/usage' : '/subscriptions' })
  }
  if (nearestExpiryDays.value !== null && nearestExpiryDays.value <= 7) {
    result.push({ id: 'expiry', tone: nearestExpiryDays.value <= 1 ? 'danger' : 'warning', message: t('dashboard.overview.alertExpiry', { days: nearestExpiryDays.value }), action: t(authStore.isSimpleMode ? 'dashboard.overview.viewUsage' : 'dashboard.overview.viewSubscriptions'), to: authStore.isSimpleMode ? '/usage' : '/subscriptions' })
  }
  if (errorViewEnabled.value && recent24hErrors.value >= 3) {
    result.push({ id: 'errors', tone: 'warning', message: t('dashboard.overview.alertFailures', { count: recent24hErrors.value }), action: t('dashboard.overview.viewUsage'), to: '/usage' })
  }
  return result.slice(0, 2)
})

function dateRange(days: number, offsetDays = 0) {
  const end = new Date()
  end.setDate(end.getDate() - offsetDays)
  const start = new Date(end)
  start.setDate(start.getDate() - days + 1)
  return { start: formatDateLocalInput(start), end: formatDateLocalInput(end) }
}

async function loadCore() {
  try {
    await Promise.all([authStore.refreshUser(), appStore.fetchPublicSettings()])
    stats.value = await usageAPI.getDashboardStats()
  } catch (error) {
    console.error('[UserDashboard] failed to load core data:', error)
    stats.value = null
  }
}

async function loadCharts() {
  const { start, end } = dateRange(rangeDays.value)
  const previous = dateRange(rangeDays.value, rangeDays.value)
  loadingCharts.value = true
  try {
    const [trend, models, previousTrend] = await Promise.all([
      usageAPI.getDashboardTrend({ start_date: start, end_date: end, granularity: 'day' }),
      usageAPI.getDashboardModels({ start_date: start, end_date: end }),
      usageAPI.getDashboardTrend({ start_date: previous.start, end_date: previous.end, granularity: 'day' }),
    ])
    trendData.value = trend.trend ?? []
    modelStats.value = models.models ?? []
    previousTrendData.value = previousTrend.trend ?? []
  } catch (error) {
    console.error('[UserDashboard] failed to load charts:', error)
    trendData.value = []
    modelStats.value = []
    previousTrendData.value = []
  } finally {
    loadingCharts.value = false
  }
}

async function loadRecent() {
  loadingUsage.value = true
  try {
    const response = await usageAPI.query({ page: 1, page_size: 8, sort_by: 'created_at', sort_order: 'desc' })
    recentUsage.value = response.items
  } catch (error) {
    console.error('[UserDashboard] failed to load recent usage:', error)
    recentUsage.value = []
  } finally {
    loadingUsage.value = false
  }
}

async function loadOptionalData() {
  optionalDataLoaded.value = false
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDate = formatDateLocalInput(yesterday)
  const tasks: Promise<void>[] = [
    getMyPlatformQuotas().then((data) => { platformQuotas.value = data.platform_quotas ?? [] }).catch(() => { platformQuotas.value = [] }),
    subscriptionsAPI.getSubscriptionSummary().then((data) => { subscriptionSummary.value = data }).catch(() => { subscriptionSummary.value = null }),
    usageAPI.getDashboardTrend({ start_date: yesterdayDate, end_date: yesterdayDate, granularity: 'day' }).then((data) => { yesterdayCost.value = data.trend?.[0]?.actual_cost ?? 0 }).catch(() => { yesterdayCost.value = 0 }),
  ]
  if (errorViewEnabled.value) {
    const range = dateRange(2)
    tasks.push(usageAPI.listMyErrorRequests({ page: 1, page_size: 8, start_date: range.start, end_date: range.end, sort_by: 'created_at', sort_order: 'desc' })
      .then((data) => { recentErrors.value = data.items })
      .catch(() => { recentErrors.value = [] }))
  } else {
    recentErrors.value = []
  }
  await Promise.all(tasks)
  optionalDataLoaded.value = true
}

async function refreshAll() {
  loading.value = true
  try {
    await loadCore()
    if (!stats.value) return
    if (dashboardStage.value === 'active') {
      await Promise.all([loadCharts(), loadRecent(), loadOptionalData()])
    } else {
      trendData.value = []
      previousTrendData.value = []
      modelStats.value = []
      recentUsage.value = []
      await loadOptionalData()
    }
  } finally {
    loading.value = false
  }
}

watch(rangeDays, () => {
  if (dashboardStage.value === 'active') void loadCharts()
})
onMounted(() => { void refreshAll() })
</script>
