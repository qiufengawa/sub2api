<template>
  <BaseDialog :show="show" :title="plan ? t('payment.admin.editPlan') : t('payment.admin.createPlan')" width="wide" @close="emit('close')">
    <form id="plan-form" @submit.prevent="handleSavePlan" class="space-y-4">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="plan-primary-fields">
        <div>
          <label class="input-label">{{ t('payment.admin.planName') }} <span class="text-red-500">*</span></label>
          <input v-model="planForm.name" type="text" class="input" required />
        </div>
        <div>
          <label class="input-label">{{ t('payment.admin.group') }} <span class="text-red-500">*</span></label>
          <Select v-model="planForm.group_id" :options="groupOptions" :placeholder="t('payment.admin.selectGroup')" class="w-full">
            <template #selected="{ option }">
              <span v-if="option?.platform" :class="platformTextClass(String(option.platform))">{{ option.label }}</span>
              <span v-else>{{ option?.label || t('payment.admin.selectGroup') }}</span>
            </template>
            <template #option="{ option, selected }">
              <span class="flex-1 truncate text-left" :class="option.platform ? platformTextClass(String(option.platform)) : ''">{{ option.label }}</span>
              <Icon v-if="selected" name="check" size="sm" class="text-primary-500" :stroke-width="2" />
            </template>
          </Select>
        </div>
      </div>

      <!-- Group Info Preview -->
      <div v-if="selectedGroupInfo" class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-dark-600 dark:bg-dark-800">
        <div class="mb-2 flex items-center gap-2">
          <GroupBadge :name="selectedGroupInfo.name" :platform="selectedGroupInfo.platform" :rate-multiplier="selectedGroupInfo.rate_multiplier" />
        </div>
        <div class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <div><span class="text-gray-500">{{ t('payment.admin.dailyLimit') }}:</span> <span class="ml-1 font-medium text-gray-700 dark:text-gray-300">{{ selectedGroupInfo.daily_limit_usd != null ? '$' + selectedGroupInfo.daily_limit_usd : t('payment.admin.unlimited') }}</span></div>
          <div><span class="text-gray-500">{{ t('payment.admin.weeklyLimit') }}:</span> <span class="ml-1 font-medium text-gray-700 dark:text-gray-300">{{ selectedGroupInfo.weekly_limit_usd != null ? '$' + selectedGroupInfo.weekly_limit_usd : t('payment.admin.unlimited') }}</span></div>
          <div><span class="text-gray-500">{{ t('payment.admin.monthlyLimit') }}:</span> <span class="ml-1 font-medium text-gray-700 dark:text-gray-300">{{ selectedGroupInfo.monthly_limit_usd != null ? '$' + selectedGroupInfo.monthly_limit_usd : t('payment.admin.unlimited') }}</span></div>
        </div>
      </div>

	  <section class="border-y border-gray-100 py-4 dark:border-dark-700" data-testid="plan-included-groups">
		<div class="mb-3">
		  <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('payment.admin.includedGroups') }}</h3>
		  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('payment.admin.includedGroupsHint') }}</p>
		</div>
		<div class="max-h-52 divide-y divide-gray-100 overflow-y-auto border-y border-gray-100 dark:divide-dark-700 dark:border-dark-700">
		  <label
			v-for="group in includedGroupOptions"
			:key="group.id"
			class="flex cursor-pointer items-center gap-3 py-2.5"
			:class="group.id === planForm.group_id ? 'cursor-default' : ''"
		  >
			<input
			  type="checkbox"
			  class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
			  :checked="isIncludedGroup(group.id)"
			  :disabled="group.id === planForm.group_id"
			  @change="toggleIncludedGroup(group.id)"
			/>
			<GroupBadge :name="group.name" :platform="group.platform" :rate-multiplier="group.rate_multiplier" />
			<span v-if="group.id === planForm.group_id" class="ml-auto shrink-0 text-xs text-gray-400">{{ t('payment.admin.primaryGroup') }}</span>
		  </label>
		</div>
	  </section>

	  <div class="flex items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-dark-700">
		<div class="min-w-0">
		  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('payment.admin.walletFallback') }}</p>
		  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('payment.admin.walletFallbackHint') }}</p>
		</div>
		<button
		  type="button"
		  :aria-pressed="planForm.wallet_fallback_enabled"
		  :class="[
			'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
			planForm.wallet_fallback_enabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'
		  ]"
		  @click="planForm.wallet_fallback_enabled = !planForm.wallet_fallback_enabled"
		>
		  <span :class="['pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', planForm.wallet_fallback_enabled ? 'translate-x-5' : 'translate-x-0']" />
		</button>
	  </div>

	  <label v-if="removesIncludedGroups && affectedSubscriptions !== null" class="flex items-start gap-2 border-l-2 border-orange-400 bg-orange-50/70 px-3 py-2 text-xs text-orange-800 dark:bg-orange-500/10 dark:text-orange-200">
		<input v-model="confirmGroupRemoval" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500" />
		<span>{{ t('payment.admin.confirmGroupRemovalAffected', { count: affectedSubscriptions }) }}</span>
	  </label>
	  <p v-else-if="removesIncludedGroups" class="border-l-2 border-orange-400 px-3 py-1 text-xs text-orange-700 dark:text-orange-300">
		{{ t('payment.admin.groupRemovalImpactCheck') }}
	  </p>

      <div><label class="input-label">{{ t('payment.admin.planDescription') }} <span class="text-red-500">*</span></label><textarea v-model="planForm.description" rows="2" class="input" required></textarea></div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label class="input-label">{{ t('payment.admin.price') }} <span class="text-red-500">*</span></label>
          <input v-model.number="planForm.price" type="number" step="0.01" min="0.01" class="input" required />
          <p v-if="subscriptionCnyPreview" class="mt-1 text-xs font-medium text-primary-600 dark:text-primary-400">
            {{ t('payment.admin.subscriptionCnyPayPreview', { amount: subscriptionCnyPreview.amount }) }}
            <span v-if="subscriptionCnyPreview.feeRate > 0">
              {{ t('payment.admin.subscriptionCnyPayPreviewWithFee', { feeRate: subscriptionCnyPreview.feeRate, total: subscriptionCnyPreview.total }) }}
            </span>
          </p>
        </div>
        <div><label class="input-label">{{ t('payment.admin.originalPrice') }}</label><input v-model.number="planForm.original_price" type="number" step="0.01" min="0" class="input" /></div>
      </div>
	  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="plan-cycle-fields">
		<div>
		  <label class="input-label">{{ t('payment.admin.cycleQuota') }}</label>
		  <input v-model.number="planForm.cycle_quota_usd" type="number" step="0.0001" min="0.0001" class="input" />
		  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('payment.admin.cycleQuotaHint') }}</p>
		</div>
		<div>
		  <label class="input-label">{{ t('payment.admin.resetIntervalDays') }}</label>
		  <input v-model.number="planForm.reset_interval_days" type="number" step="0.01" min="0.01" class="input" />
		  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('payment.admin.resetIntervalHint') }}</p>
		</div>
	  </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label class="input-label">{{ t('payment.admin.validity') }} <span class="text-red-500">*</span></label><input v-model.number="planForm.validity_days" type="number" min="1" class="input" required /></div>
        <div><label class="input-label">{{ t('payment.admin.validityUnit') }} <span class="text-red-500">*</span></label><Select v-model="planForm.validity_unit" :options="validityUnitOptions" /></div>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label class="input-label">{{ t('payment.admin.sortOrder') }}</label><input v-model.number="planForm.sort_order" type="number" min="0" class="input" /></div>
        <div>
          <label class="input-label">{{ t('payment.admin.currency') }}</label>
          <input v-model="planForm.currency" type="text" maxlength="3" class="input uppercase" :placeholder="t('payment.admin.currencyPlaceholder')" />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('payment.admin.currencyHint') }}</p>
        </div>
      </div>
      <div>
        <label class="input-label">{{ t('payment.admin.features') }}</label>
        <textarea v-model="planFeaturesText" rows="3" class="input" :placeholder="t('payment.admin.featuresPlaceholder')"></textarea>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('payment.admin.featuresHint') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <label class="text-sm text-gray-700 dark:text-gray-300">{{ t('payment.admin.forSale') }}</label>
        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            planForm.for_sale ? 'bg-primary-500' : 'bg-gray-300 dark:bg-dark-600'
          ]"
          @click="planForm.for_sale = !planForm.for_sale"
        >
          <span :class="[
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            planForm.for_sale ? 'translate-x-5' : 'translate-x-0'
          ]" />
        </button>
      </div>
    </form>
    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" @click="emit('close')" class="btn btn-secondary w-full sm:w-auto">{{ t('common.cancel') }}</button>
        <button type="submit" form="plan-form" :disabled="saving" class="btn btn-primary w-full sm:w-auto">{{ saving ? t('common.saving') : t('common.save') }}</button>
      </div>
    </template>
  </BaseDialog>
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
import BaseDialog from '@/components/common/BaseDialog.vue'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import GroupBadge from '@/components/common/GroupBadge.vue'
import { platformTextClass } from '@/utils/platformColors'

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
  group_id: null as number | null,
  included_group_ids: [] as number[],
  cycle_quota_usd: null as number | null,
  reset_interval_days: 7,
  wallet_fallback_enabled: true,
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

