<template>
  <AppLayout>
    <AppPage density="compact" data-testid="subscriptions-page">
      <AppPageHeader :title="t('userSubscriptions.title')" :description="t('userSubscriptions.description')" />

      <UiSkeleton v-if="loading" variant="rect" width="100%" height="180px" :aria-label="t('common.loading')" data-testid="subscriptions-loading" />
      <UiErrorState
        v-else-if="loadError && subscriptions.length === 0"
        :title="t('userSubscriptions.failedToLoad')"
        :description="t('userSubscriptions.failedToLoadDescription')"
        :retry-text="t('common.retry')"
        data-testid="subscriptions-error"
        @retry="loadSubscriptions"
      />
      <UiEmptyState
        v-else-if="subscriptions.length === 0"
        icon="creditCard"
        :title="t('userSubscriptions.noActiveSubscriptions')"
        :description="t('userSubscriptions.noActiveSubscriptionsDesc')"
      />

      <template v-else>
        <UiAlert
          v-if="loadError"
          tone="danger"
          :title="t('userSubscriptions.failedToLoad')"
          data-testid="subscriptions-refresh-error"
        >
          {{ t('common.retry') }}
          <UiButton density="dense" variant="quiet" @click="loadSubscriptions">{{ t('common.retry') }}</UiButton>
        </UiAlert>
        <section class="subscription-summary" data-testid="subscription-summary">
          <UiStatMetric
            :label="t('userSubscriptions.summaryActive')"
            :value="`${activeSubscriptions.length} / ${subscriptions.length}`"
            :meta="t('userSubscriptions.summaryTotal')"
          />
          <UiStatMetric
            :label="t('userSubscriptions.summaryNearestExpiry')"
            :value="nearestExpiration?.label || t('userSubscriptions.noUpcomingExpiration')"
            :meta="nearestExpiration ? `${nearestExpiration.planName} · ${nearestExpiration.exactDate}` : undefined"
          />
          <UiStatMetric
            :label="t('userSubscriptions.summaryHighestUsage')"
            :value="highestQuota ? formatPercentage(highestQuota.percentage) : t('userSubscriptions.noQuotaLimit')"
            :meta="highestQuota ? `${highestQuota.planName} · ${highestQuota.label}` : undefined"
          />
        </section>

        <section :class="['subscription-grid', subscriptionsGridClass]" data-testid="subscriptions-grid">
          <article v-for="subscription in displayedSubscriptions" :key="subscription.id" class="subscription-card" data-testid="subscription-card">
            <header class="subscription-card__header" :title="subscription.plan_name || undefined">
              <div class="subscription-card__title-row">
                <h2>{{ subscription.plan_name || `Plan #${subscription.plan_id}` }}</h2>
                <UiStatusBadge :status="subscription.status" :label="t(`userSubscriptions.status.${subscription.status}`)" />
              </div>
              <div class="subscription-card__subline">
                <span>{{ t('userSubscriptions.includedGroups') }} <strong>{{ subscriptionIncludedGroups(subscription).length }}</strong></span>
                <UiButton v-if="subscription.status === 'active'" variant="secondary" density="dense" @click="renewSubscription(subscription)">
                  <template #icon><Icon name="arrowRight" size="xs" /></template>
                  {{ t('userSubscriptions.renewSubscription') }}
                </UiButton>
              </div>
            </header>

            <div class="subscription-card__meta">
              <div><span>{{ t('userSubscriptions.remainingTime') }}</span><strong data-testid="expiration-remaining">{{ expirationRemainingLabel(subscription.expires_at) }}</strong><small v-if="subscription.expires_at" data-testid="expiration-date">{{ formatExpirationExactDate(subscription.expires_at) }}</small></div>
              <div><span>{{ t('userSubscriptions.includedGroups') }}</span><strong>{{ subscriptionIncludedGroups(subscription).length }}</strong><small>{{ subscriptionIncludedGroups(subscription).map(group => group.name).join(' / ') }}</small></div>
            </div>

            <div class="subscription-card__body">
              <div v-if="subscriptionIncludedGroups(subscription).length" class="subscription-groups">
                <UiBadge v-for="group in subscriptionIncludedGroups(subscription)" :key="group.id" tone="info" :label="`${group.name} ×${normalizedGroupRate(group.rate_multiplier)}${group.peak_rate_enabled ? ` · ${t('userSubscriptions.peakRateCompact', { rate: normalizedGroupRate(group.peak_rate_multiplier ?? 1) })}` : ''}`" />
              </div>
              <div v-if="quotaItems(subscription).length" class="subscription-quotas">
                <div v-for="quota in quotaItems(subscription)" :key="quota.period" class="subscription-quota" data-testid="quota-row">
                  <div class="subscription-quota__head"><span>{{ quota.label }} <strong>{{ formatPercentage(quota.percentage) }}</strong></span><span>${{ quota.used.toFixed(2) }} / ${{ quota.limit.toFixed(2) }}</span></div>
                  <UiProgressBar :value="quota.percentage" :show-value="false" :tone="quotaTone(quota.percentage)" :label="quota.label" />
                  <small>{{ quota.resetLabel }}</small>
                  <small v-if="quota.showReserved && quota.reserved > 0" data-testid="quota-reserved">{{ t('userSubscriptions.pendingSettlement', { amount: quota.reserved.toFixed(2) }) }}</small>
                </div>
              </div>
              <div v-else class="subscription-unlimited" data-testid="unlimited-quota"><span><strong>{{ t('userSubscriptions.unlimited') }}</strong><small>{{ t('userSubscriptions.unlimitedDesc') }}</small></span><Icon name="checkCircle" size="sm" /></div>
            </div>

            <footer v-if="subscription.status === 'active'" class="subscription-card__actions" data-testid="subscription-key-actions">
              <UiButton variant="primary" density="compact" block data-testid="create-subscription-key" @click="openSubscriptionKeyAction(subscription, 'create')"><template #icon><Icon name="key" size="sm" /></template>{{ t('userSubscriptions.createSubscriptionKey') }}</UiButton>
              <UiButton variant="secondary" density="compact" block data-testid="bind-subscription-key" @click="openSubscriptionKeyAction(subscription, 'bind')"><template #icon><Icon name="link" size="sm" /></template>{{ t('userSubscriptions.bindExistingKey') }}</UiButton>
            </footer>
          </article>
        </section>
      </template>

      <UiDialog :show="keyActionIntent !== null" :title="t('userSubscriptions.selectKeyGroupTitle')" width="narrow" @close="closeKeyActionGroupDialog">
        <div class="subscription-group-dialog" data-testid="subscription-key-group-dialog">
          <p>{{ t('userSubscriptions.selectKeyGroupDescription') }}</p>
          <UiRadioGroup
            :model-value="selectedKeyActionGroupID ?? 0"
            :options="keyActionGroupOptions"
            name="subscription-key-group"
            layout="stacked"
            :aria-label="t('userSubscriptions.selectKeyGroupTitle')"
            @update:model-value="selectedKeyActionGroupID = Number($event)"
          >
            <template #option="{ option }">
              <PlatformIcon :platform="keyActionGroupForOption(option.value)?.platform" size="sm" />
              <span>{{ option.label }}</span>
              <strong>×{{ normalizedGroupRate(keyActionGroupForOption(option.value)?.rate_multiplier ?? 1) }}</strong>
            </template>
          </UiRadioGroup>
        </div>
        <template #footer>
          <div class="subscription-dialog-actions"><UiButton density="compact" @click="closeKeyActionGroupDialog">{{ t('common.cancel') }}</UiButton><UiButton variant="primary" density="compact" :disabled="selectedKeyActionGroupID === null" data-testid="confirm-subscription-key-group" @click="confirmKeyActionGroup">{{ t('common.confirm') }}</UiButton></div>
        </template>
      </UiDialog>
    </AppPage>
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
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { formatDateTimeToMinute } from '@/utils/format'
import {
  getExpirationDateRelation,
  type RemainingDurationParts
} from '@/utils/subscriptionQuota'
import {
  AppPage,
  AppPageHeader,
  UiBadge,
  UiAlert,
  UiButton,
  UiDialog,
  UiEmptyState,
  UiErrorState,
  UiProgressBar,
  UiRadioGroup,
  UiSkeleton,
  UiStatMetric,
  UiStatusBadge,
} from '@/components/ui'

