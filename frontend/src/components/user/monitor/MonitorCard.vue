<template>
  <button
    type="button"
    class="monitor-list-row group grid w-full gap-3 border-b border-gray-100 bg-white p-3 text-left transition-colors hover:bg-primary-50/30 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/30 dark:border-dark-700 dark:bg-dark-800 dark:hover:bg-primary-900/10"
    @click="emit('click')"
  >
    <div class="monitor-identity flex min-w-0 items-center gap-3">
      <span
        class="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[4px] ring-1 ring-black/5 dark:ring-white/10"
        :class="[providerGradient(item.provider), providerTintClass]"
      >
        <ProviderIcon :provider="item.provider" :size="20" />
      </span>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100" :title="item.name">
          {{ item.name }}
        </div>
        <div class="mt-1 flex min-w-0 items-center gap-1.5">
          <span
            class="inline-flex flex-shrink-0 items-center rounded-[3px] px-1.5 py-0.5 text-[10px] font-medium"
            :class="providerBadgeClass(item.provider)"
          >
            {{ providerLabel(item.provider) }}
          </span>
          <span class="truncate font-mono text-xs text-gray-500 dark:text-gray-400" :title="item.primary_model">
            {{ item.primary_model }}
          </span>
          <span
            v-if="item.group_name"
            class="inline-flex flex-shrink-0 items-center rounded-[3px] bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-dark-700 dark:text-gray-300"
          >
            {{ item.group_name }}
          </span>
        </div>
      </div>
      <span
        class="flex-shrink-0 rounded-[3px] px-2 py-1 text-[11px] font-semibold"
        :class="statusBadgeClass(item.primary_status)"
      >
        {{ statusLabel(item.primary_status) }}
      </span>
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
import {
  useChannelMonitorFormat,
  providerGradient,
} from '@/composables/useChannelMonitorFormat'
import ProviderIcon from './ProviderIcon.vue'
import MonitorMetricPair from './MonitorMetricPair.vue'
import MonitorAvailabilityRow from './MonitorAvailabilityRow.vue'
import MonitorTimeline from './MonitorTimeline.vue'

const PROVIDER_TINT: Record<string, string> = {
  openai: 'text-emerald-600 dark:text-emerald-300',
  anthropic: 'text-orange-600 dark:text-orange-300',
  gemini: 'text-sky-600 dark:text-sky-300',
  grok: 'text-zinc-700 dark:text-zinc-200',
}

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
  statusBadgeClass,
  providerLabel,
  providerBadgeClass,
  formatLatency,
} = useChannelMonitorFormat()

const providerTintClass = computed(() =>
  PROVIDER_TINT[props.item.provider] ?? 'text-gray-500 dark:text-gray-300'
)

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
  grid-template-areas:
    'identity'
    'metrics'
    'availability'
    'timeline';
}

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
