<template>
  <div>
    <header>
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('profile.billingPreference.title') }}
      </h2>
      <p class="mt-0.5 text-xs text-gray-500 dark:text-dark-400">
        {{ t('profile.billingPreference.description') }}
      </p>
    </header>

    <div class="mt-3 divide-y divide-gray-100 border-y border-gray-100 dark:divide-dark-700 dark:border-dark-700">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-start gap-3 py-3"
      >
        <input
          v-model="selected"
          type="radio"
          name="billing-preference"
          :value="option.value"
          class="mt-0.5 h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span class="min-w-0">
          <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ option.label }}</span>
          <span class="mt-0.5 block text-xs leading-5 text-gray-500 dark:text-dark-400">{{ option.description }}</span>
        </span>
      </label>
    </div>

    <div class="mt-3 flex justify-end">
      <button type="button" class="btn btn-primary btn-sm" :disabled="saving || !dirty" @click="save">
        {{ saving ? t('common.saving') : t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { userAPI } from '@/api'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { extractApiErrorMessage } from '@/utils/apiError'
import type { BillingPreference } from '@/types'

const props = defineProps<{ value?: BillingPreference }>()
const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const initialPreference = props.value || 'subscription_first'
const selected = ref<BillingPreference>(initialPreference)
const savedValue = ref<BillingPreference>(initialPreference)
const saving = ref(false)

watch(() => props.value, value => {
  const preference = value || 'subscription_first'
  selected.value = preference
  savedValue.value = preference
})

const dirty = computed(() => selected.value !== savedValue.value)
const options = computed<Array<{ value: BillingPreference; label: string; description: string }>>(() => [
  { value: 'subscription_first', label: t('profile.billingPreference.subscriptionFirst'), description: t('profile.billingPreference.subscriptionFirstDesc') },
  { value: 'wallet_first', label: t('profile.billingPreference.walletFirst'), description: t('profile.billingPreference.walletFirstDesc') },
  { value: 'subscription_only', label: t('profile.billingPreference.subscriptionOnly'), description: t('profile.billingPreference.subscriptionOnlyDesc') },
  { value: 'wallet_only', label: t('profile.billingPreference.walletOnly'), description: t('profile.billingPreference.walletOnlyDesc') },
])

async function save() {
  if (!dirty.value || saving.value) return
  saving.value = true
  try {
    const updated = await userAPI.updateProfile({ billing_preference: selected.value })
    authStore.user = updated
    savedValue.value = updated.billing_preference || selected.value
    selected.value = savedValue.value
    appStore.showSuccess(t('common.saved'))
  } catch (error: unknown) {
    appStore.showError(extractApiErrorMessage(error, t('common.error')))
  } finally {
    saving.value = false
  }
}
</script>
