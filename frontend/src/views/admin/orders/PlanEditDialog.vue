<template>
  <UiDialog :show="show" :title="plan ? t('payment.admin.editPlan') : t('payment.admin.createPlan')" width="wide" @close="emit('close')">
    <form id="plan-form" @submit.prevent="handleSavePlan">
      <AppStack :gap="14">
      <div data-testid="plan-primary-fields">
        <UiTextField v-model="planForm.name" :label="t('payment.admin.planName')" required />
      </div>

	  <AppSection :title="t('payment.admin.includedGroups')" :description="t('payment.admin.includedGroupsHint')" divided data-testid="plan-included-groups">
		<AppStack :gap="8">
		  <UiCheckbox
			v-for="group in includedGroupOptions"
			:key="group.id"
			:model-value="isIncludedGroup(group.id)"
			@update:model-value="toggleIncludedGroup(group.id)"
		  >
			<UiDataCell :value="group.name" :meta="`${group.platform} · ${group.rate_multiplier}x`" />
		  </UiCheckbox>
		  <UiEmptyState v-if="includedGroupOptions.length === 0" :title="t('common.noGroupsAvailable')" />
		</AppStack>
	  </AppSection>

	  <AppInline justify="space-between">
		<UiAlert :message="t('payment.admin.walletFallbackHint')" />
		<UiSwitch v-model="planForm.wallet_fallback_enabled" :label="t('payment.admin.walletFallback')" />
	  </AppInline>

	  <UiCheckbox v-if="removesIncludedGroups && affectedSubscriptions !== null" v-model="confirmGroupRemoval" :label="t('payment.admin.confirmGroupRemovalAffected', { count: affectedSubscriptions })" />
	  <UiAlert v-else-if="removesIncludedGroups" tone="warning" :message="t('payment.admin.groupRemovalImpactCheck')" />

      <UiTextArea v-model="planForm.description" :label="t('payment.admin.planDescription')" :rows="2" required />
      <AppGrid min="220px" :gap="12">
        <AppStack :gap="6">
          <UiTextField :model-value="planForm.price" :label="t('payment.admin.price')" type="number" step="0.01" min="0.01" required @update:model-value="setNumeric('price', $event)" />
          <UiAlert v-if="subscriptionCnyPreview" tone="info" :message="`${t('payment.admin.subscriptionCnyPayPreview', { amount: subscriptionCnyPreview.amount })}${subscriptionCnyPreview.feeRate > 0 ? ` · ${t('payment.admin.subscriptionCnyPayPreviewWithFee', { feeRate: subscriptionCnyPreview.feeRate, total: subscriptionCnyPreview.total })}` : ''}`" />
        </AppStack>
        <UiTextField :model-value="planForm.original_price" :label="t('payment.admin.originalPrice')" type="number" step="0.01" min="0" @update:model-value="setNumeric('original_price', $event)" />
      </AppGrid>
	  <AppGrid min="220px" :gap="12" data-testid="plan-cycle-fields">
		  <UiTextField :model-value="planForm.five_hour_quota_usd ?? ''" :label="t('payment.admin.fiveHourQuota')" :description="t('payment.admin.fiveHourQuotaHint')" type="number" step="0.0001" min="0" @update:model-value="setNumericNullable('five_hour_quota_usd', $event)" />
		  <UiTextField :model-value="planForm.cycle_quota_usd ?? ''" :label="t('payment.admin.cycleQuota')" :description="t('payment.admin.cycleQuotaHint')" type="number" step="0.0001" min="0" @update:model-value="setNumericNullable('cycle_quota_usd', $event)" />
		  <UiTextField :model-value="planForm.reset_interval_days" :label="t('payment.admin.resetIntervalDays')" :description="t('payment.admin.resetIntervalHint')" type="number" step="0.01" min="0.01" :disabled="Number(planForm.cycle_quota_usd) <= 0" @update:model-value="setNumeric('reset_interval_days', $event)" />
		  <UiTextField :model-value="planForm.total_quota_usd ?? ''" :label="t('payment.admin.totalQuota')" :description="t('payment.admin.totalQuotaHint')" type="number" step="0.0001" min="0" @update:model-value="setNumericNullable('total_quota_usd', $event)" />
	  </AppGrid>
      <AppGrid min="220px" :gap="12">
        <UiTextField :model-value="planForm.validity_days" :label="t('payment.admin.validity')" type="number" min="1" required @update:model-value="setNumeric('validity_days', $event)" />
        <UiSelect v-model="planForm.validity_unit" :label="t('payment.admin.validityUnit')" :options="validityUnitOptions" required />
      </AppGrid>
	  <UiTextField v-model="planForm.max_subscriptions_per_user" :label="t('payment.admin.maxSubscriptionsPerUser')" :description="t('payment.admin.maxSubscriptionsPerUserHint')" inputmode="numeric" required />
      <AppGrid min="220px" :gap="12">
        <UiTextField :model-value="planForm.sort_order" :label="t('payment.admin.sortOrder')" type="number" min="0" @update:model-value="setNumeric('sort_order', $event)" />
        <UiTextField v-model="planForm.currency" :label="t('payment.admin.currency')" :description="t('payment.admin.currencyHint')" :maxlength="3" :placeholder="t('payment.admin.currencyPlaceholder')" />
      </AppGrid>
      <UiTextArea v-model="planFeaturesText" :label="t('payment.admin.features')" :description="t('payment.admin.featuresHint')" :rows="3" :placeholder="t('payment.admin.featuresPlaceholder')" />
      <UiSwitch v-model="planForm.for_sale" :label="t('payment.admin.forSale')" />
      </AppStack>
    </form>
    <template #footer>
	  <AppInline justify="flex-end">
		<UiButton type="button" variant="secondary" @click="emit('close')">{{ t('common.cancel') }}</UiButton>
		<UiButton type="submit" form="plan-form" variant="primary" :loading="saving">{{ saving ? t('common.saving') : t('common.save') }}</UiButton>
	  </AppInline>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminPaymentAPI } from '@/api/admin/payment'
