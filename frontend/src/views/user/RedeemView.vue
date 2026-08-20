<template>
  <AppLayout>
    <AppPage density="compact">
      <AppPageHeader
        :title="t('redeem.title')"
        :description="t('redeem.description')"
      />

      <div class="redeem-layout">
        <section class="redeem-history" data-testid="redeem-history">
          <header class="redeem-section-header">
            <div>
              <h2>{{ t('redeem.recentActivity') }}</h2>
              <p>{{ t('redeem.description') }}</p>
            </div>
            <UiBadge v-if="history.length" :label="String(history.length)" tone="neutral" />
          </header>

          <UiLoadingOverlay
            :show="historyLoaded && loadingHistory"
            :label="t('common.loading')"
          >
            <div v-if="historyLoadError && history.length" class="redeem-history-refresh-error">
              <UiAlert
                tone="danger"
                :message="t('redeem.historyLoadFailed')"
              />
              <UiButton
                variant="quiet"
                density="dense"
                data-testid="redeem-history-retry"
                @click="fetchHistory"
              >
                {{ t('common.retry') }}
              </UiButton>
            </div>

            <div v-if="!historyLoaded" class="redeem-history-skeleton" role="status">
              <span class="sr-only">{{ t('common.loading') }}</span>
              <div v-for="index in 4" :key="index" class="redeem-history-skeleton__row">
                <UiSkeleton variant="circle" width="28px" height="28px" />
                <UiSkeleton variant="text" width="58%" height="14px" />
                <UiSkeleton variant="text" width="84px" height="14px" />
              </div>
            </div>

            <div v-else-if="history.length" class="redeem-history-list">
              <article v-for="item in history" :key="item.id" class="redeem-history-row">
                <div class="redeem-history-row__main">
                  <span class="redeem-history-row__icon" :class="historyIconClass(item)" aria-hidden="true">
                    <Icon :name="historyIconName(item)" size="sm" :stroke-width="1.8" />
                  </span>
                  <div class="redeem-history-row__title">
                    <strong :title="getHistoryItemTitle(item)">{{ getHistoryItemTitle(item) }}</strong>
                    <span>{{ formatDateTime(item.used_at) }}</span>
                  </div>
                </div>

                <div class="redeem-history-row__meta">
                  <code v-if="!isAdminAdjustment(item.type)" :title="item.code">{{ item.code }}</code>
                  <span v-else>{{ t('redeem.adminAdjustment') }}</span>
                  <small v-if="item.notes" :title="item.notes">{{ item.notes }}</small>
                </div>

                <strong class="redeem-history-row__value" :class="historyValueClass(item)">
                  {{ formatHistoryValue(item) }}
                </strong>
              </article>
            </div>

            <UiErrorState
              v-else-if="historyLoadError"
              :title="t('redeem.historyLoadFailed')"
              :description="t('redeem.historyLoadFailedDescription')"
              :retry-text="t('common.retry')"
              @retry="fetchHistory"
            />

            <UiEmptyState
              v-else
              icon="clock"
              :title="t('redeem.historyWillAppear')"
            />
          </UiLoadingOverlay>
        </section>

        <aside class="redeem-sidebar" data-testid="redeem-actions">
          <section class="redeem-balance">
            <div>
              <span>{{ t('redeem.currentBalance') }}</span>
              <strong>${{ user?.balance?.toFixed(2) || '0.00' }}</strong>
            </div>
            <span class="redeem-balance__icon" aria-hidden="true"><Icon name="creditCard" size="sm" /></span>
            <dl>
              <dt>{{ t('redeem.concurrency') }}</dt>
              <dd>{{ user?.concurrency || 0 }} {{ t('redeem.requests') }}</dd>
            </dl>
          </section>

          <section class="redeem-form-section">
            <header class="redeem-section-header">
              <div>
                <h2>{{ t('redeem.redeemCodeLabel') }}</h2>
                <p>{{ t('redeem.redeemCodeHint') }}</p>
              </div>
            </header>

            <form class="redeem-form" @submit.prevent="handleRedeem">
              <UiTextField
                id="code"
                v-model="redeemCode"
                :label="t('redeem.redeemCodeLabel')"
                :placeholder="t('redeem.redeemCodePlaceholder')"
                type="text"
                autocomplete="off"
                required
                monospace
                density="compact"
                :disabled="submitting"
              >
                <template #prefix><Icon name="gift" size="sm" /></template>
              </UiTextField>
              <UiButton
                type="submit"
                variant="primary"
                density="compact"
                block
                :disabled="!redeemCode.trim() || submitting"
                :loading="submitting"
              >
                <template v-if="!submitting" #icon><Icon name="checkCircle" size="sm" /></template>
                {{ submitting ? t('redeem.redeeming') : t('redeem.redeemButton') }}
              </UiButton>

              <div v-if="redeemResult" class="redeem-result redeem-result--success" role="status">
                <Icon name="checkCircle" size="sm" aria-hidden="true" />
                <div>
                  <strong>{{ t('redeem.redeemSuccess') }}</strong>
                  <p>{{ redeemResult.message }}</p>
                  <p v-if="redeemResult.type === 'balance'">{{ t('redeem.added') }}: ${{ redeemResult.value.toFixed(2) }}</p>
                  <p v-else-if="redeemResult.type === 'concurrency'">{{ t('redeem.added') }}: {{ redeemResult.value }} {{ t('redeem.concurrentRequests') }}</p>
                  <p v-else-if="redeemResult.type === 'subscription'">
                    {{ t('redeem.subscriptionAssigned') }}<span v-if="redeemResult.plan_name"> · {{ redeemResult.plan_name }}</span><span v-if="redeemResult.validity_days"> · {{ t('redeem.subscriptionDays', { days: redeemResult.validity_days }) }}</span>
                  </p>
                  <p v-if="redeemResult.new_balance !== undefined">{{ t('redeem.newBalance') }}: ${{ redeemResult.new_balance.toFixed(2) }}</p>
                  <p v-if="redeemResult.new_concurrency !== undefined">{{ t('redeem.newConcurrency') }}: {{ redeemResult.new_concurrency }} {{ t('redeem.requests') }}</p>
                </div>
              </div>

              <div v-if="errorMessage" class="redeem-result redeem-result--error" role="alert">
                <Icon name="exclamationCircle" size="sm" aria-hidden="true" />
                <div>
                  <strong>{{ t('redeem.redeemFailed') }}</strong>
                  <p>{{ errorMessage }}</p>
                </div>
              </div>
            </form>
          </section>

          <section class="redeem-help" data-testid="redeem-help">
            <div class="redeem-help__icon" aria-hidden="true"><Icon name="infoCircle" size="sm" /></div>
            <div>
              <h2>{{ t('redeem.aboutCodes') }}</h2>
              <ul>
                <li>{{ t('redeem.codeRule1') }}</li>
                <li>{{ t('redeem.codeRule2') }}</li>
                <li>
                  {{ t('redeem.codeRule3') }}
                  <span v-if="contactInfo" class="redeem-help__contact">{{ contactInfo }}</span>
                </li>
                <li>{{ t('redeem.codeRule4') }}</li>
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useSubscriptionStore } from '@/stores/subscriptions'
import { redeemAPI, authAPI, type RedeemHistoryItem } from '@/api'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppPage,
  AppPageHeader,
  UiBadge,
  UiAlert,
  UiButton,
  UiEmptyState,
  UiErrorState,
  UiLoadingOverlay,
  UiSkeleton,
  UiTextField
} from '@/components/ui'
import { formatDateTime } from '@/utils/format'

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()
const subscriptionStore = useSubscriptionStore()

