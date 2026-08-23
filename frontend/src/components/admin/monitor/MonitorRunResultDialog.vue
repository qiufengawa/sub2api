<template>
  <UiDialog :show="show" :title="t('admin.channelMonitor.runResultTitle')" width="normal" @close="emit('close')">
    <AppStack :gap="8">
      <AppInline v-for="result in requestableResults" :key="result.model" justify="space-between" :wrap="false">
        <UiDataCell :value="result.model" mono />
        <AppInline :wrap="false">
          <UiStatusBadge :status="result.status" :label="statusLabel(result.status)" />
          <UiDataCell :value="latencyLabel(result.latency_ms)" mono />
        </AppInline>
      </AppInline>
      <UiEmptyState v-if="requestableResults.length === 0" :title="t('admin.channelMonitor.noAvailableModels')" />
    </AppStack>
    <template #footer>
      <AppInline justify="flex-end">
        <UiButton density="compact" variant="primary" @click="emit('close')">{{ t('common.close') }}</UiButton>
      </AppInline>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CheckResult } from '@/api/admin/channelMonitor'
import { AppInline, AppStack, UiButton, UiDataCell, UiDialog, UiEmptyState, UiStatusBadge } from '@/components/ui'
import { useChannelMonitorFormat } from '@/composables/useChannelMonitorFormat'

const props = defineProps<{ show: boolean; results: CheckResult[] }>()

const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()
const { statusLabel, formatLatency } = useChannelMonitorFormat()

const requestableResults = computed(() =>
  props.results.filter((result) => result.status === 'operational' || result.status === 'degraded'),
)

function latencyLabel(latency: number | null): string {
  return latency == null ? formatLatency(latency) : `${formatLatency(latency)} ms`
}
</script>
