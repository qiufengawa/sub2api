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
              {{ nearestExpiration.planName }} · {{ t('userSubscriptions.expiresOn', { date: nearestExpiration.exactDate }) }}
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
                {{ highestQuota.planName }} · {{ highestQuota.label }}
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
              :title="subscription.plan_name || undefined"
            >
              <div class="flex min-w-0 items-center justify-between gap-3">
                <h2 class="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ subscription.plan_name || `Plan #${subscription.plan_id}` }}
                </h2>
                <span :class="['inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium', statusTextClass(subscription.status)]">
                  <span :class="['h-1.5 w-1.5 rounded-full', statusDotClass(subscription.status)]"></span>
                  {{ t(`userSubscriptions.status.${subscription.status}`) }}
                </span>
              </div>

              <div class="mt-2 flex min-w-0 items-center gap-2">
                <span
                  class="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-dark-400"
                >
                  {{ t('userSubscriptions.includedGroups') }}
                  <strong class="font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                    {{ subscriptionIncludedGroups(subscription).length }}
                  </strong>
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
              <div class="grid grid-cols-2 gap-0">
                <div class="min-w-0 pr-3">
                  <span class="text-gray-400 dark:text-dark-500">{{ t('userSubscriptions.remainingTime') }}</span>
                  <p :class="['mt-0.5 truncate text-sm font-semibold', expirationTextClass(subscription.expires_at)]" data-testid="expiration-remaining">
                    {{ expirationRemainingLabel(subscription.expires_at) }}
                  </p>
                  <p v-if="subscription.expires_at" class="mt-1 truncate text-[10px] leading-3 text-gray-400 dark:text-dark-500" data-testid="expiration-date">
                    {{ formatExpirationExactDate(subscription.expires_at) }}
                  </p>
                </div>
                <div class="min-w-0 border-l border-gray-100 pl-3 dark:border-dark-700">
                  <span class="text-gray-400 dark:text-dark-500">{{ t('userSubscriptions.includedGroups') }}</span>
                  <p class="mt-0.5 text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {{ subscriptionIncludedGroups(subscription).length }}
                  </p>
                  <p class="mt-1 truncate text-[10px] leading-3 text-gray-400 dark:text-dark-500">
                    {{ subscriptionIncludedGroups(subscription).map(group => group.name).join(' / ') }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex-1 px-4 py-3.5">
			  <div v-if="subscriptionIncludedGroups(subscription).length" class="mb-3 flex flex-wrap gap-1.5 border-b border-gray-100 pb-3 dark:border-dark-700">
				<span
				  v-for="group in subscriptionIncludedGroups(subscription)"
				  :key="group.id"
				  :class="['inline-flex max-w-full items-center gap-1.5 rounded-[3px] border px-2 py-1 text-[10px] font-medium', platformBadgeClass(group.platform || '')]"
				  :title="group.name"
				>
				  <PlatformIcon :platform="group.platform" size="xs" />
				  <span class="max-w-40 truncate">{{ group.name }}</span>
				  <span class="shrink-0 tabular-nums">×{{ normalizedGroupRate(group.rate_multiplier) }}</span>
				  <span v-if="group.peak_rate_enabled" class="shrink-0 text-amber-700 dark:text-amber-300">
					{{ t('userSubscriptions.peakRateCompact', { rate: normalizedGroupRate(group.peak_rate_multiplier ?? 1) }) }}
				  </span>
				</span>
			  </div>
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
                  <p
                    v-if="quota.reserved > 0"
                    class="truncate text-[10px] leading-3 text-amber-600 dark:text-amber-300"
                    data-testid="quota-reserved"
                  >
                    {{ t('userSubscriptions.pendingSettlement', { amount: quota.reserved.toFixed(2) }) }}
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

            <footer
              v-if="subscription.status === 'active'"
              class="grid grid-cols-2 gap-2 border-t border-gray-100 px-4 py-3 sm:flex sm:justify-end dark:border-dark-700"
              data-testid="subscription-key-actions"
            >
              <button
                type="button"
                class="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[3px] bg-primary-600 px-2.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/25 sm:min-w-40 sm:px-3"
                :title="t('userSubscriptions.createSubscriptionKey')"
                data-testid="create-subscription-key"
                @click="openSubscriptionKeyAction(subscription, 'create')"
              >
                <Icon name="key" size="sm" class="shrink-0" />
                <span class="truncate">{{ t('userSubscriptions.createSubscriptionKey') }}</span>
              </button>
              <button
                type="button"
                class="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[3px] border border-gray-200 px-2.5 text-xs font-medium text-gray-700 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:min-w-40 sm:px-3 dark:border-dark-600 dark:text-gray-300 dark:hover:border-primary-800 dark:hover:bg-primary-950/30 dark:hover:text-primary-300"
                :title="t('userSubscriptions.bindExistingKey')"
                data-testid="bind-subscription-key"
                @click="openSubscriptionKeyAction(subscription, 'bind')"
              >
                <Icon name="link" size="sm" class="shrink-0" />
                <span class="truncate">{{ t('userSubscriptions.bindExistingKey') }}</span>
              </button>
            </footer>
          </article>
        </section>
      </template>

      <BaseDialog
        :show="keyActionIntent !== null"
        :title="t('userSubscriptions.selectKeyGroupTitle')"
        width="narrow"
        @close="closeKeyActionGroupDialog"
      >
        <div class="space-y-3" data-testid="subscription-key-group-dialog">
          <p class="text-xs leading-5 text-gray-500 dark:text-dark-400">
            {{ t('userSubscriptions.selectKeyGroupDescription') }}
          </p>
          <div class="divide-y divide-gray-100 border-y border-gray-100 dark:divide-dark-700 dark:border-dark-700">
            <label
              v-for="group in keyActionGroups"
              :key="group.id"
              class="flex cursor-pointer items-center gap-3 py-2.5"
              :title="group.description || group.name"
            >
              <input
                v-model="selectedKeyActionGroupID"
                type="radio"
                name="subscription-key-group"
                :value="group.id"
                class="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <PlatformIcon :platform="group.platform" size="sm" />
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ group.name }}
              </span>
              <span class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-dark-400">
                ×{{ normalizedGroupRate(group.rate_multiplier) }}
              </span>
            </label>
          </div>
        </div>
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <button type="button" class="btn btn-secondary" @click="closeKeyActionGroupDialog">
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="selectedKeyActionGroupID === null"
              data-testid="confirm-subscription-key-group"
              @click="confirmKeyActionGroup"
            >
              {{ t('common.confirm') }}
            </button>
          </div>
        </template>
      </BaseDialog>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import subscriptionsAPI from '@/api/subscriptions'