const validityUnitOptions = computed(() => [
  { value: 'days', label: t('payment.admin.days') },
  { value: 'weeks', label: t('payment.admin.weeks') },
  { value: 'months', label: t('payment.admin.months') },
])

const groupOptions = computed(() =>
  props.groups
    .filter(g => g.status === 'active')
    .map(g => ({
      value: g.id,
      label: `${g.name} — ${g.platform} (${g.rate_multiplier}x)`,
      platform: g.platform,
    })),
)

const includedGroupOptions = computed(() =>
  props.groups.filter(group => group.status === 'active'),
)

const selectedGroupInfo = computed(() => {
  if (!planForm.group_id) return null
  return props.groups.find(g => g.id === planForm.group_id) || null
})

const normalizedIncludedGroupIDs = computed(() => {
  const primary = planForm.group_id
  const seen = new Set<number>()
  const result: number[] = []
  for (const id of [primary, ...planForm.included_group_ids]) {
    if (!id || seen.has(id)) continue
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
  if (groupID === planForm.group_id) return
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
    const includedGroupIDs = props.plan.included_groups?.map(group => group.id) || [props.plan.group_id]
    Object.assign(planForm, {
      name: props.plan.name,
      group_id: props.plan.group_id,
      included_group_ids: [...includedGroupIDs],
      cycle_quota_usd: props.plan.cycle_quota_usd ?? null,
      reset_interval_days: props.plan.reset_interval_seconds ? props.plan.reset_interval_seconds / 86400 : 7,
      wallet_fallback_enabled: props.plan.wallet_fallback_enabled ?? true,
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
    Object.assign(planForm, { name: '', group_id: null, included_group_ids: [], cycle_quota_usd: null, reset_interval_days: 7, wallet_fallback_enabled: true, description: '', price: 0, original_price: 0, currency: '', validity_days: 30, validity_unit: 'days', sort_order: 0, for_sale: true })
    initialIncludedGroupIDs.value = []
    planFeaturesText.value = ''
  }
  confirmGroupRemoval.value = false
  affectedSubscriptions.value = null
})

watch(() => planForm.group_id, (groupID) => {
  confirmGroupRemoval.value = false
  affectedSubscriptions.value = null
  if (groupID && !planForm.included_group_ids.includes(groupID)) {
    planForm.included_group_ids.unshift(groupID)
  }
})

/** Build request payload with snake_case keys matching backend JSON tags */
function buildPlanPayload() {
  const features = planFeaturesText.value.split('\n').map(f => f.trim()).filter(Boolean).join('\n')
  const cycleQuota = Number(planForm.cycle_quota_usd) > 0 ? Number(planForm.cycle_quota_usd) : null
  return {
    name: planForm.name,
    group_id: planForm.group_id,
    included_group_ids: normalizedIncludedGroupIDs.value,
    cycle_quota_usd: cycleQuota,
    reset_interval_seconds: cycleQuota ? Math.round(Number(planForm.reset_interval_days) * 86400) : 0,
    wallet_fallback_enabled: planForm.wallet_fallback_enabled,
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
  if (!planForm.group_id) {
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
  if (planForm.cycle_quota_usd != null && Number(planForm.cycle_quota_usd) <= 0) {
    appStore.showError(t('payment.admin.cycleQuotaRequired'))
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
