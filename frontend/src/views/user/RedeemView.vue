<template>
  <AppLayout>
    <div class="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
      <section class="card order-2 overflow-hidden md:order-1 md:col-span-8 md:row-span-2" data-testid="redeem-history">
        <div class="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700">
          <div>
            <h2 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('redeem.recentActivity') }}</h2>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">{{ t('redeem.description') }}</p>
          </div>
          <span v-if="history.length" class="badge badge-gray tabular-nums">{{ history.length }}</span>
        </div>

        <div v-if="loadingHistory" class="flex min-h-56 items-center justify-center">
          <Icon name="refresh" size="md" class="animate-spin text-primary-500" />
        </div>

        <div v-else-if="history.length" class="divide-y divide-gray-100 dark:divide-dark-700">
          <article
            v-for="item in history"
            :key="item.id"
            class="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(120px,0.6fr)_auto] sm:items-center sm:gap-4"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px]"
                :class="historyIconClass(item)"
              >
                <Icon :name="historyIconName(item)" size="sm" :stroke-width="1.8" />
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="getHistoryItemTitle(item)">
                  {{ getHistoryItemTitle(item) }}
                </p>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">{{ formatDateTime(item.used_at) }}</p>
              </div>
            </div>

            <div class="min-w-0 pl-10 sm:pl-0">
              <p v-if="!isAdminAdjustment(item.type)" class="truncate font-mono text-xs text-gray-500 dark:text-dark-400" :title="item.code">
                {{ item.code }}
              </p>
              <p v-else class="text-xs text-gray-500 dark:text-dark-400">{{ t('redeem.adminAdjustment') }}</p>
              <p v-if="item.notes" class="mt-0.5 truncate text-xs text-gray-400 dark:text-dark-500" :title="item.notes">
                {{ item.notes }}
              </p>
            </div>

            <p class="pl-10 text-sm font-semibold tabular-nums sm:pl-0 sm:text-right" :class="historyValueClass(item)">
              {{ formatHistoryValue(item) }}
            </p>
          </article>
        </div>

        <div v-else class="flex min-h-56 flex-col items-center justify-center px-4 py-8 text-center">
          <div class="flex h-9 w-9 items-center justify-center rounded-[3px] bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
            <Icon name="clock" size="md" />
          </div>
          <p class="mt-3 text-sm text-gray-500 dark:text-dark-400">{{ t('redeem.historyWillAppear') }}</p>
        </div>
      </section>

      <aside class="card order-1 overflow-hidden md:order-2 md:col-span-4" data-testid="redeem-actions">
        <section class="border-b border-gray-100 p-4 dark:border-dark-700">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-medium text-gray-500 dark:text-dark-400">{{ t('redeem.currentBalance') }}</p>
              <p class="mt-1 text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">
                ${{ user?.balance?.toFixed(2) || '0.00' }}
              </p>
            </div>
            <div class="flex h-8 w-8 items-center justify-center rounded-[3px] bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
              <Icon name="creditCard" size="sm" />
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs dark:border-dark-700">
            <span class="text-gray-500 dark:text-dark-400">{{ t('redeem.concurrency') }}</span>
            <span class="font-medium tabular-nums text-gray-900 dark:text-white">
              {{ user?.concurrency || 0 }} {{ t('redeem.requests') }}
            </span>
          </div>
        </section>

        <section>
          <div class="border-b border-gray-100 px-4 py-3 dark:border-dark-700">
            <h2 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('redeem.title') }}</h2>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">{{ t('redeem.redeemCodeHint') }}</p>
          </div>
          <form class="space-y-3 p-4" @submit.prevent="handleRedeem">
            <label for="code" class="sr-only">{{ t('redeem.redeemCodeLabel') }}</label>
            <div class="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <div class="relative min-w-0 flex-1">
                <Icon name="gift" size="sm" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-500" />
                <input
                  id="code"
                  v-model="redeemCode"
                  type="text"
                  required
                  autocomplete="off"
                  :placeholder="t('redeem.redeemCodePlaceholder')"
                  :disabled="submitting"
                  class="input pl-9 font-mono"
                />
              </div>
              <button type="submit" :disabled="!redeemCode.trim() || submitting" class="btn btn-primary shrink-0">
                <Icon :name="submitting ? 'refresh' : 'checkCircle'" size="sm" :class="submitting ? 'animate-spin' : ''" />
                {{ submitting ? t('redeem.redeeming') : t('redeem.redeemButton') }}
              </button>
            </div>

            <transition name="fade">
              <div v-if="redeemResult" class="flex items-start gap-2 rounded-[3px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-200">
                <Icon name="checkCircle" size="sm" class="mt-0.5 shrink-0" />
                <div class="min-w-0">
                  <p class="font-semibold">{{ t('redeem.redeemSuccess') }}</p>
                  <p class="mt-0.5">{{ redeemResult.message }}</p>
                  <p v-if="redeemResult.type === 'balance'" class="mt-1 font-medium">{{ t('redeem.added') }}: ${{ redeemResult.value.toFixed(2) }}</p>
                  <p v-else-if="redeemResult.type === 'concurrency'" class="mt-1 font-medium">{{ t('redeem.added') }}: {{ redeemResult.value }} {{ t('redeem.concurrentRequests') }}</p>
                  <p v-else-if="redeemResult.type === 'subscription'" class="mt-1 font-medium">
                    {{ t('redeem.subscriptionAssigned') }}<span v-if="redeemResult.group_name"> · {{ redeemResult.group_name }}</span><span v-if="redeemResult.validity_days"> · {{ t('redeem.subscriptionDays', { days: redeemResult.validity_days }) }}</span>
                  </p>
                  <p v-if="redeemResult.new_balance !== undefined" class="mt-0.5">{{ t('redeem.newBalance') }}: ${{ redeemResult.new_balance.toFixed(2) }}</p>
                  <p v-if="redeemResult.new_concurrency !== undefined" class="mt-0.5">{{ t('redeem.newConcurrency') }}: {{ redeemResult.new_concurrency }} {{ t('redeem.requests') }}</p>
                </div>
              </div>
            </transition>

            <transition name="fade">
              <div v-if="errorMessage" class="flex items-start gap-2 rounded-[3px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-200">
                <Icon name="exclamationCircle" size="sm" class="mt-0.5 shrink-0" />
                <div>
                  <p class="font-semibold">{{ t('redeem.redeemFailed') }}</p>
                  <p class="mt-0.5">{{ errorMessage }}</p>
                </div>
              </div>
            </transition>
          </form>
        </section>

        <section class="border-t border-gray-100 p-4 dark:border-dark-700" data-testid="redeem-help">
          <div class="flex items-start gap-3">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
              <Icon name="infoCircle" size="sm" />
            </div>
            <div class="min-w-0 flex-1">
              <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('redeem.aboutCodes') }}</h2>
              <ul class="mt-2 space-y-1.5 text-xs leading-5 text-gray-500 dark:text-dark-400">
                <li>{{ t('redeem.codeRule1') }}</li>
                <li>{{ t('redeem.codeRule2') }}</li>
                <li>
                  {{ t('redeem.codeRule3') }}
                  <span v-if="contactInfo" class="ml-1 font-medium text-primary-600 dark:text-primary-400">{{ contactInfo }}</span>
                </li>
                <li>{{ t('redeem.codeRule4') }}</li>
              </ul>
            </div>
          </div>
        </section>
      </aside>
    </div>
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
  group_name?: string
  validity_days?: number
} | null>(null)
const errorMessage = ref('')

// History data
const history = ref<RedeemHistoryItem[]>([])
const loadingHistory = ref(false)
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
    return 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400'
  }
  if (isBalanceType(item.type)) {
    return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400'
  }
  return 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300'
}

const historyValueClass = (item: RedeemHistoryItem) => {
  if (isBalanceType(item.type) && item.value < 0) return 'text-red-600 dark:text-red-400'
  if (isBalanceType(item.type)) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-primary-600 dark:text-primary-400'
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
    // 订阅类型显示有效天数和分组名称
    const days = item.validity_days || Math.round(item.value)
    const groupName = item.group?.name || ''
    return groupName ? `${days}${t('redeem.days')} - ${groupName}` : `${days}${t('redeem.days')}`
  } else {
    const sign = item.value >= 0 ? '+' : ''
    return `${sign}${item.value} ${t('redeem.requests')}`
  }
}

const fetchHistory = async () => {
  loadingHistory.value = true
  try {
    history.value = await redeemAPI.getHistory()
  } catch (error) {
    console.error('Failed to fetch history:', error)
  } finally {
    loadingHistory.value = false
  }
}

const handleRedeem = async () => {
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
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
