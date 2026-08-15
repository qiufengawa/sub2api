<template>
  <AppInline :gap="6" :wrap="false" class="quota-notify-toggle">
    <UiSwitch
      :model-value="Boolean(enabled)"
      :label="t('admin.accounts.quotaNotify.alert')"
      @update:model-value="emit('update:enabled', $event)"
    />
    <template v-if="enabled">
      <UiTextField
        :model-value="threshold ?? ''"
        type="number"
        density="dense"
        :label="t('admin.accounts.quotaNotify.threshold')"
        :min="0"
        :max="thresholdType === QUOTA_THRESHOLD_TYPE_PERCENTAGE ? 100 : undefined"
        :step="thresholdType === QUOTA_THRESHOLD_TYPE_PERCENTAGE ? 1 : 0.01"
        :input-attrs="{ 'aria-label': t('admin.accounts.quotaNotify.alert') }"
        @update:model-value="updateThreshold"
      />
      <UiSelect
        :model-value="thresholdType || QUOTA_THRESHOLD_TYPE_FIXED"
        :options="thresholdTypeOptions"
        density="dense"
        label="$ / %"
        @update:model-value="updateThresholdType"
      />
    </template>
  </AppInline>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppInline, UiSelect, UiSwitch, UiTextField } from '@/components/ui'
import {
  QUOTA_THRESHOLD_TYPE_FIXED,
  QUOTA_THRESHOLD_TYPE_PERCENTAGE,
  type QuotaThresholdType
} from '@/constants/account'

defineProps<{
  enabled: boolean | null
  threshold: number | null
  thresholdType: QuotaThresholdType | null
}>()

const emit = defineEmits<{
  'update:enabled': [value: boolean | null]
  'update:threshold': [value: number | null]
  'update:thresholdType': [value: QuotaThresholdType | null]
}>()

const { t } = useI18n()
const thresholdTypeOptions = computed(() => [
  { value: QUOTA_THRESHOLD_TYPE_FIXED, label: '$' },
  { value: QUOTA_THRESHOLD_TYPE_PERCENTAGE, label: '%' }
])

function updateThreshold(value: string | number): void {
  const parsed = Number.parseFloat(String(value))
  emit('update:threshold', parsed || null)
}

function updateThresholdType(value: string | number | boolean | null): void {
  emit('update:thresholdType', String(value) as QuotaThresholdType)
}
</script>

<style scoped>
.quota-notify-toggle{min-width:0}
.quota-notify-toggle :deep(.ui-form-field){min-width:0;flex:1}
.quota-notify-toggle :deep(.ui-select-control){width:72px;flex:none}
</style>