const user = computed(() => authStore.user)

const redeemCode = ref('')
const submitting = ref(false)
const redeemResult = ref<{
  message: string
  type: string
  value: number
  new_balance?: number
  new_concurrency?: number
  plan_id?: number
  plan_name?: string
  validity_days?: number
} | null>(null)
const errorMessage = ref('')

// History data
const history = ref<RedeemHistoryItem[]>([])
const loadingHistory = ref(false)
const historyLoaded = ref(false)
const historyLoadError = ref(false)
const contactInfo = ref('')

// Helper functions for history display
const isBalanceType = (type: string) => {
  return type === 'balance' || type === 'admin_balance'
}

const isSubscriptionType = (type: string) => {
  return type === 'subscription'
}

const isAdminAdjustment = (type: string) => {
  return type === 'admin_balance' || type === 'admin_concurrency'
}

const historyIconName = (item: RedeemHistoryItem): 'dollar' | 'badge' | 'bolt' => {
  if (isBalanceType(item.type)) return 'dollar'
  if (isSubscriptionType(item.type)) return 'badge'
  return 'bolt'
}

const historyIconClass = (item: RedeemHistoryItem) => {
  if (isBalanceType(item.type) && item.value < 0) {
    return 'is-negative'
  }
  if (isBalanceType(item.type)) {
    return 'is-positive'
  }
  return 'is-subscription'
}

const historyValueClass = (item: RedeemHistoryItem) => {
  if (isBalanceType(item.type) && item.value < 0) return 'is-negative'
  if (isBalanceType(item.type)) return 'is-positive'
  return 'is-subscription'
}

