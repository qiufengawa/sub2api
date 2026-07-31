<template>
  <AppLayout>
    <div class="space-y-4" data-testid="subscriptions-page">
      <div
        v-if="loading"
        class="flex min-h-32 items-center justify-center rounded border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800"
      >
        <div
          class="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
          aria-label="Loading"
        ></div>
      </div>

      <div
        v-else-if="subscriptions.length === 0"
        class="flex min-h-40 flex-col items-center justify-center rounded border border-gray-200 bg-white px-4 py-8 text-center dark:border-dark-700 dark:bg-dark-800"
      >
        <div
          class="mb-3 flex h-9 w-9 items-center justify-center rounded bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300"
        >
          <Icon name="creditCard" size="md" />
        </div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('userSubscriptions.noActiveSubscriptions') }}
        </h3>
        <p class="mt-1 max-w-lg text-xs leading-5 text-gray-500 dark:text-dark-400">
          {{ t('userSubscriptions.noActiveSubscriptionsDesc') }}
        </p>
      </div>

      <template v-else>
        <section
          class="grid grid-cols-1 overflow-hidden rounded border border-gray-200 bg-white sm:grid-cols-3 dark:border-dark-700 dark:bg-dark-800"
          data-testid="subscription-summary"
        >
          <div class="min-w-0 border-b border-gray-100 px-3 py-3 sm:border-b-0 sm:border-r sm:px-4 dark:border-dark-700">
            <p class="text-[10px] text-gray-500 sm:text-xs dark:text-dark-400">
              {{ t('userSubscriptions.summaryActive') }}
            </p>
            <div class="mt-1 flex items-baseline gap-1.5">
              <strong class="text-lg font-semibold tabular-nums text-gray-900 sm:text-xl dark:text-white">
                {{ activeSubscriptions.length }}
              </strong>
              <span class="hidden text-xs text-gray-400 sm:inline dark:text-dark-500">
                / {{ subscriptions.length }} {{ t('userSubscriptions.summaryTotal') }}
              </span>
            </div>
          </div>

          <div class="min-w-0 border-b border-gray-100 px-3 py-3 sm:border-b-0 sm:border-r sm:px-4 dark:border-dark-700">
            <p class="text-[10px] text-gray-500 sm:text-xs dark:text-dark-400">
              {{ t('userSubscriptions.summaryNearestExpiry') }}
            </p>
            <p class="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
              {{ nearestExpiration?.label || t('userSubscriptions.noUpcomingExpiration') }}
            </p>
            <p v-if="nearestExpiration" class="mt-0.5 truncate text-[11px] text-gray-400 dark:text-dark-500">
              {{ nearestExpiration.groupName }} · {{ t('userSubscriptions.expiresOn', { date: nearestExpiration.exactDate }) }}
            </p>
          </div>

          <div class="min-w-0 px-3 py-3 sm:px-4">
            <p class="text-[10px] text-gray-500 sm:text-xs dark:text-dark-400">
              {{ t('userSubscriptions.summaryHighestUsage') }}
            </p>
            <div v-if="highestQuota" class="mt-1 flex items-baseline gap-1.5">
              <strong :class="['text-lg font-semibold tabular-nums sm:text-xl', quotaTextClass(highestQuota.percentage)]">
                {{ formatPercentage(highestQuota.percentage) }}
              </strong>
              <span class="truncate text-[11px] text-gray-400 dark:text-dark-500">
                {{ highestQuota.groupName }} · {{ highestQuota.label }}
              </span>
            </div>
            <p v-else class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('userSubscriptions.noQuotaLimit') }}
            </p>
          </div>
        </section>

        <section
          :class="['grid gap-4', subscriptionsGridClass]"
          data-testid="subscriptions-grid"
        >
          <article
            v-for="subscription in displayedSubscriptions"
            :key="subscription.id"
            class="flex min-w-0 flex-col rounded border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-800"
            data-testid="subscription-card"
          >
            <header
              class="border-b border-gray-100 px-4 py-3 dark:border-dark-700"
              :title="subscription.group?.description || undefined"
            >
              <div class="flex min-w-0 items-center justify-between gap-3">
                <h2 class="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ subscription.group?.name || `Group #${subscription.group_id}` }}
                </h2>
                <span :class="['inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium', statusTextClass(subscription.status)]">
                  <span :class="['h-1.5 w-1.5 rounded-full', statusDotClass(subscription.status)]"></span>
                  {{ t(`userSubscriptions.status.${subscription.status}`) }}
                </span>
              </div>

              <div class="mt-2 flex min-w-0 items-center gap-2">
                <span
                  :class="[
                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none',
                    platformBadgeClass(subscription.group?.platform || ''),
                  ]"
                  data-testid="platform-badge"
                >
                  <PlatformIcon :platform="subscription.group?.platform" size="xs" />
                  {{ platformLabel(subscription.group?.platform || '') }}
                </span>
                <button
                  v-if="subscription.status === 'active'"
                  type="button"
                  class="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-[3px] border border-primary-200 px-2 text-[11px] font-medium text-primary-700 transition-colors hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-primary-800 dark:text-primary-300 dark:hover:bg-primary-950/30"
                  @click="renewSubscription(subscription)"
                >
                  {{ t('userSubscriptions.renewSubscription') }}
                  <Icon name="arrowRight" size="xs" />
                </button>
              </div>
            </header>

            <div class="border-b border-gray-100 px-4 py-3 text-[11px] dark:border-dark-700">
              <div :class="['grid gap-0', subscriptionHasPeakRate(subscription) ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2']">
                <div
                  :class="[
                    'min-w-0 pr-3',
                    subscriptionHasPeakRate(subscription)
                      ? 'col-span-2 mb-3 border-b border-gray-100 pb-3 sm:col-span-1 sm:mb-0 sm:border-b-0 sm:pb-0 dark:border-dark-700'
                      : '',
                  ]"
                >
                  <span class="text-gray-400 dark:text-dark-500">{{ t('userSubscriptions.remainingTime') }}</span>
                  <p
                    :class="['mt-0.5 truncate text-sm font-semibold', expirationTextClass(subscription.expires_at)]"
                    data-testid="expiration-remaining"
                  >
                    {{ expirationRemainingLabel(subscription.expires_at) }}
                  </p>
                  <p
                    v-if="subscription.expires_at"
                    :title="t('userSubscriptions.expiresOn', { date: formatExpirationExactDate(subscription.expires_at) })"
                    class="mt-1 truncate text-[10px] leading-3 text-gray-400 dark:text-dark-500"
                    data-testid="expiration-date"
                  >
                    {{ formatExpirationExactDate(subscription.expires_at) }}
                  </p>
                </div>
                <div
                  :class="[
                    'min-w-0',
                    subscriptionHasPeakRate(subscription)
                      ? 'pr-3 sm:border-l sm:border-gray-100 sm:px-3 sm:dark:border-dark-700'
                      : 'border-l border-gray-100 px-3 dark:border-dark-700',
                  ]"
                >
                  <span class="text-gray-400 dark:text-dark-500">{{ t('userSubscriptions.baseRate') }}</span>
                  <p
                    class="mt-0.5 text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200"
                    data-testid="base-rate"
                  >
                    ×{{ subscription.group?.rate_multiplier ?? 1 }}
                  </p>
                </div>
                <div
                  v-if="subscriptionHasPeakRate(subscription)"
                  class="min-w-0 border-l border-gray-100 pl-3 dark:border-dark-700"
                  data-testid="peak-rate-column"
                >
                  <span class="text-gray-400 dark:text-dark-500">{{ t('userSubscriptions.peakRate') }}</span>
                  <p class="mt-0.5 text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200" data-testid="peak-rate">
                    {{ subscriptionPeakMultiplier(subscription) }}
                  </p>
                  <p
                    :title="subscriptionPeakWindow(subscription)"
                    class="mt-1 truncate text-[10px] leading-3 text-gray-400 dark:text-dark-500"
                    data-testid="peak-window"
                  >
                    {{ subscriptionPeakWindow(subscription) }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex-1 px-4 py-3.5">
              <div v-if="quotaItems(subscription).length" class="space-y-3">
                <div
                  v-for="quota in quotaItems(subscription)"
                  :key="quota.period"
                  class="space-y-1"
                  data-testid="quota-row"
                >
                  <div class="flex items-center justify-between gap-2 text-[11px]">
                    <div class="flex min-w-0 items-center gap-1.5">
                      <span class="font-medium text-gray-700 dark:text-gray-300">{{ quota.label }}</span>
                      <span :class="quotaTextClass(quota.percentage)" class="tabular-nums">
                        {{ formatPercentage(quota.percentage) }}
                      </span>
                    </div>
                    <span class="shrink-0 tabular-nums text-gray-500 dark:text-dark-400">
                      ${{ quota.used.toFixed(2) }} / ${{ quota.limit.toFixed(2) }}
                    </span>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-sm bg-gray-100 dark:bg-dark-700">
                    <div
                      :class="['h-full rounded-sm transition-[width] duration-300', quotaBarClass(quota.percentage)]"
                      :style="{ width: `${Math.min(quota.percentage, 100)}%` }"
                    ></div>
                  </div>
                  <p class="truncate text-[10px] leading-3 text-gray-400 dark:text-dark-500">
                    {{ quota.resetLabel }}
                  </p>
                </div>
              </div>

              <div
                v-else
                class="flex min-h-16 items-center justify-between py-2"
                data-testid="unlimited-quota"
              >
                <div>
                  <p class="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {{ t('userSubscriptions.unlimited') }}
                  </p>
                  <p class="mt-0.5 text-[10px] text-gray-500 dark:text-dark-400">
                    {{ t('userSubscriptions.unlimitedDesc') }}
                  </p>
                </div>
                <Icon name="checkCircle" size="sm" class="text-emerald-500" />
              </div>
            </div>
          </article>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import subscriptionsAPI from '@/api/subscriptions'
import type { UserSubscription } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { formatDateTimeToMinute } from '@/utils/format'
import { hasPeakRate, serverTimezoneLabel } from '@/utils/peak-rate'
import { platformBadgeClass, platformLabel } from '@/utils/platformColors'
import { getRemainingDurationParts, isOneTimeDailyQuota, type RemainingDurationParts } from '@/utils/subscriptionQuota'

type QuotaPeriod = 'daily' | 'weekly' | 'monthly'

interface QuotaItem {
  period: QuotaPeriod
  label: string
  used: number
  limit: number
  percentage: number
  resetLabel: string
}

interface HighestQuota extends QuotaItem {
  groupName: string
}

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const subscriptions = ref<UserSubscription[]>([])
const loading = ref(true)

const activeSubscriptions = computed(() => subscriptions.value.filter((subscription) => subscription.status === 'active'))

const displayedSubscriptions = computed(() => [...subscriptions.value].sort((a, b) => {
  const statusRank: Record<UserSubscription['status'], number> = {
    active: 0,
    suspended: 1,
    expired: 2,
    revoked: 3,
  }
  const statusDifference = statusRank[a.status] - statusRank[b.status]
  if (statusDifference !== 0) return statusDifference

  const quotaDifference = subscriptionMaxUsage(b) - subscriptionMaxUsage(a)
  if (quotaDifference !== 0) return quotaDifference

  const aExpiresAt = a.expires_at ? new Date(a.expires_at).getTime() : Number.POSITIVE_INFINITY
  const bExpiresAt = b.expires_at ? new Date(b.expires_at).getTime() : Number.POSITIVE_INFINITY
  return aExpiresAt - bExpiresAt
}))

const subscriptionsGridClass = computed(() => {
  if (subscriptions.value.length === 1) return 'grid-cols-1'
  return 'md:grid-cols-2'
})

const nearestExpiration = computed(() => {
  const now = Date.now()
  const nearest = activeSubscriptions.value
    .filter((subscription) => subscription.expires_at && new Date(subscription.expires_at).getTime() >= now)
    .sort((a, b) => new Date(a.expires_at as string).getTime() - new Date(b.expires_at as string).getTime())[0]

  if (!nearest?.expires_at) return null

  return {
    label: expirationRemainingLabel(nearest.expires_at),
    exactDate: formatExpirationExactDate(nearest.expires_at),
    groupName: nearest.group?.name || `Group #${nearest.group_id}`,
  }
})

const highestQuota = computed<HighestQuota | null>(() => {
  const items = activeSubscriptions.value.flatMap((subscription) =>
    quotaItems(subscription).map((quota) => ({
      ...quota,
      groupName: subscription.group?.name || `Group #${subscription.group_id}`,
    })),
  )

  return items.sort((a, b) => b.percentage - a.percentage)[0] || null
})

function subscriptionHasPeakRate(subscription: UserSubscription): boolean {
  return hasPeakRate(subscription.group)
}

function subscriptionPeakMultiplier(subscription: UserSubscription): string {
  return `×${subscription.group?.peak_rate_multiplier ?? 1}`
}

function subscriptionPeakWindow(subscription: UserSubscription): string {
  const group = subscription.group
  if (!group?.peak_start || !group.peak_end) return ''

  const window = `${group.peak_start}-${group.peak_end}`
  const timezone = serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset)
  return timezone ? `${window} · ${timezone}` : window
}

