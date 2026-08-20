<template>
  <article class="subscription-plan">
    <header class="subscription-plan__header">
      <UiBadge class="plan-card-platform-badge">
        <PlatformIcon :platform="platform as GroupPlatform" size="sm" />
        <span>{{ pLabel }}</span>
      </UiBadge>
      <h3 class="subscription-plan__title" :title="plan.name">{{ plan.name }}</h3>
      <p v-if="plan.description">{{ plan.description }}</p>
    </header>

    <div class="subscription-plan__price plan-card-price-line">
      <span>{{ planCurrencySymbol }}</span>
      <strong>{{ plan.price }}</strong>
      <small v-if="plan.currency">{{ plan.currency }}</small>
      <del v-if="showDiscount">{{ planCurrencySymbol }}{{ plan.original_price }}</del>
      <UiBadge v-if="showDiscount" tone="info" class="plan-card-discount-badge">{{ discountText }}</UiBadge>
    </div>

    <UiDescriptionList
      :columns="1"
      :items="[
        { label: t('payment.planCard.validity'), value: validitySuffix },
        { label: t('payment.planCard.owned'), value: `${ownedCount} / ${maxCount}`, numeric: true },
        ...(Number(plan.five_hour_quota_usd) > 0 ? [{ label: t('payment.planCard.fiveHourQuota'), value: `$${normalizedFiveHourQuota}`, numeric: true }] : []),
        ...(Number(plan.cycle_quota_usd) > 0 ? [{ label: t('payment.planCard.cycleQuota'), value: `$${normalizedQuota} · ${resetIntervalLabel}`, numeric: true }] : []),
        ...(Number(plan.total_quota_usd) > 0 ? [{ label: t('payment.planCard.totalQuota'), value: `$${normalizedTotalQuota}`, numeric: true }] : []),
        ...(!hasAnyQuota ? [{ label: t('payment.planCard.quota'), value: t('payment.planCard.unlimited') }] : []),
      ]"
    />

    <section v-if="includedGroups.length" class="subscription-plan__section">
      <h4>{{ t('payment.planCard.includedGroups') }}</h4>
      <div class="subscription-plan__groups">
        <div v-for="group in includedGroups" :key="group.id">
          <PlatformIcon :platform="group.platform as GroupPlatform" size="sm" />
          <span :title="group.name">{{ group.name }}</span>
          <code>×{{ normalizedRate(group.rate_multiplier) }}</code>
          <UiBadge v-if="group.peak_rate_enabled" tone="warning">
            {{ t('payment.planCard.peakRateShort', { rate: normalizedRate(group.peak_rate_multiplier ?? 1) }) }}
          </UiBadge>
        </div>
      </div>
    </section>

    <section v-if="modelScopeLabels.length > 0" class="subscription-plan__section">
      <h4>{{ t('payment.planCard.models') }}</h4>
      <div class="subscription-plan__badges">
        <UiBadge v-for="scope in modelScopeLabels" :key="scope.key" class="plan-card-model-scope-badge">
          {{ scope.label }}
        </UiBadge>
      </div>
    </section>

    <ul v-if="plan.features.length > 0" class="subscription-plan__features">
      <li v-for="feature in plan.features" :key="feature">
        <Icon name="check" size="sm" />
        <span>{{ feature }}</span>
      </li>
    </ul>

    <UiButton
      variant="primary"
      density="compact"
      block
      class="subscription-plan__action"
      :disabled="atLimit && maxCount > 1"
      @click="emit('select', plan)"
    >
      {{ buttonLabel }}
    </UiButton>
  </article>
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
import { platformLabel } from '@/utils/platformColors'
import { UiBadge, UiButton, UiDescriptionList } from '@/components/ui'

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
  props.activeSubscriptions?.some(s =>
    s.plan_id === props.plan.id &&
    (s.status === 'active' || s.status === 'suspended') &&
    (!s.expires_at || new Date(s.expires_at).getTime() > Date.now())
  ) ?? false
)
const ownedCount = computed(() => props.activeSubscriptions?.filter(s =>
	s.plan_id === props.plan.id &&
	(s.status === 'active' || s.status === 'suspended') &&
	(!s.expires_at || new Date(s.expires_at).getTime() > Date.now())
).length ?? 0)
const maxCount = computed(() => Math.max(1, Number(props.plan.max_subscriptions_per_user) || 1))
const atLimit = computed(() => ownedCount.value >= maxCount.value)
const buttonLabel = computed(() => {
	if (maxCount.value === 1 && isRenewal.value) return t('payment.renewNow')
	if (atLimit.value) return t('payment.planCard.limitReached')
	if (ownedCount.value > 0) return t('payment.planCard.subscribeAnother')
	return t('payment.subscribeNow')
})

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