import type { AdminPaymentConfig } from '@/api/admin/payment'
import { extractApiErrorCode, extractApiErrorMessage, extractApiErrorMetadata } from '@/utils/apiError'
import { formatPaymentAmount } from '@/components/payment/currency'
import type { SubscriptionPlan } from '@/types/payment'
import type { AdminGroup } from '@/types'
import {
  AppGrid,
  AppInline,
  AppSection,
  AppStack,
  UiAlert,
  UiButton,
  UiCheckbox,
  UiDataCell,
  UiDialog,
  UiEmptyState,
  UiSelect,
  UiSwitch,
  UiTextArea,
  UiTextField,
} from '@/components/ui'

const props = defineProps<{
  show: boolean
  plan: SubscriptionPlan | null
  groups: AdminGroup[]
  paymentConfig?: AdminPaymentConfig | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()
const appStore = useAppStore()

const saving = ref(false)
const planForm = reactive({
  name: '',
  included_group_ids: [] as number[],
  five_hour_quota_usd: null as number | null,
  cycle_quota_usd: null as number | null,
  total_quota_usd: null as number | null,
  reset_interval_days: 7,
  wallet_fallback_enabled: true,
	max_subscriptions_per_user: '1',
  description: '',
  price: 0,
  original_price: 0,
  currency: '',
  validity_days: 30,
  validity_unit: 'days',
  sort_order: 0,
  for_sale: true,
})
const planFeaturesText = ref('')
const initialIncludedGroupIDs = ref<number[]>([])
const confirmGroupRemoval = ref(false)
const affectedSubscriptions = ref<number | null>(null)

type NumericField = 'price' | 'original_price' | 'five_hour_quota_usd' | 'cycle_quota_usd' | 'total_quota_usd' | 'reset_interval_days' | 'validity_days' | 'sort_order'

function setNumeric(field: NumericField, value: string | number): void {
  const numeric = Number(value)
  const form = planForm as unknown as Record<NumericField, number | null>
  form[field] = Number.isFinite(numeric) ? numeric : 0
}

function setNumericNullable(field: 'five_hour_quota_usd' | 'cycle_quota_usd' | 'total_quota_usd', value: string | number): void {
  if (value === '') {
    planForm[field] = null
    return
  }
  const numeric = Number(value)
  planForm[field] = Number.isFinite(numeric) ? numeric : null
}

const validityUnitOptions = computed(() => [
  { value: 'days', label: t('payment.admin.days') },
  { value: 'weeks', label: t('payment.admin.weeks') },
  { value: 'months', label: t('payment.admin.months') },
])

const includedGroupOptions = computed(() =>
  props.groups.filter(group => group.status === 'active' && group.subscription_type === 'standard'),
)

const normalizedIncludedGroupIDs = computed(() => {
	const eligibleIDs = new Set(includedGroupOptions.value.map(group => group.id))
  const seen = new Set<number>()
  const result: number[] = []
  for (const id of planForm.included_group_ids) {
	if (!id || seen.has(id) || !eligibleIDs.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
})

const removesIncludedGroups = computed(() => {
  if (!props.plan) return false
  const current = new Set(normalizedIncludedGroupIDs.value)
  return initialIncludedGroupIDs.value.some(id => !current.has(id))
})

function isIncludedGroup(groupID: number): boolean {
  return normalizedIncludedGroupIDs.value.includes(groupID)
}

function toggleIncludedGroup(groupID: number) {
  const index = planForm.included_group_ids.indexOf(groupID)
  if (index >= 0) planForm.included_group_ids.splice(index, 1)
  else planForm.included_group_ids.push(groupID)
  confirmGroupRemoval.value = false
  affectedSubscriptions.value = null
}

function roundCnyAmount(value: number): number {
  return Math.round(value * 100) / 100
}

function ceilCnyAmount(value: number): number {
  return Math.ceil(value * 100) / 100
}

const subscriptionCnyPreview = computed(() => {
  const price = Number(planForm.price) || 0
  const rate = Number(props.paymentConfig?.subscription_usd_to_cny_rate) || 0
  if (price <= 0 || rate <= 0) return null

  const amount = roundCnyAmount(price * rate)
  const feeRate = Number(props.paymentConfig?.recharge_fee_rate) || 0
  const fee = feeRate > 0 ? ceilCnyAmount((amount * feeRate) / 100) : 0
  const total = feeRate > 0 ? roundCnyAmount(amount + fee) : amount

  return {
    amount: formatPaymentAmount(amount, 'CNY'),
    feeRate,
    total: formatPaymentAmount(total, 'CNY'),
  }
})

// Reset form when dialog opens
watch(() => props.show, (visible) => {
  if (!visible) return
  if (props.plan) {
    const includedGroupIDs = props.plan.included_groups.map(group => group.id)
    Object.assign(planForm, {
      name: props.plan.name,
      included_group_ids: [...includedGroupIDs],
      five_hour_quota_usd: props.plan.five_hour_quota_usd ?? null,
      cycle_quota_usd: props.plan.cycle_quota_usd ?? null,
      total_quota_usd: props.plan.total_quota_usd ?? null,
      reset_interval_days: props.plan.reset_interval_seconds ? props.plan.reset_interval_seconds / 86400 : 7,
      wallet_fallback_enabled: props.plan.wallet_fallback_enabled ?? true,
	  max_subscriptions_per_user: String(props.plan.max_subscriptions_per_user ?? 1),
      description: props.plan.description,
      price: props.plan.price,
      original_price: props.plan.original_price || 0,
      currency: props.plan.currency || '',
      validity_days: props.plan.validity_days,
      validity_unit: props.plan.validity_unit || 'days',
      sort_order: props.plan.sort_order || 0,
      for_sale: props.plan.for_sale,
    })
    initialIncludedGroupIDs.value = [...new Set(includedGroupIDs)]
    planFeaturesText.value = (props.plan.features || []).join('\n')
  } else {
    Object.assign(planForm, { name: '', included_group_ids: [], five_hour_quota_usd: null, cycle_quota_usd: null, total_quota_usd: null, reset_interval_days: 7, wallet_fallback_enabled: true, max_subscriptions_per_user: '1', description: '', price: 0, original_price: 0, currency: '', validity_days: 30, validity_unit: 'days', sort_order: 0, for_sale: true })
    initialIncludedGroupIDs.value = []
    planFeaturesText.value = ''
  }
  confirmGroupRemoval.value = false
  affectedSubscriptions.value = null
})

/** Build request payload with snake_case keys matching backend JSON tags */
function buildPlanPayload() {
  const features = planFeaturesText.value.split('\n').map(f => f.trim()).filter(Boolean).join('\n')
  const fiveHourQuota = Number(planForm.five_hour_quota_usd) > 0 ? Number(planForm.five_hour_quota_usd) : null
  const cycleQuota = Number(planForm.cycle_quota_usd) > 0 ? Number(planForm.cycle_quota_usd) : null
  const totalQuota = Number(planForm.total_quota_usd) > 0 ? Number(planForm.total_quota_usd) : null
  return {
    name: planForm.name,
    included_group_ids: normalizedIncludedGroupIDs.value,
    five_hour_quota_usd: fiveHourQuota,
    cycle_quota_usd: cycleQuota,
    total_quota_usd: totalQuota,
    reset_interval_seconds: cycleQuota ? Math.round(Number(planForm.reset_interval_days) * 86400) : 0,
    wallet_fallback_enabled: planForm.wallet_fallback_enabled,
	max_subscriptions_per_user: Number(planForm.max_subscriptions_per_user),
    confirm_group_removal: confirmGroupRemoval.value,
    description: planForm.description,
    price: planForm.price,
    original_price: planForm.original_price || 0,
    currency: planForm.currency.trim().toUpperCase(),
    validity_days: planForm.validity_days,
    validity_unit: planForm.validity_unit,
    sort_order: planForm.sort_order,
    for_sale: planForm.for_sale,
    features,
  }
}

async function handleSavePlan() {
  if (normalizedIncludedGroupIDs.value.length === 0) {
    appStore.showError(t('payment.admin.groupRequired'))
    return
  }
  if (!planForm.price || planForm.price <= 0) {
    appStore.showError(t('payment.admin.priceRequired'))
    return
  }
  if (!planForm.validity_days || planForm.validity_days < 1) {
    appStore.showError(t('payment.admin.validityRequired'))
    return
  }
	if (!/^[1-9]\d*$/.test(planForm.max_subscriptions_per_user) || Number(planForm.max_subscriptions_per_user) > 2147483647) {
		appStore.showError(t('payment.admin.maxSubscriptionsPerUserInvalid'))
		return
	}
	if (Number(planForm.five_hour_quota_usd) < 0) {
		appStore.showError(t('payment.admin.fiveHourQuotaInvalid'))
		return
	}
  if (Number(planForm.cycle_quota_usd) < 0) {
    appStore.showError(t('payment.admin.cycleQuotaRequired'))
    return
  }
  if (Number(planForm.total_quota_usd) < 0) {
    appStore.showError(t('payment.admin.totalQuotaRequired'))
    return
  }
  if (Number(planForm.cycle_quota_usd) > 0 && Number(planForm.reset_interval_days) <= 0) {
    appStore.showError(t('payment.admin.resetIntervalRequired'))
    return
  }
  if (removesIncludedGroups.value && affectedSubscriptions.value !== null && !confirmGroupRemoval.value) {
    appStore.showError(t('payment.admin.confirmGroupRemovalRequired'))
    return
  }
  saving.value = true
  try {
    const data = buildPlanPayload()
    if (props.plan) { await adminPaymentAPI.updatePlan(props.plan.id, data) }
    else { await adminPaymentAPI.createPlan(data) }
    appStore.showSuccess(t('common.saved'))
    emit('close')
    emit('saved')
  } catch (err: unknown) {
    if (extractApiErrorCode(err) === 'PLAN_GROUP_REMOVAL_CONFIRMATION_REQUIRED') {
      const rawCount = Number(extractApiErrorMetadata(err)?.affected_subscriptions)
      affectedSubscriptions.value = Number.isFinite(rawCount) && rawCount >= 0 ? Math.trunc(rawCount) : 0
      confirmGroupRemoval.value = false
      appStore.showError(t('payment.admin.confirmGroupRemovalAffected', { count: affectedSubscriptions.value }))
    } else {
      appStore.showError(extractApiErrorMessage(err, t('common.error')))
    }
  }
  finally { saving.value = false }
}
</script>