type QuotaPeriod = 'fiveHour' | 'cycle' | 'total' | 'daily' | 'weekly' | 'monthly'

interface QuotaItem {
  period: QuotaPeriod
  label: string
  used: number
  reserved: number
  limit: number
  percentage: number
  resetLabel: string
  showReserved: boolean
}

interface HighestQuota extends QuotaItem {
  planName: string
}

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()

const subscriptions = ref<UserSubscription[]>([])
const loading = ref(true)
const loadError = ref(false)
let loadSequence = 0
const keyActionIntent = ref<{ subscription: UserSubscription; action: 'create' | 'bind' } | null>(null)
const selectedKeyActionGroupID = ref<number | null>(null)

const keyActionGroups = computed(() => {
  if (!keyActionIntent.value) return []
  return subscriptionKeyGroups(keyActionIntent.value.subscription)
})

const keyActionGroupOptions = computed(() => keyActionGroups.value.map(group => ({
  value: group.id,
  label: group.name,
  title: group.description || group.name,
})))

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
  if (subscriptions.value.length === 1) return 'subscription-grid--single'
  return 'subscription-grid--double'
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
  const requestSequence = ++loadSequence
  try {
    loading.value = true
    loadError.value = false
    const nextSubscriptions = await subscriptionsAPI.getMySubscriptions()
    if (requestSequence !== loadSequence) return
    subscriptions.value = nextSubscriptions
  } catch (error) {
    if (requestSequence !== loadSequence) return
    console.error('Failed to load subscriptions:', error)
    loadError.value = true
    appStore.showError(t('userSubscriptions.failedToLoad'))
  } finally {
    if (requestSequence === loadSequence) loading.value = false
  }
}

