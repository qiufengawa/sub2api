<template>
  <div
    class="group flex h-full min-w-0 flex-col rounded-[4px] border border-gray-200 bg-white p-4 transition-colors hover:border-primary-300 dark:border-dark-700 dark:bg-dark-800 dark:hover:border-primary-700"
  >
    <div>
      <div
        :class="[
          'plan-card-platform-badge inline-flex w-fit max-w-full min-w-0 items-center gap-1.5 rounded-[3px] border px-2 py-1 text-xs font-medium',
          platformBadgeClass(platform),
        ]"
      >
        <PlatformIcon :platform="platform as GroupPlatform" size="sm" class="shrink-0" />
        <span class="truncate">{{ pLabel }}</span>
      </div>
      <h3
        :title="plan.name"
        class="mt-2 min-w-0 break-words [overflow-wrap:anywhere] text-lg font-bold leading-6 text-gray-900 dark:text-white"
      >
        {{ plan.name }}
      </h3>
      <p v-if="plan.description" class="mt-2 min-w-0 break-words text-sm leading-6 text-gray-500 dark:text-gray-400">
        {{ plan.description }}
      </p>
    </div>

    <dl class="mt-4 divide-y divide-gray-100 border-y border-gray-100 text-sm dark:divide-dark-700 dark:border-dark-700">
      <div class="flex min-w-0 items-start justify-between gap-3 py-3">
        <dt class="shrink-0 text-gray-400 dark:text-gray-500">{{ t('payment.planCard.price') }}</dt>
        <dd class="plan-card-price-line flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 gap-y-1 text-right">
          <span class="text-sm text-gray-400 dark:text-gray-500">{{ planCurrencySymbol }}</span>
          <span class="text-2xl font-bold tabular-nums text-primary-600 dark:text-primary-400">{{ plan.price }}</span>
          <span v-if="plan.currency" class="text-[11px] font-medium text-gray-400 dark:text-gray-500">{{ plan.currency }}</span>
          <span v-if="showDiscount" class="text-xs tabular-nums text-gray-400 line-through dark:text-gray-500">
            {{ planCurrencySymbol }}{{ plan.original_price }}
          </span>
          <span
            v-if="showDiscount"
            class="plan-card-discount-badge inline-flex rounded-[3px] bg-fuchsia-50 px-1.5 py-0.5 text-[11px] font-semibold text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:ring-fuchsia-500/30"
          >
            {{ discountText }}
          </span>
        </dd>
      </div>
      <div class="flex min-w-0 items-start justify-between gap-3 py-2.5">
        <dt class="shrink-0 text-gray-400 dark:text-gray-500">{{ t('payment.planCard.validity') }}</dt>
        <dd class="min-w-0 break-words text-right font-medium text-gray-800 dark:text-gray-200">{{ validitySuffix }}</dd>
      </div>
      <div v-if="includedGroups.length" class="py-2.5">
        <dt class="mb-2 text-gray-400 dark:text-gray-500">{{ t('payment.planCard.includedGroups') }}</dt>
        <dd class="space-y-1.5">
          <div v-for="group in includedGroups" :key="group.id" class="flex min-w-0 items-center gap-2 text-xs">
            <PlatformIcon :platform="group.platform as GroupPlatform" size="sm" class="shrink-0" />
            <span class="min-w-0 flex-1 truncate font-medium text-gray-700 dark:text-gray-300" :title="group.name">{{ group.name }}</span>
            <span class="shrink-0 tabular-nums text-gray-600 dark:text-gray-300">×{{ normalizedRate(group.rate_multiplier) }}</span>
            <span v-if="group.peak_rate_enabled" class="shrink-0 rounded-[3px] bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {{ t('payment.planCard.peakRateShort', { rate: normalizedRate(group.peak_rate_multiplier ?? 1) }) }}
            </span>
          </div>
        </dd>
      </div>
      <div v-if="plan.cycle_quota_usd != null" class="flex min-w-0 items-start justify-between gap-3 py-2.5">
        <dt class="shrink-0 text-gray-400 dark:text-gray-500">{{ t('payment.planCard.cycleQuota') }}</dt>
        <dd class="min-w-0 text-right font-medium text-gray-800 dark:text-gray-200">
          <p class="tabular-nums">${{ normalizedQuota }}</p>
          <p class="mt-0.5 text-[10px] font-normal text-gray-400 dark:text-gray-500">{{ resetIntervalLabel }}</p>
        </dd>
      </div>
      <div v-else class="flex min-w-0 items-start justify-between gap-3 py-2.5">
        <dt class="shrink-0 text-gray-400 dark:text-gray-500">{{ t('payment.planCard.quota') }}</dt>
        <dd class="min-w-0 break-words text-right font-medium text-gray-800 dark:text-gray-200">{{ t('payment.planCard.unlimited') }}</dd>
      </div>
      <div v-if="modelScopeLabels.length > 0" class="flex min-w-0 items-start justify-between gap-3 py-2.5">
        <dt class="shrink-0 text-gray-400 dark:text-gray-500">{{ t('payment.planCard.models') }}</dt>
        <dd class="flex min-w-0 flex-wrap justify-end gap-1">
          <span
            v-for="scope in modelScopeLabels"
            :key="scope.key"
            :class="[
              'plan-card-model-scope-badge rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium',
              scope.className,
            ]"
          >
            {{ scope.label }}
          </span>
        </dd>
      </div>
    </dl>

    <div v-if="plan.features.length > 0" class="my-3 space-y-1.5">
      <div v-for="feature in plan.features" :key="feature" class="flex items-start gap-2">
        <Icon name="check" size="sm" class="mt-0.5 shrink-0 text-primary-600 dark:text-primary-400" :stroke-width="2.5" />
        <span class="min-w-0 break-words text-xs leading-5 text-gray-600 dark:text-gray-300">{{ feature }}</span>
      </div>
    </div>

    <button
      type="button"
      class="mt-auto min-h-10 w-full rounded-[3px] bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
      @click="emit('select', plan)"
    >
      {{ isRenewal ? t('payment.renewNow') : t('payment.subscribeNow') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubscriptionPlan } from '@/types/payment'
import type { GroupPlatform, UserSubscription } from '@/types'
import { planValiditySuffix } from './validity'
import { currencySymbol } from '@/components/payment/currency'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import Icon from '@/components/icons/Icon.vue'
import { platformBadgeClass, platformLabel } from '@/utils/platformColors'

const props = defineProps<{ plan: SubscriptionPlan; activeSubscriptions?: UserSubscription[] }>()
const emit = defineEmits<{ select: [plan: SubscriptionPlan] }>()
const { t } = useI18n()

const includedGroups = computed(() => props.plan.included_groups ?? [])
const platform = computed(() => {
  const platforms = [...new Set(includedGroups.value.map(group => group.platform).filter(Boolean))]
  if (platforms.length === 1) return platforms[0]
  if (platforms.length > 1) return 'composite'
  return ''
})
const isRenewal = computed(() =>
  props.activeSubscriptions?.some(s => s.plan_id === props.plan.id && s.status === 'active') ?? false
)

const pLabel = computed(() => platformLabel(platform.value))

const discountText = computed(() => {
  const originalPrice = props.plan.original_price
  if (!originalPrice || originalPrice <= 0 || props.plan.price >= originalPrice) return ''
  return `-${Math.round((1 - props.plan.price / originalPrice) * 100)}%`
})
const showDiscount = computed(() => discountText.value !== '')

const planCurrencySymbol = computed(() => currencySymbol(props.plan.currency || 'USD'))

function normalizedRate(rate: number): number {
  return Number((rate ?? 1).toPrecision(10))
}

const normalizedQuota = computed(() => Number(props.plan.cycle_quota_usd || 0).toFixed(2))
const resetIntervalLabel = computed(() => {
  const seconds = Number(props.plan.reset_interval_seconds) || 0
  if (seconds <= 0) return t('payment.planCard.noReset')
  const days = Number((seconds / 86400).toFixed(2))
  return t('payment.planCard.resetEveryDays', { days })
})

const MODEL_SCOPE_BADGES: Record<string, { label: string; className: string }> = {
  claude: {
    label: 'Claude',
    className: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
  },
  gemini_text: {
    label: 'Gemini',
    className: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  },
  gemini_image: {
    label: 'Imagen',
    className: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
  },
}

const modelScopeLabels = computed(() => {
  if (platform.value !== 'antigravity') return []
  const scopes = [...new Set(
    includedGroups.value.flatMap(group => group.supported_model_scopes || [])
  )]
  if (!scopes || scopes.length === 0) return []
  return scopes.map(s => MODEL_SCOPE_BADGES[s] || {
    key: s,
    label: s,
    className: 'border-gray-200 bg-gray-50 text-gray-600 dark:border-dark-600 dark:bg-dark-700 dark:text-gray-300',
  }).map((badge, index) => ({
    ...badge,
    key: `${scopes[index]}:${index}`,
  }))
})

const validitySuffix = computed(() => planValiditySuffix(props.plan, t))
</script>