const hasAnyQuota = computed(() =>
  Number(props.plan.five_hour_quota_usd || 0) > 0 ||
  Number(props.plan.cycle_quota_usd || 0) > 0 ||
  Number(props.plan.total_quota_usd || 0) > 0
)
const normalizedFiveHourQuota = computed(() => Number(props.plan.five_hour_quota_usd || 0).toFixed(2))
const normalizedQuota = computed(() => Number(props.plan.cycle_quota_usd || 0).toFixed(2))
const normalizedTotalQuota = computed(() => Number(props.plan.total_quota_usd || 0).toFixed(2))
const resetIntervalLabel = computed(() => {
  const seconds = Number(props.plan.reset_interval_seconds) || 0
  if (seconds <= 0) return t('payment.planCard.noReset')
  const days = Number((seconds / 86400).toFixed(2))
  return t('payment.planCard.resetEveryDays', { days })
})

const MODEL_SCOPE_LABELS: Record<string, string> = {
  claude: 'Claude',
  gemini_text: 'Gemini',
  gemini_image: 'Imagen',
}

const modelScopeLabels = computed(() => {
  if (platform.value !== 'antigravity') return []
  const scopes = [...new Set(
    includedGroups.value.flatMap(group => group.supported_model_scopes || [])
  )]
  if (!scopes || scopes.length === 0) return []
  return scopes.map((scope, index) => ({
    key: `${scope}:${index}`,
    label: MODEL_SCOPE_LABELS[scope] || scope,
  }))
})

const validitySuffix = computed(() => planValiditySuffix(props.plan, t))
</script>

<style scoped>
.subscription-plan { display:flex; min-width:0; height:100%; flex-direction:column; gap:14px; padding:16px; border:1px solid var(--ui-border); border-radius:var(--ui-radius-panel); color:var(--ui-text); background:var(--ui-surface); transition:border-color var(--ui-motion-fast),background var(--ui-motion-fast); }
.subscription-plan:hover { border-color:var(--ui-text-soft); }
.subscription-plan__header { display:flex; min-width:0; flex-direction:column; align-items:flex-start; gap:7px; }
.subscription-plan__header h3 { max-width:100%; margin:0; font-size:16px; line-height:23px; overflow-wrap:anywhere; }
.subscription-plan__header p { margin:0; color:var(--ui-text-muted); font-size:12px; line-height:19px; overflow-wrap:anywhere; }
.plan-card-platform-badge { max-width:100%; }
.plan-card-platform-badge span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.subscription-plan__price { display:flex; min-width:0; align-items:baseline; flex-wrap:wrap; gap:6px; padding-bottom:12px; border-bottom:1px solid var(--ui-border-soft); }
.subscription-plan__price > span,.subscription-plan__price small,.subscription-plan__price del { color:var(--ui-text-muted); font-size:11px; }
.subscription-plan__price strong { font-size:25px; font-variant-numeric:tabular-nums; }
.subscription-plan__section { padding-top:2px; }
.subscription-plan__section h4 { margin:0 0 8px; color:var(--ui-text-muted); font-size:11px; font-weight:500; }
.subscription-plan__groups { display:flex; flex-direction:column; gap:7px; }
.subscription-plan__groups > div { display:grid; min-width:0; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:7px; font-size:11px; }
.subscription-plan__groups span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.subscription-plan__groups code { color:var(--ui-text-muted); font-size:10px; }
.subscription-plan__badges { display:flex; flex-wrap:wrap; gap:5px; }
.subscription-plan__features { display:flex; flex-direction:column; gap:6px; margin:0; padding:0; list-style:none; }
.subscription-plan__features li { display:grid; grid-template-columns:16px minmax(0,1fr); gap:6px; color:var(--ui-text-muted); font-size:11px; line-height:18px; }
.subscription-plan__features :deep(svg) { color:var(--ui-success); }
.subscription-plan__action { margin-top:auto; }
@media(prefers-reduced-motion:reduce){.subscription-plan{transition:none}}
</style>
