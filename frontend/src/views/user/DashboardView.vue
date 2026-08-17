<template>
  <AppLayout>
    <AppPage density="compact">
      <div v-if="loading && !stats" class="dashboard-skeleton" data-testid="dashboard-skeleton">
        <UiSkeleton height="76px" />
        <div class="dashboard-skeleton__metrics">
          <UiSkeleton v-for="index in 4" :key="index" height="112px" />
        </div>
        <UiSkeleton height="280px" />
      </div>

      <UiLoadingOverlay v-else-if="stats" :show="refreshing" :label="t('common.loading')">
        <div class="dashboard-content">
        <AppPageHeader :title="t('dashboard.overview.title')" :description="headerDescription">
          <template #status>
            <UiBadge :tone="headerStatusTone" :label="headerStatusLabel" />
          </template>
          <template #actions>
            <UiButton to="/keys" variant="primary" density="compact">
              <template #icon><Icon name="plus" size="sm" /></template>
              {{ t('dashboard.createApiKey') }}
            </UiButton>
            <UiButton v-if="!authStore.isSimpleMode" :to="fundingPath" variant="secondary" density="compact">
              <template #icon><Icon name="gift" size="sm" /></template>
              {{ fundingLabel }}
            </UiButton>
          </template>
        </AppPageHeader>

        <div
          v-if="coreError || chartsError || recentError || optionalError"
          class="dashboard-retry-banner"
          data-testid="dashboard-load-warning"
        >
          <UiBanner tone="danger" :message="t('dashboard.overview.loadFailedDescription')" />
          <UiButton density="dense" @click="refreshAll">{{ t('dashboard.overview.retry') }}</UiButton>
        </div>

        <section v-if="alerts.length" class="dashboard-alerts" aria-live="polite">
          <div v-for="alert in alerts" :key="alert.id" class="dashboard-alert" :class="'dashboard-alert--' + alert.tone">
            <Icon :name="alert.tone === 'danger' ? 'exclamationCircle' : 'exclamationTriangle'" size="sm" aria-hidden="true" />
            <span>{{ alert.message }}</span>
            <UiButton :to="alert.to" variant="quiet" density="mini">{{ alert.action }}</UiButton>
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

        <div v-if="dashboardStage === 'ready'" class="dashboard-grid dashboard-grid--ready">
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
          <div data-testid="dashboard-content-grid" class="dashboard-grid">
            <UserDashboardCharts
              class="dashboard-grid__wide"
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
              class="dashboard-grid__wide"
              :data="recentUsage"
              :errors="errorViewEnabled ? recentErrors : []"
              :show-errors="errorViewEnabled"
              :loading="loadingUsage"
            />
          </div>
        </template>
        </div>
      </UiLoadingOverlay>

      <UiErrorState
        v-else
        data-testid="dashboard-load-error"
        :title="t('dashboard.overview.loadFailedTitle')"
        :description="t('dashboard.overview.loadFailedDescription')"
        :retry-text="t('dashboard.overview.retry')"
        @retry="refreshAll"
      />
    </AppPage>
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
import Icon from '@/components/icons/Icon.vue'
import {
  AppPage,
  AppPageHeader,
  UiBadge,
  UiBanner,
  UiButton,
  UiErrorState,
  UiLoadingOverlay,
  UiSkeleton,
} from '@/components/ui'
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
const refreshing = ref(false)
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
const coreError = ref(false)
const chartsError = ref(false)
const recentError = ref(false)
const optionalError = ref(false)
let chartRequestSequence = 0

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
    const limit = item.cycle_limit_usd
    if (typeof limit === 'number' && limit > 0) {
      values.push(((item.cycle_used_usd ?? 0) / limit) * 100)
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
const headerStatusTone = computed<'success' | 'warning' | 'danger'>(() => headerStatus.value === 'healthy' ? 'success' : headerStatus.value)
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

async function loadCore(): Promise<boolean> {
  coreError.value = false
  try {
    await Promise.all([authStore.refreshUser(), appStore.fetchPublicSettings()])
    stats.value = await usageAPI.getDashboardStats()
    return true
  } catch (error) {
    console.error('[UserDashboard] failed to load core data:', error)
    coreError.value = true
    return false
  }
}

async function loadCharts() {
  const sequence = ++chartRequestSequence
  const { start, end } = dateRange(rangeDays.value)
  const previous = dateRange(rangeDays.value, rangeDays.value)
  loadingCharts.value = true
  chartsError.value = false
  try {
    const [trend, models, previousTrend] = await Promise.all([
      usageAPI.getDashboardTrend({ start_date: start, end_date: end, granularity: 'day' }),
      usageAPI.getDashboardModels({ start_date: start, end_date: end }),
      usageAPI.getDashboardTrend({ start_date: previous.start, end_date: previous.end, granularity: 'day' }),
    ])
    if (sequence !== chartRequestSequence) return
    trendData.value = trend.trend ?? []
    modelStats.value = models.models ?? []
    previousTrendData.value = previousTrend.trend ?? []
  } catch (error) {
    if (sequence !== chartRequestSequence) return
    console.error('[UserDashboard] failed to load charts:', error)
    chartsError.value = true
  } finally {
    if (sequence === chartRequestSequence) loadingCharts.value = false
  }
}

async function loadRecent() {
  loadingUsage.value = true
  recentError.value = false
  try {
    const response = await usageAPI.query({ page: 1, page_size: 8, sort_by: 'created_at', sort_order: 'desc' })
    recentUsage.value = response.items
  } catch (error) {
    console.error('[UserDashboard] failed to load recent usage:', error)
    recentError.value = true
  } finally {
    loadingUsage.value = false
  }
}

async function loadOptionalData() {
  optionalDataLoaded.value = false
  optionalError.value = false
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDate = formatDateLocalInput(yesterday)
  const tasks: Promise<void>[] = [
    getMyPlatformQuotas().then((data) => { platformQuotas.value = data.platform_quotas ?? [] }),
    subscriptionsAPI.getSubscriptionSummary().then((data) => { subscriptionSummary.value = data }),
    usageAPI.getDashboardTrend({ start_date: yesterdayDate, end_date: yesterdayDate, granularity: 'day' }).then((data) => { yesterdayCost.value = data.trend?.[0]?.actual_cost ?? 0 }),
  ]
  if (errorViewEnabled.value) {
    const range = dateRange(2)
    tasks.push(usageAPI.listMyErrorRequests({ page: 1, page_size: 8, start_date: range.start, end_date: range.end, sort_by: 'created_at', sort_order: 'desc' })
      .then((data) => { recentErrors.value = data.items }))
  } else {
    recentErrors.value = []
  }
  const results = await Promise.allSettled(tasks)
  optionalError.value = results.some((result) => result.status === 'rejected')
  optionalDataLoaded.value = results[1]?.status === 'fulfilled'
}

async function refreshAll() {
  if (stats.value) refreshing.value = true
  else loading.value = true
  try {
    const coreLoaded = await loadCore()
    if (!coreLoaded || !stats.value) return
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
    refreshing.value = false
  }
}

watch(rangeDays, () => {
  if (dashboardStage.value === 'active') void loadCharts()
})
onMounted(() => { void refreshAll() })
</script>

<style scoped>
.dashboard-content,
.dashboard-skeleton {
  display: grid;
  min-width: 0;
  gap: 16px;
}
.dashboard-skeleton__metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.dashboard-retry-banner { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.dashboard-alerts { display: grid; gap: 8px; padding-top: 12px; }
.dashboard-alert { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; align-items: center; gap: 9px; min-width: 0; padding: 9px 12px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); font-size: 13px; line-height: 20px; }
.dashboard-alert--warning { border-color: color-mix(in srgb, var(--ui-warning) 25%, var(--ui-border)); color: var(--ui-warning); background: var(--ui-warning-soft); }
.dashboard-alert--danger { border-color: color-mix(in srgb, var(--ui-danger) 25%, var(--ui-border)); color: var(--ui-danger); background: var(--ui-danger-soft); }
.dashboard-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding-top: 16px; }
.dashboard-grid--ready { grid-template-columns: minmax(0, 1fr); }
.dashboard-grid__wide { grid-column: 1 / -1; }
@media (max-width: 900px) { .dashboard-skeleton__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .dashboard-grid { grid-template-columns: minmax(0, 1fr); } .dashboard-grid__wide { grid-column: auto; } }
@media (max-width: 560px) { .dashboard-skeleton__metrics, .dashboard-retry-banner { grid-template-columns: minmax(0, 1fr); } .dashboard-alert { grid-template-columns: 16px minmax(0, 1fr); } .dashboard-alert .ui-button { grid-column: 2; justify-self: start; } }
</style>