const getHistoryItemTitle = (item: RedeemHistoryItem) => {
  if (item.type === 'balance') {
    return t('redeem.balanceAddedRedeem')
  } else if (item.type === 'admin_balance') {
    return item.value >= 0 ? t('redeem.balanceAddedAdmin') : t('redeem.balanceDeductedAdmin')
  } else if (item.type === 'concurrency') {
    return t('redeem.concurrencyAddedRedeem')
  } else if (item.type === 'admin_concurrency') {
    return item.value >= 0 ? t('redeem.concurrencyAddedAdmin') : t('redeem.concurrencyReducedAdmin')
  } else if (item.type === 'subscription') {
    return t('redeem.subscriptionAssigned')
  }
  return t('common.unknown')
}

const formatHistoryValue = (item: RedeemHistoryItem) => {
  if (isBalanceType(item.type)) {
    const sign = item.value >= 0 ? '+' : ''
    return `${sign}$${item.value.toFixed(2)}`
  } else if (isSubscriptionType(item.type)) {
    // Subscription history is plan-based; routing groups remain plan metadata.
    const days = item.validity_days || Math.round(item.value)
    const planName = item.plan_name?.trim() || (item.plan_id ? `#${item.plan_id}` : '')
    return planName ? `${days}${t('redeem.days')} - ${planName}` : `${days}${t('redeem.days')}`
  } else {
    const sign = item.value >= 0 ? '+' : ''
    return `${sign}${item.value} ${t('redeem.requests')}`
  }
}

let historyLoadPromise: Promise<void> | null = null
let historyRefreshPending = false

const fetchHistory = async () => {
  if (historyLoadPromise) {
    historyRefreshPending = true
    await historyLoadPromise
    if (historyLoadPromise) await historyLoadPromise
    return
  }

  do {
    historyRefreshPending = false
    loadingHistory.value = true
    historyLoadError.value = false
    historyLoadPromise = (async () => {
      try {
        history.value = await redeemAPI.getHistory()
      } catch {
        historyLoadError.value = true
      } finally {
        loadingHistory.value = false
        historyLoaded.value = true
      }
    })()

    try {
      await historyLoadPromise
    } finally {
      historyLoadPromise = null
    }
  } while (historyRefreshPending)
}

const handleRedeem = async () => {
  if (submitting.value) return
  if (!redeemCode.value.trim()) {
    appStore.showError(t('redeem.pleaseEnterCode'))
    return
  }

  submitting.value = true
  errorMessage.value = ''
  redeemResult.value = null

  try {
    const result = await redeemAPI.redeem(redeemCode.value.trim())

    redeemResult.value = result

    // Refresh user data to get updated balance/concurrency
    await authStore.refreshUser()

    // If subscription type, immediately refresh subscription status
    if (result.type === 'subscription') {
      try {
        await subscriptionStore.fetchActiveSubscriptions(true) // force refresh
      } catch (error) {
        console.error('Failed to refresh subscriptions after redeem:', error)
        appStore.showWarning(t('redeem.subscriptionRefreshFailed'))
      }
    }

    // Clear the input
    redeemCode.value = ''

    // Refresh history
    await fetchHistory()

    // Show success toast
    appStore.showSuccess(t('redeem.codeRedeemSuccess'))
  } catch (error: any) {
    errorMessage.value = error.response?.data?.detail || t('redeem.failedToRedeem')

    appStore.showError(t('redeem.redeemFailed'))
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  fetchHistory()
  try {
    const settings = await authAPI.getPublicSettings()
    contactInfo.value = settings.contact_info || ''
  } catch (error) {
    console.error('Failed to load contact info:', error)
  }
})
</script>

