<template>
  <UiDialog
    :show="show"
    :title="t('admin.users.bulkLimits.title')"
    width="normal"
    @close="closeModal"
  >
    <form id="bulk-edit-user-limits-form" class="bulk-edit-user" @submit.prevent="handleSubmit">
      <p class="bulk-edit-user__summary">
        {{ t('admin.users.bulkLimits.selectedCount', { count: selectedIds.length }) }}
      </p>

      <div class="bulk-edit-user__fields">
        <UiFormField for-id="bulk-concurrency" :label="t('admin.users.columns.concurrency')">
          <template #help>
            <UiSwitch
              v-model="enableConcurrency"
              :label="t('admin.users.bulkLimits.enableConcurrency')"
              :aria-label="t('admin.users.bulkLimits.enableConcurrency')"
              data-test="enable-concurrency"
            />
          </template>
          <UiTextField
            v-if="enableConcurrency"
            id="bulk-concurrency"
            type="number"
            min="0"
            step="1"
            density="compact"
            :model-value="concurrencyValue"
            @update:model-value="concurrencyValue = $event"
            data-test="concurrency-input"
          />
        </UiFormField>

        <UiFormField for-id="bulk-rpm-limit" :label="t('admin.users.form.rpmLimit')">
          <template #help>
            <UiSwitch
              v-model="enableRPMLimit"
              :label="t('admin.users.bulkLimits.enableRPMLimit')"
              :aria-label="t('admin.users.bulkLimits.enableRPMLimit')"
              data-test="enable-rpm-limit"
            />
          </template>
          <div v-if="enableRPMLimit">
            <UiTextField
              id="bulk-rpm-limit"
              v-model="rpmLimitValue"
              type="number"
              min="0"
              step="1"
              density="compact"
              data-test="rpm-limit-input"
            />
            <p v-if="parsedRPMLimit === 0" class="user-field-hint">
              {{ t('admin.users.bulkLimits.unlimited') }}
            </p>
          </div>
        </UiFormField>
      </div>

      <UiAlert v-if="hasInvalidValue" tone="danger">
        {{ t('admin.users.bulkLimits.nonNegativeInteger') }}
      </UiAlert>
      <UiAlert v-if="selectionTooLarge" tone="danger">
        {{ t('admin.users.bulkLimits.selectionLimit', { max: MAX_BATCH_USER_IDS }) }}
      </UiAlert>
    </form>

    <template #footer>
      <UiButton density="compact" type="button" @click="closeModal">{{ t('common.cancel') }}</UiButton>
      <UiButton density="compact" type="submit" form="bulk-edit-user-limits-form" variant="primary" :loading="submitting" :disabled="!canSubmit" data-test="submit">
        {{ submitting ? t('admin.users.bulkLimits.applying') : t('admin.users.bulkLimits.apply') }}
      </UiButton>
    </template>
  </UiDialog>

  <UiConfirmDialog
    :show="confirmOpen"
    :title="t('admin.users.bulkLimits.title')"
    :message="confirmMessage"
    :confirm-text="t('admin.users.bulkLimits.apply')"
    :cancel-text="t('common.cancel')"
    :pending="submitting"
    danger
    @confirm="applyPendingRequest"
    @cancel="cancelConfirmation"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { BatchUpdateUserLimitsRequest } from '@/api/admin/users'
import { useAppStore } from '@/stores/app'
import { UiAlert, UiButton, UiConfirmDialog, UiDialog, UiFormField, UiSwitch, UiTextField } from '@/components/ui'

const props = defineProps<{
  show: boolean
  selectedIds: number[]
}>()

const emit = defineEmits<{
  close: []
  success: [affected: number]
}>()

const { t } = useI18n()
const appStore = useAppStore()
const enableConcurrency = ref(false)
const enableRPMLimit = ref(false)
const concurrencyValue = ref<string | number>('')
const rpmLimitValue = ref<string | number>('')
const submitting = ref(false)
const confirmOpen = ref(false)
const confirmMessage = ref('')
const pendingRequest = ref<BatchUpdateUserLimitsRequest | null>(null)
const MAX_BATCH_USER_IDS = 500

