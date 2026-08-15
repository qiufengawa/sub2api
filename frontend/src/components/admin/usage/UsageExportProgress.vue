<template>
  <UiDialog
    :show="show"
    :title="t('usage.exporting')"
    width="narrow"
    :close-label="t('common.close')"
    :z-index="50"
    @close="emit('cancel')"
  >
    <UiExportJob
      status="running"
      :title="t('usage.exportingProgress')"
      :status-label="t('usage.exporting')"
      :message="t('usage.exportedCount', { current, total })"
      :progress="normalizedProgress"
      :progress-label="`${t('usage.exportingProgress')}: ${normalizedProgress}%`"
      :cancel-label="t('usage.cancelExport')"
      @cancel="emit('cancel')"
    />
    <p v-if="estimatedTime" class="usage-export__eta" aria-live="polite" aria-atomic="true">
      {{ t('usage.estimatedTime', { time: estimatedTime }) }}
    </p>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiDialog, UiExportJob } from '@/components/ui'

const props = defineProps<{
  show: boolean
  progress: number
  current: number
  total: number
  estimatedTime: string
}>()
const emit = defineEmits<{ cancel: [] }>()
const { t } = useI18n()
const normalizedProgress = computed(() => {
  const value = Number.isFinite(props.progress) ? props.progress : 0
  return Math.min(100, Math.max(0, Math.round(value)))
})
</script>

<style scoped>
.usage-export__eta {
  margin: 10px 0 0;
  color: var(--ui-text-soft);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
</style>