function renewSubscription(subscription: UserSubscription) {
  router.push({
    path: '/purchase',
	query: { tab: 'subscription', plan_id: String(subscription.plan_id), subscription_id: String(subscription.id) },
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

function keyActionGroupForOption(value: string | number): Group | undefined {
  return keyActionGroups.value.find(group => group.id === Number(value))
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

function quotaItems(subscription: UserSubscription): QuotaItem[] {
  const items: QuotaItem[] = []
  const hasFiveHourQuota = subscription.five_hour_quota_usd != null && subscription.five_hour_quota_usd > 0
  if (hasFiveHourQuota) {
	const used = Number(subscription.five_hour_usage_usd) || 0
	const reserved = Math.max(Number(subscription.five_hour_reserved_usd) || 0, 0)
	const limit = Number(subscription.five_hour_quota_usd)
	items.push({
	  period: 'fiveHour',
	  label: t('userSubscriptions.fiveHourQuota'),
	  used,
	  reserved,
	  limit,
	  percentage: ((used + reserved) / limit) * 100,
	  resetLabel: formatWindowReset(subscription.five_hour_started_at, 18000, subscription.expires_at),
	  showReserved: true,
	})
  }
  const hasCycleQuota = subscription.cycle_quota_usd != null && subscription.cycle_quota_usd > 0
  if (hasCycleQuota) {
    const used = Number(subscription.cycle_usage_usd) || 0
    const reserved = Math.max(Number(subscription.cycle_reserved_usd) || 0, 0)
    const limit = Number(subscription.cycle_quota_usd)
    items.push({
      period: 'cycle',
      label: t('userSubscriptions.cycleQuota'),
      used,
      reserved,
      limit,
      percentage: ((used + reserved) / limit) * 100,
      resetLabel: formatCycleReset(subscription),
	  showReserved: !hasFiveHourQuota,
    })
  }

  if (subscription.total_quota_usd != null && subscription.total_quota_usd > 0) {
    const used = Number(subscription.total_usage_usd) || 0
    const reserved = Math.max(Number(subscription.total_reserved_usd) || 0, 0)
    const limit = Number(subscription.total_quota_usd)
    items.push({
      period: 'total',
      label: t('userSubscriptions.totalQuota'),
      used,
      reserved,
      limit,
      percentage: ((used + reserved) / limit) * 100,
      resetLabel: subscription.expires_at
        ? t('userSubscriptions.expiresOn', { date: formatExpirationExactDate(subscription.expires_at) })
        : t('userSubscriptions.noExpiration'),
	  showReserved: !hasFiveHourQuota && !hasCycleQuota,
    })
  }

  return items
}

function formatCycleReset(subscription: UserSubscription): string {
  const intervalSeconds = Number(subscription.reset_interval_seconds) || 0
	return formatWindowReset(subscription.cycle_started_at, intervalSeconds, subscription.expires_at)
}

function formatWindowReset(startedAt: string | null | undefined, intervalSeconds: number, expiresAt: string | null): string {
	if (!startedAt || intervalSeconds <= 0) return t('userSubscriptions.windowNotActive')
	const start = new Date(startedAt).getTime()
	if (!Number.isFinite(start)) return t('userSubscriptions.windowNotActive')
	const now = Date.now()
	const intervalMilliseconds = intervalSeconds * 1000
	const completedWindows = Math.max(0, Math.floor((now - start) / intervalMilliseconds))
	let resetAt = start + (completedWindows + 1) * intervalMilliseconds
	if (expiresAt) {
	  const expiry = new Date(expiresAt).getTime()
	  if (Number.isFinite(expiry)) resetAt = Math.min(resetAt, expiry)
	}
	const remainingSeconds = Math.max(0, Math.ceil((resetAt - now) / 1000))
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

function quotaTone(percentage: number): 'neutral' | 'warning' | 'danger' {
  if (percentage >= 90) return 'danger'
  if (percentage >= 70) return 'warning'
  return 'neutral'
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

function formatDurationParts(parts: RemainingDurationParts): string {
  if (parts.days > 0) return `${parts.days}d ${parts.hours}h`
  if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m`
  return `${parts.minutes}m`
}

onMounted(loadSubscriptions)
</script>

<style scoped>
.subscription-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-border-soft);
}
.subscription-summary > * { min-width: 0; padding: 14px 16px; background: var(--ui-surface); }
.subscription-grid { display: grid; gap: 14px; }
.subscription-grid--single { grid-template-columns: minmax(0, 1fr); }
.subscription-grid--double { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.subscription-card { display: flex; min-width: 0; flex-direction: column; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-panel); background: var(--ui-surface); }
.subscription-card__header { display: grid; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--ui-border-soft); }
.subscription-card__title-row, .subscription-card__subline { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 12px; }
.subscription-card__title-row h2 { min-width: 0; margin: 0; overflow: hidden; color: var(--ui-text); font-size: 14px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.subscription-card__subline { color: var(--ui-text-muted); font-size: 12px; }
.subscription-card__subline strong { color: var(--ui-text); font-variant-numeric: tabular-nums; }
.subscription-card__meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--ui-border-soft); }
.subscription-card__meta > div { display: grid; min-width: 0; gap: 3px; }
.subscription-card__meta > div + div { padding-left: 12px; border-left: 1px solid var(--ui-border-soft); }
.subscription-card__meta span, .subscription-card__meta small { overflow: hidden; color: var(--ui-text-soft); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.subscription-card__meta strong { overflow: hidden; color: var(--ui-text); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.subscription-card__body { display: grid; flex: 1; gap: 14px; padding: 14px 16px; }
.subscription-groups { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--ui-border-soft); }
.subscription-quotas { display: grid; gap: 14px; }
.subscription-quota { display: grid; gap: 6px; min-width: 0; }
.subscription-quota__head { display: flex; justify-content: space-between; gap: 12px; color: var(--ui-text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.subscription-quota__head strong { margin-left: 4px; color: var(--ui-text); font-weight: 600; }
.subscription-quota small { overflow: hidden; color: var(--ui-text-soft); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.subscription-quota small[data-testid="quota-reserved"] { color: var(--ui-warning); }
.subscription-unlimited { display: flex; min-height: 64px; align-items: center; justify-content: space-between; gap: 12px; color: var(--ui-success); }
.subscription-unlimited span { display: grid; gap: 3px; }
.subscription-unlimited strong { color: var(--ui-text); font-size: 13px; }
.subscription-unlimited small { color: var(--ui-text-muted); font-size: 11px; }
.subscription-card__actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 12px 16px; border-top: 1px solid var(--ui-border-soft); }
.subscription-group-dialog { display: grid; gap: 10px; }
.subscription-group-dialog > p { margin: 0; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.subscription-group-dialog :deep(.ui-radio-group) { display: grid; gap: 10px; }
.subscription-group-dialog :deep(.ui-radio) { display: grid; grid-template-columns: 16px 20px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 36px; padding: 6px 0; border: 0; border-bottom: 1px solid var(--ui-border-soft); border-radius: 0; color: var(--ui-text); font-size: 13px; cursor: pointer; }
.subscription-group-dialog :deep(.ui-radio__content) { display: contents; }
.subscription-group-dialog :deep(.ui-radio__content > span) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.subscription-group-dialog :deep(.ui-radio__content > strong) { color: var(--ui-text-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.subscription-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 760px) {
  .subscription-summary { grid-template-columns: 1fr; gap: 1px; }
  .subscription-grid--double { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .subscription-card__actions { grid-template-columns: 1fr; }
}
</style>
