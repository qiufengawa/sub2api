<template>
  <div v-if="hasActiveSubscriptions" ref="containerRef" class="subscription-progress">
    <button
      type="button"
      class="subscription-progress__trigger"
      :aria-expanded="tooltipOpen"
      :title="t('subscriptionProgress.viewDetails')"
      @click="toggleTooltip"
    >
      <Icon name="creditCard" size="sm" class="subscription-progress__icon" />
      <span class="subscription-progress__summary">
        <span class="subscription-progress__count ui-numeric">{{ activeSubscriptions.length }}</span>
        <span class="subscription-progress__dots" aria-hidden="true">
          <i v-for="(sub, index) in displaySubscriptions.slice(0, 3)" :key="index" :class="`is-${getProgressTone(sub)}`" />
        </span>
        <span class="subscription-progress__label">{{ t('subscriptionProgress.activeLabel') }}</span>
      </span>
    </button>

    <transition name="dropdown">
      <div v-if="tooltipOpen" class="subscription-progress__popover">
        <header>
          <h3>{{ t('subscriptionProgress.title') }}</h3>
          <p>
            {{ t('subscriptionProgress.activeCount', { count: activeSubscriptions.length }) }}
          </p>
        </header>

        <div class="subscription-progress__list">
          <div
            v-for="subscription in displaySubscriptions"
            :key="subscription.id"
            class="subscription-progress__item"
          >
            <div class="subscription-progress__item-header">
              <span>
                {{ subscription.plan_name || `#${subscription.plan_id}` }}
              </span>
              <UiStatusBadge v-if="subscription.expires_at" :status="getDaysRemainingStatus(subscription.expires_at)" :label="formatDaysRemaining(subscription.expires_at)" />
            </div>

            <UiStatusBadge v-if="isUnlimited(subscription)" status="active" :label="t('subscriptionProgress.unlimited')" />
            <UiProgressBar
              v-else
              :value="getMaxUsagePercentage(subscription)"
              :show-value="false"
              :tone="getProgressTone(subscription)"
              :label="t('subscriptionProgress.cycle')"
              :aria-label="formatUsage(subscription.cycle_usage_usd, subscription.cycle_quota_usd)"
            />
            <span v-if="!isUnlimited(subscription)" class="subscription-progress__usage">
              {{ formatUsage(subscription.cycle_usage_usd, subscription.cycle_quota_usd) }}
            </span>
          </div>
        </div>

        <footer>
          <RouterLink
            to="/subscriptions"
            @click="closeTooltip"
            class="subscription-progress__link"
          >
            {{ t('subscriptionProgress.viewAll') }}
          </RouterLink>
        </footer>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useSubscriptionStore } from '@/stores'
import type { UserSubscription } from '@/types'
import { UiProgressBar, UiStatusBadge } from '@/components/ui'

const { t } = useI18n()

const subscriptionStore = useSubscriptionStore()

const containerRef = ref<HTMLElement | null>(null)
const tooltipOpen = ref(false)

// Use store data instead of local state
const activeSubscriptions = computed(() => subscriptionStore.activeSubscriptions)
const hasActiveSubscriptions = computed(() => subscriptionStore.hasActiveSubscriptions)

const displaySubscriptions = computed(() => {
  // Sort by most usage (highest percentage first)
  return [...activeSubscriptions.value].sort((a, b) => {
    const aMax = getMaxUsagePercentage(a)
    const bMax = getMaxUsagePercentage(b)
    return bMax - aMax
  })
})

function getMaxUsagePercentage(sub: UserSubscription): number {
  const limit = sub.cycle_quota_usd
  if (!limit || limit <= 0) return 0
  return ((sub.cycle_usage_usd || 0) / limit) * 100
}

function isUnlimited(sub: UserSubscription): boolean {
  return sub.cycle_quota_usd == null || sub.cycle_quota_usd <= 0
}

function getProgressTone(sub: UserSubscription): 'success' | 'warning' | 'danger' | 'info' {
  if (isUnlimited(sub)) return 'success'
  const percentage = getMaxUsagePercentage(sub)
  if (percentage >= 90) return 'danger'
  if (percentage >= 70) return 'warning'
  return 'success'
}

