<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <section
      class="card min-h-[126px] border px-4 py-3.5"
      :class="allowanceCardClass"
      data-testid="dashboard-balance-card"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-500 dark:text-dark-400">
            {{ allowanceUsesSubscription ? t('dashboard.overview.subscriptionAllowance') : t('dashboard.overview.availableBalance') }}
          </p>
          <p class="mt-1.5 truncate text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
            {{ formatMoney(primaryAllowance) }}
          </p>
        </div>
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px]" :class="allowanceIconClass">
          <Icon :name="allowanceUsesSubscription ? 'badge' : 'creditCard'" size="sm" :stroke-width="1.8" />
        </div>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-dark-400">
        <span>{{ t('dashboard.overview.todayDeduction', { amount: formatMoney(stats.today_actual_cost) }) }}</span>
        <span v-if="allowanceUsesSubscription">{{ activeSubscriptionLabel }}</span>
        <span v-else-if="frozenBalance > 0">{{ t('dashboard.overview.frozenBalance', { amount: formatMoney(frozenBalance) }) }}</span>
        <span v-if="nearestExpiryDays !== null">{{ t('dashboard.overview.expiresInDays', { days: nearestExpiryDays }) }}</span>
      </div>
      <router-link
        v-if="allowanceUnavailable && !accountDisabled && !isSimple"
        :to="fundingPath"
        class="mt-2 inline-flex text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
      >
        {{ fundingLabel }}
      </router-link>
    </section>

    <section class="card min-h-[126px] px-4 py-3.5" data-testid="dashboard-today-card">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.todayUsage') }}</p>
          <p class="mt-1.5 truncate text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
            {{ formatMoney(stats.today_actual_cost) }}
          </p>
        </div>
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Icon name="chartBar" size="sm" :stroke-width="1.8" />
        </div>
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-dark-400">
        <span>{{ t('dashboard.overview.requestCount', { count: formatNumber(stats.today_requests) }) }}</span>
        <span>{{ t('dashboard.overview.tokenCount', { count: formatTokens(stats.today_tokens) }) }}</span>
        <span
          v-if="costChange !== null && costChange !== 0"
          :class="costChange > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'"
        >
          {{ t(costChange > 0 ? 'dashboard.overview.moreThanYesterday' : 'dashboard.overview.lessThanYesterday', { percent: Math.abs(costChange) }) }}
        </span>
      </div>
    </section>

    <section
      class="card min-h-[126px] px-4 py-3.5 sm:col-span-2 lg:col-span-1"
      :class="accessCardClass"
      data-testid="dashboard-access-card"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.accessStatus') }}</p>
          <template v-if="stats.total_api_keys <= 0">
            <p class="mt-1.5 text-lg font-semibold text-gray-950 dark:text-white">{{ t('dashboard.overview.noApiKeyTitle') }}</p>
            <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.noApiKeyDescription') }}</p>
          </template>
          <p v-else class="mt-1.5 truncate text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
            {{ t('dashboard.overview.keysAvailable', { active: stats.active_api_keys, total: stats.total_api_keys }) }}
          </p>
        </div>
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px]" :class="accessIconClass">
          <Icon :name="accessHealthy ? 'key' : 'exclamationTriangle'" size="sm" :stroke-width="1.8" />
        </div>
      </div>
      <router-link v-if="stats.total_api_keys <= 0" to="/keys" class="btn btn-primary btn-sm mt-2">
        {{ t('dashboard.createApiKey') }}
      </router-link>
      <div v-else class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-dark-400">
        <span>{{ lastSuccessText }}</span>
        <span v-if="errorViewEnabled" :class="recentErrorCount > 0 ? 'text-red-600 dark:text-red-400' : ''">
          {{ t('dashboard.overview.recentFailures', { count: recentErrorCount }) }}
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { UserDashboardStats as UserStatsType } from '@/api/usage'
import type { SubscriptionSummary } from '@/api/subscriptions'
import type { UsageLog, UserErrorRequest } from '@/types'
import { formatRelativeTime } from '@/utils/format'