async function loadSubscriptions() {
  try {
    loading.value = true
    subscriptions.value = await subscriptionsAPI.getMySubscriptions()
  } catch (error) {
    console.error('Failed to load subscriptions:', error)
    appStore.showError(t('userSubscriptions.failedToLoad'))
  } finally {
    loading.value = false
  }
}

function renewSubscription(subscription: UserSubscription) {
  router.push({
    path: '/purchase',
    query: { tab: 'subscription', group: String(subscription.group_id) },
  })
}

function statusTextClass(status: UserSubscription['status']): string {
  if (status === 'active') {
    return 'text-emerald-700 dark:text-emerald-300'
  }
  if (status === 'suspended') {
    return 'text-orange-700 dark:text-orange-300'
  }
  if (status === 'revoked') {
    return 'text-red-700 dark:text-red-300'
  }
  return 'text-gray-500 dark:text-gray-400'
}

function statusDotClass(status: UserSubscription['status']): string {
  if (status === 'active') return 'bg-emerald-500'
  if (status === 'suspended') return 'bg-orange-500'
  if (status === 'revoked') return 'bg-red-500'
  return 'bg-gray-400'
}

function quotaItems(subscription: UserSubscription): QuotaItem[] {
  const group = subscription.group
  if (!group) return []

  const definitions: Array<{
    period: QuotaPeriod
    label: string
    used: number
    limit: number | null
    windowStart: string | null
    hours: number
  }> = [
    {
      period: 'daily',
      label: t('userSubscriptions.daily'),
      used: subscription.daily_usage_usd || 0,
      limit: group.daily_limit_usd,
      windowStart: subscription.daily_window_start,
      hours: 24,
    },
    {
      period: 'weekly',
      label: t('userSubscriptions.weekly'),
      used: subscription.weekly_usage_usd || 0,
      limit: group.weekly_limit_usd,
      windowStart: subscription.weekly_window_start,
      hours: 168,
    },
    {
      period: 'monthly',
      label: t('userSubscriptions.monthly'),
      used: subscription.monthly_usage_usd || 0,
      limit: group.monthly_limit_usd,
      windowStart: subscription.monthly_window_start,
      hours: 720,
    },
  ]

  return definitions
    .filter((definition): definition is typeof definition & { limit: number } => Boolean(definition.limit))
    .map((definition) => ({
      period: definition.period,
      label: definition.label,
      used: definition.used,
      limit: definition.limit,
      percentage: (definition.used / definition.limit) * 100,
      resetLabel: definition.period === 'daily'
        ? formatDailyUsageWindow(subscription)
        : t('userSubscriptions.resetIn', {
            time: formatResetTime(definition.windowStart, definition.hours),
          }),
    }))
    .sort((a, b) => b.percentage - a.percentage)
}