function formatUsage(used: number | undefined, limit: number | null | undefined): string {
  const usedValue = (used || 0).toFixed(2)
  const limitValue = limit?.toFixed(2) || '∞'
  return `$${usedValue}/$${limitValue}`
}

function formatDaysRemaining(expiresAt: string): string {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diff = expires.getTime() - now.getTime()
  if (diff < 0) return t('subscriptionProgress.expired')
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return t('subscriptionProgress.expiresToday')
  if (days === 1) return t('subscriptionProgress.expiresTomorrow')
  return t('subscriptionProgress.daysRemaining', { days })
}

function getDaysRemainingStatus(expiresAt: string): 'active' | 'warning' | 'danger' {
  const diff = new Date(expiresAt).getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 3) return 'danger'
  if (days <= 7) return 'warning'
  return 'active'
}

function toggleTooltip() {
  tooltipOpen.value = !tooltipOpen.value
}

function closeTooltip() {
  tooltipOpen.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeTooltip()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // Trigger initial fetch if not already loaded
  // The actual data loading is handled by App.vue globally
  subscriptionStore.fetchActiveSubscriptions().catch((error) => {
    console.error('Failed to load subscriptions in SubscriptionProgressMini:', error)
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.subscription-progress { position:relative; min-width:0; }
.subscription-progress__trigger { display:flex; min-height:36px; align-items:center; gap:7px; padding:0 6px; border:0; border-radius:var(--ui-radius); color:var(--ui-text); background:transparent; font:inherit; cursor:pointer; }
.subscription-progress__trigger:hover { background:var(--ui-surface-muted); }
.subscription-progress__icon { color:var(--ui-text-muted); }
.subscription-progress__summary { display:grid; grid-template-columns:auto auto; align-items:center; column-gap:6px; line-height:16px; }
.subscription-progress__count { font-size:13px; font-weight:600; }
.subscription-progress__dots { display:flex; gap:3px; }
.subscription-progress__dots i { width:6px; height:6px; border-radius:50%; background:var(--ui-text-soft); }
.subscription-progress__dots i.is-success { background:var(--ui-success); }.subscription-progress__dots i.is-warning { background:var(--ui-warning); }.subscription-progress__dots i.is-danger { background:var(--ui-danger); }
.subscription-progress__label { grid-column:1 / -1; color:var(--ui-text-soft); font-size:10px; white-space:nowrap; }
.subscription-progress__popover { position:absolute; z-index:40; top:calc(100% + 6px); right:0; width:min(340px,calc(100vw - 16px)); overflow:hidden; border:1px solid var(--ui-border); border-radius:var(--ui-radius); background:var(--ui-surface); box-shadow:0 8px 24px rgb(31 35 41 / 10%); }
.subscription-progress__popover header,.subscription-progress__popover footer { padding:10px 12px; }.subscription-progress__popover header { border-bottom:1px solid var(--ui-border-soft); }.subscription-progress__popover h3,.subscription-progress__popover p { margin:0; }.subscription-progress__popover h3 { font-size:13px; }.subscription-progress__popover p { margin-top:2px; color:var(--ui-text-soft); font-size:11px; }
.subscription-progress__list { max-height:260px; overflow-y:auto; }
.subscription-progress__item { display:grid; gap:7px; padding:10px 12px; border-bottom:1px solid var(--ui-border-soft); }.subscription-progress__item-header { display:flex; align-items:center; justify-content:space-between; gap:8px; color:var(--ui-text); font-size:12px; font-weight:500; }.subscription-progress__usage { color:var(--ui-text-soft); font:10px/16px var(--ui-font-mono); font-variant-numeric:tabular-nums; text-align:right; }
.subscription-progress__popover footer { border-top:1px solid var(--ui-border-soft); }.subscription-progress__link { display:block; color:var(--ui-info); font-size:12px; text-align:center; text-decoration:none; }.subscription-progress__link:hover { text-decoration:underline; }
.dropdown-enter-active,.dropdown-leave-active { transition:opacity var(--ui-motion-fast),transform var(--ui-motion-fast); }.dropdown-enter-from,.dropdown-leave-to { opacity:0; transform:translateY(-3px); }
@media(prefers-reduced-motion:reduce){.dropdown-enter-active,.dropdown-leave-active{transition:none}}
</style>
