<template>
  <section class="card flex h-full min-h-[360px] flex-col xl:h-[470px] xl:min-h-[470px]" data-testid="dashboard-quota-card">
    <div class="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-dark-700">
      <div>
        <h2 class="text-sm font-semibold text-gray-950 dark:text-white">{{ t('dashboard.overview.allowanceStatus') }}</h2>
        <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.allowanceStatusDescription') }}</p>
      </div>
      <router-link v-if="!isSimple" to="/subscriptions" class="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
        {{ t('dashboard.overview.manage') }}
      </router-link>
    </div>

    <div class="min-h-[268px] flex-1 p-4">
      <div v-if="!isSimple" class="mb-3 flex items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-dark-700">
        <div>
          <p class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('dashboard.overview.accountBalance') }}</p>
          <p v-if="frozenBalance > 0" class="mt-0.5 text-[11px] text-gray-400 dark:text-dark-500">
            {{ t('dashboard.overview.frozenBalance', { amount: formatMoney(frozenBalance) }) }}
          </p>
        </div>
        <span class="font-mono text-sm font-semibold" :class="balance <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'">
          {{ formatMoney(balance) }}
        </span>
      </div>

      <div v-if="rows.length === 0" class="flex min-h-[174px] flex-col items-center justify-center text-center">
        <div class="flex h-9 w-9 items-center justify-center rounded-[3px] bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <Icon name="badge" size="md" />
        </div>
        <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('dashboard.overview.noAllowanceTitle') }}</p>
        <p class="mt-1 max-w-xs text-xs leading-5 text-gray-500 dark:text-dark-400">{{ t('dashboard.overview.noAllowanceDescription') }}</p>
      </div>
      <div v-else class="space-y-2.5">
        <div
          v-for="(row, index) in rows"
          :key="row.key"
          class="rounded-[3px] px-2 py-1.5"
          :class="index === 0 ? highlightClass(row.percent) : ''"
        >
          <div class="mb-1.5 flex items-center justify-between gap-3 text-xs">
            <div class="min-w-0">
              <p class="truncate font-medium text-gray-800 dark:text-gray-200" :title="row.label">{{ row.label }}</p>
              <p v-if="row.hint" class="mt-0.5 truncate text-[11px] text-gray-400 dark:text-dark-500">{{ row.hint }}</p>
            </div>
            <div class="shrink-0 text-right">
              <span class="font-mono" :class="row.limit === 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-dark-300'">
                {{ row.limit === 0 ? t('dashboard.overview.disabled') : `${formatMoney(row.used)} / ${formatMoney(row.limit)}` }}
              </span>
              <span class="ml-1.5 text-[11px]" :class="percentClass(row.percent)">{{ row.percent }}%</span>
            </div>
          </div>
          <div class="h-1.5 overflow-hidden rounded-[2px] bg-gray-100 dark:bg-dark-700">
            <div class="h-full rounded-[2px] transition-all" :class="barClass(row.percent)" :style="{ width: `${Math.max(row.limit === 0 ? 100 : 2, row.percent)}%` }" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { SubscriptionSummary } from '@/api/subscriptions'
import type { PlatformQuotaItem } from '@/types'

const props = withDefaults(defineProps<{
  subscriptionSummary?: SubscriptionSummary | null
  platformQuotas?: PlatformQuotaItem[] | null
  balance?: number
  frozenBalance?: number
  isSimple?: boolean
}>(), {
  subscriptionSummary: null,
  platformQuotas: null,
  balance: 0,
  frozenBalance: 0,
  isSimple: false,
})

const { t } = useI18n()

interface QuotaRow {
  key: string
  label: string
  hint: string
  used: number
  limit: number
  percent: number
}

const platformLabels: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  antigravity: 'Antigravity',
  grok: 'Grok',
}

const rows = computed<QuotaRow[]>(() => {
  const result: QuotaRow[] = []
  const windowLabels = { daily: t('dashboard.overview.daily'), weekly: t('dashboard.overview.weekly'), monthly: t('dashboard.overview.monthly') }

  for (const subscription of props.subscriptionSummary?.subscriptions ?? []) {
    const windows = [
      ['daily', subscription.daily_used_usd, subscription.daily_limit_usd],
      ['weekly', subscription.weekly_used_usd, subscription.weekly_limit_usd],
      ['monthly', subscription.monthly_used_usd, subscription.monthly_limit_usd],
    ] as const
    for (const [window, used, limit] of windows) {
      if (typeof limit === 'number' && limit >= 0) {
        result.push(makeRow(`subscription-${subscription.id}-${window}`, `${subscription.group_name} · ${windowLabels[window]}`, subscription.expires_at ? t('dashboard.overview.expiresAt', { date: formatDate(subscription.expires_at) }) : '', used ?? 0, limit))
      }
    }
  }

  for (const quota of props.platformQuotas ?? []) {
    const windows = [
      ['daily', quota.daily_usage_usd, quota.daily_limit_usd, quota.daily_window_resets_at],
      ['weekly', quota.weekly_usage_usd, quota.weekly_limit_usd, quota.weekly_window_resets_at],
      ['monthly', quota.monthly_usage_usd, quota.monthly_limit_usd, quota.monthly_window_resets_at],
    ] as const
    for (const [window, used, limit, resetsAt] of windows) {
      if (typeof limit === 'number' && limit >= 0) {
        result.push(makeRow(`platform-${quota.platform}-${window}`, `${platformLabels[quota.platform] ?? quota.platform} · ${windowLabels[window]}`, resetsAt ? t('dashboard.overview.resetsAt', { date: formatDateTime(resetsAt) }) : '', used, limit))
      }
    }
  }

  return result.sort((a, b) => b.percent - a.percent).slice(0, 5)
})

function makeRow(key: string, label: string, hint: string, used: number, limit: number): QuotaRow {
  return {
    key,
    label,
    hint,
    used,
    limit,
    percent: limit <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((used / limit) * 100))),
  }
}

const barClass = (percent: number) => {
  if (percent >= 95) return 'bg-red-500'
  if (percent >= 80) return 'bg-amber-500'
  return 'bg-primary-500'
}
const percentClass = (percent: number) => percent >= 95
  ? 'text-red-600 dark:text-red-400'
  : percent >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-primary-600 dark:text-primary-400'
const highlightClass = (percent: number) => percent >= 95
  ? 'bg-red-50 dark:bg-red-900/15'
  : percent >= 80 ? 'bg-amber-50 dark:bg-amber-900/15' : 'bg-primary-50/70 dark:bg-primary-900/15'
const formatMoney = (value: number) => `$${value.toFixed(2)}`
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const formatDateTime = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
</script>
