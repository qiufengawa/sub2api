<template>
  <button
    type="button"
    class="monitor-list-row ui-focus-ring ui-motion"
    @click="emit('click')"
  >
    <div class="monitor-identity">
      <span class="monitor-provider-icon">
        <ProviderIcon :provider="item.provider" :size="20" />
      </span>
      <div class="monitor-identity__copy">
        <div class="monitor-name" :title="item.name">
          {{ item.name }}
        </div>
        <div class="monitor-meta">
          <UiBadge>{{ providerLabel(item.provider) }}</UiBadge>
          <span class="monitor-model ui-numeric" :title="item.primary_model">
            {{ item.primary_model }}
          </span>
          <UiBadge v-if="item.group_name">{{ item.group_name }}</UiBadge>
        </div>
      </div>
      <UiStatusBadge :status="statusTone(item.primary_status)" :label="statusLabel(item.primary_status)" />
    </div>

    <MonitorMetricPair
      class="monitor-metrics"
      primary-icon="bolt"
      :primary-label="t('monitorCommon.dialogLatency')"
      :primary-value="formatLatency(item.primary_latency_ms)"
      primary-unit="ms"
      secondary-icon="globe"
      :secondary-label="t('monitorCommon.endpointPing')"
      :secondary-value="formatLatency(item.primary_ping_latency_ms)"
      secondary-unit="ms"
    />

    <MonitorAvailabilityRow
      class="monitor-availability"
      :window-label="availabilityLabel"
      :value="availabilityValue"
      :samples-label="extraModelsCountLabel"
    />

    <MonitorTimeline
      class="monitor-timeline"
      :buckets="item.timeline"
      :countdown-seconds="countdownSeconds"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserMonitorView } from '@/api/channelMonitor'
import { useChannelMonitorFormat } from '@/composables/useChannelMonitorFormat'
import { UiBadge, UiStatusBadge } from '@/components/ui'
import ProviderIcon from './ProviderIcon.vue'
import MonitorMetricPair from './MonitorMetricPair.vue'
import MonitorAvailabilityRow from './MonitorAvailabilityRow.vue'
import MonitorTimeline from './MonitorTimeline.vue'

const props = defineProps<{
  item: UserMonitorView
  window: '7d' | '15d' | '30d'
  availabilityValue: number | null
  countdownSeconds: number
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const { t } = useI18n()
const {
  statusLabel,
  providerLabel,
  formatLatency,
} = useChannelMonitorFormat()

function statusTone(status: string): string {
  if (status === 'operational') return 'online'
  if (status === 'degraded') return 'warning'
  if (status === 'failed') return 'failed'
  return 'error'
}

const availabilityLabel = computed(() => {
  const win = t(`channelStatus.windowTab.${props.window}`)
  return `${t('monitorCommon.availabilityPrefix')} · ${win}`
})

const extraModelsCountLabel = computed(() => {
  const count = props.item.extra_models?.length ?? 0
  if (count === 0) return undefined
  return t('monitorCommon.extraModelsCount', { n: count })
})
</script>

<style scoped>
.monitor-list-row {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 12px;
  padding: 12px;
  border: 0;
  border-bottom: 1px solid var(--ui-border-soft);
  color: var(--ui-text);
  background: var(--ui-surface);
  text-align: left;
  cursor: pointer;
  grid-template-areas:
    'identity'
    'metrics'
    'availability'
    'timeline';
}

.monitor-list-row:last-child { border-bottom: 0; }
.monitor-list-row:hover { background: var(--ui-surface-muted); }

.monitor-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.monitor-provider-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border: 1px solid var(--ui-border-soft);
  border-radius: var(--ui-radius);
  color: var(--ui-text-muted);
  background: var(--ui-surface-muted);
}

.monitor-identity__copy { min-width: 0; flex: 1; }
.monitor-name { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.monitor-meta { display: flex; min-width: 0; align-items: center; gap: 6px; margin-top: 4px; }
.monitor-model { overflow: hidden; color: var(--ui-text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }

.monitor-identity { grid-area: identity; }
.monitor-metrics { grid-area: metrics; }
.monitor-availability { grid-area: availability; }
.monitor-timeline { grid-area: timeline; }

@media (min-width: 768px) {
  .monitor-list-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'identity identity'
      'metrics availability'
      'timeline timeline';
  }
}

@media (min-width: 1024px) {
  .monitor-list-row {
    grid-template-columns: minmax(220px, 1.15fr) minmax(190px, 0.8fr) minmax(140px, 0.55fr) minmax(280px, 1.4fr);
    grid-template-areas: 'identity metrics availability timeline';
    align-items: center;
  }
}
</style>