import type { Group, UserSubscription } from '@/types'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { formatDateTimeToMinute } from '@/utils/format'
import { platformBadgeClass } from '@/utils/platformColors'
import {
  getExpirationDateRelation,
  type RemainingDurationParts
} from '@/utils/subscriptionQuota'

type QuotaPeriod = 'cycle' | 'daily' | 'weekly' | 'monthly'

interface QuotaItem {
  period: QuotaPeriod
  label: string
  used: number
  reserved: number
  limit: number
  percentage: number
  resetLabel: string
}

interface HighestQuota extends QuotaItem {
  planName: string
}

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const subscriptions = ref<UserSubscription[]>([])
const loading = ref(true)
const keyActionIntent = ref<{ subscription: UserSubscription; action: 'create' | 'bind' } | null>(null)
const selectedKeyActionGroupID = ref<number | null>(null)

const keyActionGroups = computed(() => {
  if (!keyActionIntent.value) return []
  return subscriptionKeyGroups(keyActionIntent.value.subscription)
})

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
    planName: nearest.plan_name || `Plan #${nearest.plan_id}`,
  }
})

const highestQuota = computed<HighestQuota | null>(() => {
  const items = activeSubscriptions.value.flatMap((subscription) =>
    quotaItems(subscription).map((quota) => ({
      ...quota,
      planName: subscription.plan_name || `Plan #${subscription.plan_id}`,
    })),
  )

  return items.sort((a, b) => b.percentage - a.percentage)[0] || null
})

function subscriptionIncludedGroups(subscription: UserSubscription): Group[] {
  return subscription.included_groups ?? []
}

