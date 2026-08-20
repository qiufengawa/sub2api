<template>
  <div :class="props.embedded ? 'border-t border-gray-100 dark:border-dark-700' : 'ui-panel'">
    <div :class="props.embedded ? 'px-4 pt-3' : 'border-b border-gray-100 px-6 py-4 dark:border-dark-700'">
      <h2 :class="props.embedded ? 'text-sm font-medium text-gray-900 dark:text-white' : 'text-lg font-medium text-gray-900 dark:text-white'">
        {{ t('profile.totp.title') }}
      </h2>
      <p :class="props.embedded ? 'mt-0.5 text-xs text-gray-500 dark:text-dark-400' : 'mt-1 text-sm text-gray-500 dark:text-gray-400'">
        {{ t('profile.totp.description') }}
      </p>
    </div>
    <div :class="props.embedded ? 'px-4 pb-3 pt-2' : 'px-6 py-6'">
      <!-- Loading state -->
      <div v-if="loading" :class="props.embedded ? 'flex items-center justify-center py-3' : 'flex items-center justify-center py-8'">
        <UiSpinner :size="props.embedded ? 'sm' : 'md'" :label="t('common.loading')" />
      </div>

      <!-- Feature disabled globally -->
      <div v-else-if="status && !status.feature_enabled" :class="props.embedded ? 'flex items-center gap-3' : 'flex items-center gap-4 py-4'">
        <div :class="props.embedded ? 'rounded p-1.5' : 'rounded-full p-3'" class="flex-shrink-0 bg-gray-100 dark:bg-dark-700">
          <Icon name="exclamationTriangle" :size="props.embedded ? 'sm' : 'md'" class="text-gray-400" />
        </div>
        <div>
          <p class="font-medium text-gray-700 dark:text-gray-300">
            {{ t('profile.totp.featureDisabled') }}
          </p>
          <p :class="props.embedded ? 'text-xs text-gray-500 dark:text-dark-400' : 'text-sm text-gray-500 dark:text-gray-400'">
            {{ t('profile.totp.featureDisabledHint') }}
          </p>
        </div>
      </div>

      <!-- 2FA Enabled -->
      <div v-else-if="status?.enabled" class="flex items-center justify-between gap-3">
        <div :class="props.embedded ? 'flex items-center gap-3' : 'flex items-center gap-4'">
        <div :class="props.embedded ? 'rounded p-1.5' : 'rounded-full p-3'" class="flex-shrink-0 bg-green-100 dark:bg-green-900/30">
            <Icon name="shield" :size="props.embedded ? 'sm' : 'md'" class="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p class="font-medium text-gray-900 dark:text-white">
              {{ t('profile.totp.enabled') }}
            </p>
            <p v-if="status.enabled_at" :class="props.embedded ? 'text-xs text-gray-500 dark:text-dark-400' : 'text-sm text-gray-500 dark:text-gray-400'">
              {{ t('profile.totp.enabledAt') }}: {{ formatDate(status.enabled_at) }}
            </p>
          </div>
        </div>
        <UiButton
          type="button"
          variant="danger"
          :density="props.embedded ? 'compact' : 'default'"
          @click="showDisableDialog = true"
        >
          {{ t('profile.totp.disable') }}
        </UiButton>
      </div>

      <!-- 2FA Not Enabled -->
      <div v-else class="flex items-center justify-between gap-3">
        <div :class="props.embedded ? 'flex items-center gap-3' : 'flex items-center gap-4'">
        <div :class="props.embedded ? 'rounded p-1.5' : 'rounded-full p-3'" class="flex-shrink-0 bg-gray-100 dark:bg-dark-700">
            <Icon name="shield" :size="props.embedded ? 'sm' : 'md'" class="text-gray-400" />
          </div>
          <div>
            <p class="font-medium text-gray-700 dark:text-gray-300">
              {{ t('profile.totp.notEnabled') }}
            </p>
            <p :class="props.embedded ? 'text-xs text-gray-500 dark:text-dark-400' : 'text-sm text-gray-500 dark:text-gray-400'">
              {{ t('profile.totp.notEnabledHint') }}
            </p>
          </div>
        </div>
        <UiButton
          type="button"
          variant="primary"
          :density="props.embedded ? 'compact' : 'default'"
          @click="showSetupModal = true"
        >
          {{ t('profile.totp.enable') }}
        </UiButton>
      </div>
    </div>

    <!-- Setup Modal -->
    <TotpSetupModal
      v-if="showSetupModal"
      @close="showSetupModal = false"
      @success="handleSetupSuccess"
    />

    <!-- Disable Dialog -->
    <TotpDisableDialog
      v-if="showDisableDialog"
      @close="showDisableDialog = false"
      @success="handleDisableSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { totpAPI } from '@/api'
import type { TotpStatus } from '@/types'
import { Icon } from '@/components/icons'
import { UiButton, UiSpinner } from '@/components/ui'
import TotpSetupModal from './TotpSetupModal.vue'
import TotpDisableDialog from './TotpDisableDialog.vue'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const loading = ref(true)
const status = ref<TotpStatus | null>(null)
const showSetupModal = ref(false)
const showDisableDialog = ref(false)

const loadStatus = async () => {
  loading.value = true
  try {
    status.value = await totpAPI.getStatus()
  } catch (error) {
    console.error('Failed to load TOTP status:', error)
  } finally {
    loading.value = false
  }
}

const handleSetupSuccess = () => {
  showSetupModal.value = false
  loadStatus()
}

const handleDisableSuccess = () => {
  showDisableDialog.value = false
  loadStatus()
}

const formatDate = (timestamp: number) => {
  // Backend returns Unix timestamp in seconds, convert to milliseconds
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadStatus()
})
</script>