function subscriptionMaxUsage(subscription: UserSubscription): number {
  const items = quotaItems(subscription)
  return items.length ? Math.max(...items.map((item) => item.percentage)) : -1
}

function formatPercentage(percentage: number): string {
  return `${Math.round(percentage)}%`
}

function quotaBarClass(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500'
  if (percentage >= 70) return 'bg-orange-500'
  return 'bg-primary-500'
}

function quotaTextClass(percentage: number): string {
  if (percentage >= 90) return 'text-red-600 dark:text-red-400'
  if (percentage >= 70) return 'text-orange-600 dark:text-orange-300'
  return 'text-primary-600 dark:text-primary-300'
}

function expirationRemainingLabel(expiresAt: string | null): string {
  if (!expiresAt) return t('userSubscriptions.noExpiration')

  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return t('userSubscriptions.status.expired')
  if (days === 0) return t('common.today')
  if (days === 1) return t('common.tomorrow')
  return t('userSubscriptions.daysCompact', { days })
}

function formatExpirationExactDate(expiresAt: string): string {
  return formatDateTimeToMinute(new Date(expiresAt))
}

function expirationTextClass(expiresAt: string | null): string {
  if (!expiresAt) return 'text-gray-700 dark:text-gray-300'

  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days <= 3) return 'text-red-600 dark:text-red-400'
  if (days <= 7) return 'text-orange-600 dark:text-orange-300'
  return 'text-gray-700 dark:text-gray-300'
}

function formatDurationParts(parts: RemainingDurationParts): string {
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`
  if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m`
  return `${parts.minutes}m`
}

function formatDailyUsageWindow(subscription: UserSubscription): string {
  if (isOneTimeDailyQuota(subscription) && subscription.expires_at) {
    const parts = getRemainingDurationParts(subscription.expires_at)
    if (!parts) return t('userSubscriptions.windowNotActive')
    return t('userSubscriptions.quotaEndsIn', { time: formatDurationParts(parts) })
  }

  return t('userSubscriptions.resetIn', {
    time: formatResetTime(subscription.daily_window_start, 24),
  })
}

function formatResetTime(windowStart: string | null, windowHours: number): string {
  if (!windowStart) return t('userSubscriptions.windowNotActive')

  const start = new Date(windowStart)
  const end = new Date(start.getTime() + windowHours * 60 * 60 * 1000)
  const parts = getRemainingDurationParts(end)
  return parts ? formatDurationParts(parts) : t('userSubscriptions.windowNotActive')
}

onMounted(loadSubscriptions)
</script>
