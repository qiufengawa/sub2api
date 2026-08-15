<template>
  <AppInline :wrap="false">
    <UiDataCell :value="row.primary_model" mono />
    <UiTooltip width-class="w-72">
      <UiStatusBadge :status="row.primary_status" :label="statusLabel(row.primary_status)" />
      <template #content>
        <AppStack :gap="8">
          <UiDataCell :value="row.primary_model" :meta="statusLabel(row.primary_status)" mono />
          <UiEmptyState
            v-if="(row.extra_models_status?.length ?? 0) === 0"
            :title="t('monitorCommon.extraModelsEmpty')"
          />
          <AppStack v-else :gap="6">
            <AppInline v-for="model in row.extra_models_status" :key="model.model" justify="space-between" :wrap="false">
              <UiDataCell :value="model.model" :meta="formatLatency(model.latency_ms)" mono />
              <UiStatusBadge :status="model.status" :label="statusLabel(model.status)" />
            </AppInline>
          </AppStack>
        </AppStack>
      </template>
    </UiTooltip>
  </AppInline>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ChannelMonitor } from '@/api/admin/channelMonitor'
import { AppInline, AppStack, UiDataCell, UiEmptyState, UiStatusBadge, UiTooltip } from '@/components/ui'
import { useChannelMonitorFormat } from '@/composables/useChannelMonitorFormat'

defineProps<{ row: ChannelMonitor }>()

const { t } = useI18n()
const { statusLabel, formatLatency } = useChannelMonitorFormat()
</script>