<style scoped>
.redeem-layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, .85fr); gap: 16px; padding-top: 16px; }
.redeem-history, .redeem-sidebar { min-width: 0; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-panel); background: var(--ui-surface); }
.redeem-sidebar { display: grid; align-content: start; overflow: hidden; }
.redeem-section-header { display: flex; min-height: 52px; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid var(--ui-border-soft); }
.redeem-section-header h2, .redeem-section-header p { margin: 0; }
.redeem-section-header h2 { color: var(--ui-text); font-size: 14px; font-weight: 600; line-height: 22px; }
.redeem-section-header p { margin-top: 2px; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.redeem-history-skeleton { display: grid; min-height: 224px; align-content: start; }
.redeem-history-skeleton__row { display: grid; grid-template-columns: 28px minmax(0, 1fr) 84px; align-items: center; gap: 12px; min-height: 56px; padding: 10px 16px; border-bottom: 1px solid var(--ui-border-soft); }
.redeem-history-refresh-error { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--ui-border-soft); }
.redeem-history-list { display: grid; }
.redeem-history-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(120px, .7fr) auto; align-items: center; gap: 16px; min-width: 0; padding: 12px 16px; border-bottom: 1px solid var(--ui-border-soft); }
.redeem-history-row:last-child { border-bottom: 0; }
.redeem-history-row__main { display: flex; min-width: 0; align-items: center; gap: 10px; }
.redeem-history-row__icon, .redeem-balance__icon, .redeem-help__icon { display: grid; flex: 0 0 auto; place-items: center; border: 1px solid var(--ui-border-soft); border-radius: var(--ui-radius-sm); }
.redeem-history-row__icon { width: 28px; height: 28px; }
.redeem-history-row__icon.is-negative, .redeem-help__icon { color: var(--ui-danger); background: var(--ui-danger-soft); }
.redeem-history-row__icon.is-positive { color: var(--ui-success); background: var(--ui-success-soft); }
.redeem-history-row__icon.is-subscription { color: var(--ui-info); background: var(--ui-info-soft); }
.redeem-history-row__title, .redeem-history-row__meta { display: grid; min-width: 0; gap: 2px; }
.redeem-history-row__title strong { overflow: hidden; color: var(--ui-text); font-size: 13px; font-weight: 600; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
.redeem-history-row__title span, .redeem-history-row__meta span, .redeem-history-row__meta small { overflow: hidden; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.redeem-history-row__meta code { overflow: hidden; color: var(--ui-text-muted); font-family: var(--ui-font-mono); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.redeem-history-row__meta small { color: var(--ui-text-soft); }
.redeem-history-row__value { font-size: 13px; font-weight: 600; line-height: 20px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.redeem-history-row__value.is-negative { color: var(--ui-danger); }
.redeem-history-row__value.is-positive { color: var(--ui-success); }
.redeem-history-row__value.is-subscription { color: var(--ui-info); }
.redeem-balance { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 16px; border-bottom: 1px solid var(--ui-border-soft); }
.redeem-balance > div { display: grid; gap: 3px; }
.redeem-balance span, .redeem-balance dt { color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.redeem-balance strong { color: var(--ui-text-strong); font-size: 24px; font-weight: 600; line-height: 30px; font-variant-numeric: tabular-nums; }
.redeem-balance__icon { width: 30px; height: 30px; color: var(--ui-info); background: var(--ui-info-soft); }
.redeem-balance dl { display: flex; grid-column: 1 / -1; align-items: center; justify-content: space-between; gap: 12px; margin: 0; padding-top: 10px; border-top: 1px solid var(--ui-border-soft); }
.redeem-balance dd { margin: 0; color: var(--ui-text); font-size: 12px; font-weight: 600; line-height: 18px; font-variant-numeric: tabular-nums; }
.redeem-form-section { display: grid; }
.redeem-form { display: grid; gap: 12px; padding: 16px; }
.redeem-result { display: grid; grid-template-columns: 16px minmax(0, 1fr); gap: 9px; padding: 10px 12px; border: 1px solid; border-radius: var(--ui-radius); font-size: 12px; line-height: 18px; }
.redeem-result--success { border-color: color-mix(in srgb, var(--ui-success) 25%, var(--ui-border)); color: var(--ui-success); background: var(--ui-success-soft); }
.redeem-result--error { border-color: color-mix(in srgb, var(--ui-danger) 25%, var(--ui-border)); color: var(--ui-danger); background: var(--ui-danger-soft); }
.redeem-result strong, .redeem-result p { margin: 0; }
.redeem-result strong { display: block; font-weight: 600; }
.redeem-result p { margin-top: 2px; color: var(--ui-text-muted); }
.redeem-help { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; padding: 16px; border-top: 1px solid var(--ui-border-soft); }
.redeem-help__icon { width: 28px; height: 28px; color: var(--ui-info); background: var(--ui-info-soft); }
.redeem-help h2, .redeem-help ul { margin: 0; }
.redeem-help h2 { color: var(--ui-text); font-size: 13px; font-weight: 600; line-height: 20px; }
.redeem-help ul { display: grid; gap: 5px; margin-top: 8px; padding-left: 16px; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.redeem-help__contact { margin-left: 4px; color: var(--ui-link); font-family: var(--ui-font-mono); }
@media (max-width: 900px) { .redeem-layout { grid-template-columns: minmax(0, 1fr); } .redeem-sidebar { order: -1; } }
@media (max-width: 640px) { .redeem-layout { gap: 12px; } .redeem-history-row { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; padding: 12px; } .redeem-history-row__meta { grid-column: 1 / -1; padding-left: 38px; } .redeem-history-row__value { grid-column: 2; grid-row: 1; } .redeem-section-header, .redeem-form, .redeem-balance, .redeem-help { padding-inline: 12px; } }
@media (prefers-reduced-motion: reduce) { .redeem-result { transition: none; } }
</style>