const parseLimit = (value: string | number): number | null | undefined => {
  const trimmed = String(value).trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

const parsedConcurrency = computed(() =>
  enableConcurrency.value ? parseLimit(concurrencyValue.value) : undefined
)
const parsedRPMLimit = computed(() =>
  enableRPMLimit.value ? parseLimit(rpmLimitValue.value) : undefined
)
const hasInvalidValue = computed(() =>
  parsedConcurrency.value === null || parsedRPMLimit.value === null
)
const hasUpdate = computed(() =>
  (parsedConcurrency.value !== undefined && parsedConcurrency.value !== null)
  || (parsedRPMLimit.value !== undefined && parsedRPMLimit.value !== null)
)
const selectionTooLarge = computed(() => props.selectedIds.length > MAX_BATCH_USER_IDS)
const canSubmit = computed(() =>
  props.selectedIds.length > 0
  && !selectionTooLarge.value
  && hasUpdate.value
  && !hasInvalidValue.value
  && !submitting.value
)

const reset = () => {
  enableConcurrency.value = false
  enableRPMLimit.value = false
  concurrencyValue.value = ''
  rpmLimitValue.value = ''
  submitting.value = false
  confirmOpen.value = false
  confirmMessage.value = ''
  pendingRequest.value = null
}

watch(
  () => props.show,
  (show) => {
    if (show) reset()
  }
)

const closeModal = () => {
  if (submitting.value) return
  confirmOpen.value = false
  pendingRequest.value = null
  emit('close')
}

const cancelConfirmation = () => {
  if (submitting.value) return
  confirmOpen.value = false
  confirmMessage.value = ''
  pendingRequest.value = null
}

const handleSubmit = () => {
  if (!canSubmit.value) return

  const request: BatchUpdateUserLimitsRequest = {
    user_ids: [...props.selectedIds],
    all: false
  }
  const fields: string[] = []
  if (parsedConcurrency.value !== undefined && parsedConcurrency.value !== null) {
    request.concurrency = parsedConcurrency.value
    fields.push(
      t('admin.users.bulkLimits.concurrencyValue', { value: parsedConcurrency.value })
    )
  }
  if (parsedRPMLimit.value !== undefined && parsedRPMLimit.value !== null) {
    request.rpm_limit = parsedRPMLimit.value
    fields.push(
      parsedRPMLimit.value === 0
        ? t('admin.users.bulkLimits.rpmUnlimitedValue')
        : t('admin.users.bulkLimits.rpmValue', { value: parsedRPMLimit.value })
    )
  }

  pendingRequest.value = request
  confirmMessage.value = t('admin.users.bulkLimits.confirm', {
    count: props.selectedIds.length,
    fields: fields.join(', ')
  })
  confirmOpen.value = true
}

const applyPendingRequest = async () => {
  const request = pendingRequest.value
  if (!request || submitting.value) return

  submitting.value = true
  try {
    const result = await adminAPI.users.batchUpdateLimits(request)
    appStore.showSuccess(
      t('admin.users.bulkLimits.success', { count: result.affected })
    )
    confirmOpen.value = false
    pendingRequest.value = null
    emit('success', result.affected)
    emit('close')
  } catch (error: any) {
    appStore.showError(
      error.response?.data?.message
      || error.response?.data?.detail
      || t('admin.users.bulkLimits.failed')
    )
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.bulk-edit-user{display:grid;gap:16px}.bulk-edit-user__summary{margin:0;color:var(--ui-text);font-size:13px;font-weight:500}.bulk-edit-user__fields{display:grid;border-block:1px solid var(--ui-border-soft)}.bulk-edit-user__fields>.ui-form-field{padding:14px 0}.bulk-edit-user__fields>.ui-form-field+.ui-form-field{border-top:1px solid var(--ui-border-soft)}.user-field-hint{margin:4px 0 0;color:var(--ui-text-soft);font-size:12px;line-height:18px}
</style>