const props = withDefaults(defineProps<{
  stats: UserStatsType
  balance: number
  frozenBalance?: number
  isSimple: boolean
  accountDisabled?: boolean
  subscriptionSummary?: SubscriptionSummary | null
  recentUsage?: UsageLog[]
  recentErrors?: UserErrorRequest[]
  errorViewEnabled?: boolean
  yesterdayCost?: number
  quotaPercent?: number
  nearestExpiryDays?: number | null
  fundingPath?: string
  fundingLabel?: string
}>(), {
  frozenBalance: 0,
  accountDisabled: false,
  subscriptionSummary: null,
  recentUsage: () => [],
  recentErrors: () => [],
  errorViewEnabled: false,
  yesterdayCost: 0,
  quotaPercent: 0,
  nearestExpiryDays: null,
  fundingPath: '/redeem',
  fundingLabel: '',
})

const { t, locale } = useI18n()

const subscriptionAllowances = computed(() => {
  const rows: Array<{ remaining: number; planName: string }> = []
  for (const subscription of props.subscriptionSummary?.subscriptions ?? []) {
    const limit = subscription.cycle_limit_usd
    if (typeof limit === 'number' && limit > 0) {
      rows.push({
        remaining: Math.max(0, limit - (subscription.cycle_used_usd ?? 0)),
        planName: subscription.plan_name || `#${subscription.plan_id}`,
      })
    }
  }
  return rows.sort((a, b) => a.remaining - b.remaining)
})

const latestUsage = computed(() => props.recentUsage[0])
const allowanceUsesSubscription = computed(() =>
  subscriptionAllowances.value.length > 0 && (latestUsage.value?.billing_type === 1 || props.balance <= 0)
)
const primaryAllowance = computed(() => allowanceUsesSubscription.value ? subscriptionAllowances.value[0].remaining : props.balance)
const activeSubscriptionLabel = computed(() => subscriptionAllowances.value[0]?.planName || t('dashboard.overview.subscriptionBilling'))
const allowanceUnavailable = computed(() => props.accountDisabled
  || (!props.isSimple && primaryAllowance.value <= 0)
  || (props.isSimple && allowanceUsesSubscription.value && primaryAllowance.value <= 0))
const allowanceTone = computed<'normal' | 'warning' | 'danger'>(() => {
  if (allowanceUnavailable.value || props.quotaPercent >= 95) return 'danger'
  if (props.quotaPercent >= 80) return 'warning'
  return 'normal'
})
const allowanceCardClass = computed(() => ({
  normal: 'border-gray-200 dark:border-dark-700',
  warning: 'border-amber-300 dark:border-amber-800',
  danger: 'border-red-300 dark:border-red-800',
}[allowanceTone.value]))
const allowanceIconClass = computed(() => ({
  normal: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400',
  danger: 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400',
}[allowanceTone.value]))

const accessHealthy = computed(() => !props.accountDisabled && props.stats.active_api_keys > 0)
const accessCardClass = computed(() => props.accountDisabled || (props.stats.total_api_keys > 0 && props.stats.active_api_keys <= 0)
  ? 'border-red-300 dark:border-red-800'
  : props.stats.total_api_keys <= 0 ? 'border-amber-300 dark:border-amber-800' : '')
const accessIconClass = computed(() => accessHealthy.value
  ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
  : props.stats.total_api_keys <= 0
    ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400'
    : 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400')
const lastSuccessText = computed(() => {
  const createdAt = latestUsage.value?.created_at
  return createdAt
    ? t('dashboard.overview.lastSuccess', { time: formatRelativeTime(createdAt) })
    : t('dashboard.overview.noSuccessfulCalls')
})
const recentErrorCount = computed(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  return props.recentErrors.filter((item) => new Date(item.created_at).getTime() >= cutoff).length
})
const costChange = computed<number | null>(() => {
  if (props.yesterdayCost <= 0) return null
  return Math.round(((props.stats.today_actual_cost - props.yesterdayCost) / props.yesterdayCost) * 100)
})

const formatMoney = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`
const formatNumber = (value: number) => new Intl.NumberFormat(locale.value).format(value)
const formatTokens = (value: number) => new Intl.NumberFormat(locale.value, {
  notation: value >= 10_000 ? 'compact' : 'standard',
  maximumFractionDigits: 1,
}).format(value)
</script>
