<template>
  <div class="monitor-timeline-root">
    <div class="monitor-timeline-head">
      <span>{{ t('monitorCommon.history60pts', { n: length }) }}</span>
      <span class="tabular-nums">{{ t('monitorCommon.nextUpdateIn', { n: countdownSeconds }) }}</span>
    </div>

    <div
      v-if="maintenance"
      class="monitor-timeline-maintenance"
    >
      {{ t('monitorCommon.maintenancePaused') }}
    </div>
    <div v-else class="monitor-timeline-bars">
      <div
        v-for="(bar, idx) in displayBars"
        :key="idx"
        class="monitor-timeline-bar"
        :class="bar.colorClass"
        :style="{ height: bar.heightPct + '%' }"
        :title="bar.title"
      ></div>
    </div>

    <div class="monitor-timeline-axis">
      <span>{{ t('monitorCommon.past') }}</span>
      <span>{{ t('monitorCommon.now') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MonitorTimelinePoint } from '@/api/channelMonitor'
import { useChannelMonitorFormat } from '@/composables/useChannelMonitorFormat'

const props = withDefaults(defineProps<{
  buckets?: MonitorTimelinePoint[]
  countdownSeconds: number
  length?: number
  maintenance?: boolean
}>(), {
  buckets: () => [],
  length: 60,
  maintenance: false,
})

const { t } = useI18n()
const { statusLabel, formatLatency, formatRelativeTime } = useChannelMonitorFormat()

interface Bar {
  colorClass: string
  heightPct: number
  title: string
}

// 4 级高度 + 颜色双重编码：高=好+绿，短=坏+红，灰=未测试。
// 长绿(正常) > 中黄(降级) > 短红(失败/系统错误) > 很短灰(未测试)。
const STATUS_HEIGHT: Record<string, number> = {
  operational: 100,
  degraded: 65,
  failed: 35,
  error: 35,
  empty: 15,
}

const STATUS_COLOR: Record<string, string> = {
  operational: 'is-operational',
  degraded: 'is-degraded',
  failed: 'is-failed',
  error: 'is-failed',
  empty: 'is-empty',
}

const displayBars = computed<Bar[]>(() => {
  // Real points come newest-first; convert to oldest-first so the rightmost
  // bar represents "now". Pad the left with empty placeholders to keep the
  // bar count stable at `length`.
  const real = [...(props.buckets ?? [])]
    .slice(0, props.length)
    .reverse()

  const padCount = Math.max(0, props.length - real.length)
  const bars: Bar[] = []

  for (let i = 0; i < padCount; i += 1) {
    bars.push({
      colorClass: STATUS_COLOR.empty,
      heightPct: STATUS_HEIGHT.empty,
      title: '',
    })
  }

  for (const point of real) {
    const status = point.status as keyof typeof STATUS_HEIGHT
    const colorClass = STATUS_COLOR[status] ?? STATUS_COLOR.empty
    const heightPct = STATUS_HEIGHT[status] ?? STATUS_HEIGHT.empty
    const latency = formatLatency(point.latency_ms)
    const relative = formatRelativeTime(point.checked_at)
    const label = statusLabel(point.status)
    bars.push({
      colorClass,
      heightPct,
      title: `${relative} · ${label} · ${latency}ms`,
    })
  }

  return bars
})
</script>

<style scoped>
.monitor-timeline-root { min-width: 0; }
.monitor-timeline-head,.monitor-timeline-axis { display: flex; justify-content: space-between; gap: 8px; color: var(--ui-text-soft); font-size: 9px; font-weight: 600; }
.monitor-timeline-head { margin-bottom: 6px; }
.monitor-timeline-axis { margin-top: 4px; font-size: 8px; }
.monitor-timeline-maintenance { display: flex; height: 12px; width: 100%; align-items: center; justify-content: center; border: 1px dashed var(--ui-border); border-radius: 3px; color: var(--ui-text-soft); font-size: 9px; }
.monitor-timeline-bars { display: flex; width: 100%; height: 12px; align-items: flex-end; gap: 1px; }
.monitor-timeline-bar { min-width: 1px; flex: 1; border-radius: 1px; background: var(--ui-text-soft); }
.monitor-timeline-bar.is-operational { background: var(--ui-success); }
.monitor-timeline-bar.is-degraded { background: var(--ui-warning); }
.monitor-timeline-bar.is-failed { background: var(--ui-danger); }
.monitor-timeline-bar.is-empty { background: var(--ui-border); }
</style>