function normalizedGroupRate(rate: number): number {
  return Number((rate ?? 1).toPrecision(10))
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
    query: { tab: 'subscription', plan_id: String(subscription.plan_id) },
  })
}

function subscriptionKeyGroups(subscription: UserSubscription): Group[] {
  const candidates = subscriptionIncludedGroups(subscription)
  const unique = new Map<number, Group>()
  for (const group of candidates) {
    if (group.id > 0 && (!group.status || group.status === 'active')) unique.set(group.id, group)
  }
  return [...unique.values()]
}

function navigateToSubscriptionKeyAction(action: 'create' | 'bind', groupID: number) {
  router.push({
    path: '/keys',
    query: {
      action,
      group_id: String(groupID),
      source: 'subscription',
    },
  })
}

function openSubscriptionKeyAction(subscription: UserSubscription, action: 'create' | 'bind') {
  const groups = subscriptionKeyGroups(subscription)
  if (groups.length === 0) {
    appStore.showError(t('userSubscriptions.noAvailableKeyGroup'))
    return
  }
  if (groups.length === 1) {
    navigateToSubscriptionKeyAction(action, groups[0].id)
    return
  }
  keyActionIntent.value = { subscription, action }
  selectedKeyActionGroupID.value = groups[0].id
}

function closeKeyActionGroupDialog() {
  keyActionIntent.value = null
  selectedKeyActionGroupID.value = null
}

function confirmKeyActionGroup() {
  const intent = keyActionIntent.value
  const groupID = selectedKeyActionGroupID.value
  if (!intent || groupID === null || !keyActionGroups.value.some(group => group.id === groupID)) return
  navigateToSubscriptionKeyAction(intent.action, groupID)
  closeKeyActionGroupDialog()
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
	if (subscription.cycle_quota_usd != null && subscription.cycle_quota_usd > 0) {
	  const used = Number(subscription.cycle_usage_usd) || 0
	  const reserved = Math.max(Number(subscription.cycle_reserved_usd) || 0, 0)
	  const limit = Number(subscription.cycle_quota_usd)
	  return [{
		period: 'cycle',
		label: t('userSubscriptions.cycleQuota'),
		used,
		reserved,
		limit,
		percentage: ((used + reserved) / limit) * 100,
		resetLabel: formatCycleReset(subscription),
	  }]
	}

  return []
}

function formatCycleReset(subscription: UserSubscription): string {
  const startedAt = subscription.cycle_started_at
  const intervalSeconds = Number(subscription.reset_interval_seconds) || 0
  if (!startedAt || intervalSeconds <= 0) return t('userSubscriptions.windowNotActive')
  const resetAt = new Date(startedAt).getTime() + intervalSeconds * 1000
  const remainingSeconds = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))
  const days = Math.floor(remainingSeconds / 86400)
  const hours = Math.floor((remainingSeconds % 86400) / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  return t('userSubscriptions.resetIn', { time: formatDurationParts({ days, hours, minutes }) })
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

  const now = new Date()
  const expires = new Date(expiresAt)
  const relation = getExpirationDateRelation(expires, now)

  if (relation === null) return ''
  if (relation === 'expired') return t('userSubscriptions.status.expired')
  if (relation === 'today') return t('common.today')
  if (relation === 'tomorrow') return t('common.tomorrow')

  const days = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return t('userSubscriptions.daysCompact', { days })
}

function formatExpirationExactDate(expiresAt: string): string {
  return formatDateTimeToMinute(new Date(expiresAt))
}

function expirationTextClass(expiresAt: string | null): string {
  if (!expiresAt) return 'text-gray-700 dark:text-gray-300'

  const now = new Date()
  const expires = new Date(expiresAt)
  const relation = getExpirationDateRelation(expires, now)

  if (relation === null) return 'text-gray-700 dark:text-gray-300'
  if (relation === 'expired') return 'font-medium text-red-600 dark:text-red-400'

  const days = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 3) return 'text-red-600 dark:text-red-400'
  if (days <= 7) return 'text-orange-600 dark:text-orange-300'
  return 'text-gray-700 dark:text-gray-300'
}

function formatDurationParts(parts: RemainingDurationParts): string {
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`
  if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m`
  return `${parts.minutes}m`
}

onMounted(loadSubscriptions)
</script>
