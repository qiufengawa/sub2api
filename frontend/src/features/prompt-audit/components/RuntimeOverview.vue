<template>
  <AppSection :title="t('admin.promptAudit.runtime.title')" :description="t('admin.promptAudit.runtime.description')" divided>
    <template #actions>
      <UiButton density="dense" :loading="loading" @click="emit('refresh')">
        {{ t('admin.promptAudit.actions.refresh') }}
      </UiButton>
    </template>

    <UiAlert v-if="error" tone="danger" :message="error" />
    <div v-else-if="loading && !runtime" class="prompt-runtime__skeletons" aria-busy="true">
      <UiSkeleton v-for="index in 6" :key="index" height="72px" />
    </div>
    <template v-else-if="runtime">
      <div class="prompt-runtime__status-grid">
        <UiStatMetric v-for="item in statusItems" :key="item.label" :label="item.label" :value="item.value">
          <template v-if="item.status" #status>
            <UiStatusBadge :status="item.status" :label="item.value" />
          </template>
        </UiStatMetric>
      </div>

      <div class="prompt-runtime__details">
        <section class="prompt-runtime__metrics">
          <h3>{{ t('admin.promptAudit.runtime.guardMetrics') }}</h3>
          <div>
            <UiStatMetric v-for="metric in guardMetricItems" :key="metric.label" :label="metric.label" :value="metric.value" />
          </div>
          <p>
            {{ t('admin.promptAudit.runtime.queueBreakdown', {
              queued: runtime.queue.queued,
              processing: runtime.queue.processing,
              retry: runtime.queue.retry,
              done: runtime.queue.done,
              failed: runtime.queue.failed,
            }) }}
            <span>·</span>
            {{ t('admin.promptAudit.runtime.deliveryTotals', { enqueued: runtime.enqueued_total, dropped: runtime.dropped_total, processed: runtime.processed_total, failed: runtime.failed_total }) }}
          </p>
        </section>
        <section class="prompt-runtime__latest">
          <h3>{{ t('admin.promptAudit.runtime.latest') }}</h3>
          <p>{{ runtime.last_processed_at ? formatDate(runtime.last_processed_at) : t('admin.promptAudit.common.never') }}</p>
          <UiAlert v-if="runtime.last_error_code" tone="danger" :message="`${runtime.last_error_code}${runtime.last_error_message ? ` · ${runtime.last_error_message}` : ''}`" />
          <div v-if="Object.keys(runtime.endpoints).length" class="prompt-runtime__endpoints">
            <UiStatusBadge
              v-for="(probe, id) in runtime.endpoints"
              :key="id"
              :status="probe.ok ? 'healthy' : 'failed'"
              :label="`${id} · ${probe.status} · ${probe.latency_ms} ms`"
            />
          </div>
        </section>
      </div>
    </template>
  </AppSection>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppSection, UiAlert, UiButton, UiSkeleton, UiStatMetric, UiStatusBadge } from '@/components/ui'
import type { PromptAuditRuntime } from '../types'

const props = defineProps<{ runtime: PromptAuditRuntime | null; loading: boolean; error: string }>()
const emit = defineEmits<{ (event: 'refresh'): void }>()
const { t, locale } = useI18n()

const statusItems = computed(() => {
  const runtime = props.runtime
  if (!runtime) return []
  return [
    { label: t('admin.promptAudit.runtime.process'), value: t(`admin.promptAudit.status.${runtime.process_status}`), status: processStatus(runtime.process_status) },
    { label: t('admin.promptAudit.runtime.mode'), value: t(`admin.promptAudit.mode.${runtime.effective_mode}`) },
    { label: t('admin.promptAudit.runtime.version'), value: `${runtime.active_config_version} / ${runtime.expected_config_version}` },
    { label: t('admin.promptAudit.runtime.workers'), value: `${runtime.worker_active} / ${runtime.worker_total}` },
    { label: t('admin.promptAudit.runtime.queue'), value: `${runtime.queue.active} / ${runtime.queue_capacity}` },
    { label: t('admin.promptAudit.runtime.dependencies'), value: `DB ${runtime.database_status} · Redis ${runtime.redis_status}` },
  ]
})
const guardMetricItems = computed(() => {
  const metrics = props.runtime?.guard_metrics
  if (!metrics) return []
  return [
    { label: t('admin.promptAudit.metrics.total'), value: metrics.total },
    { label: t('admin.promptAudit.metrics.allowed'), value: metrics.allowed },
    { label: t('admin.promptAudit.metrics.flagged'), value: metrics.flagged },
    { label: t('admin.promptAudit.metrics.blocked'), value: metrics.blocked },
    { label: t('admin.promptAudit.metrics.unavailable'), value: metrics.unavailable },
    { label: t('admin.promptAudit.metrics.timeouts'), value: metrics.timeouts },
    { label: t('admin.promptAudit.metrics.failovers'), value: metrics.failovers },
    { label: 'P95', value: metrics.latency_p95_ms != null ? `${metrics.latency_p95_ms} ms` : '—' },
  ]
})

function processStatus(status: string): string {
  if (status === 'running') return 'running'
  if (status === 'degraded') return 'warning'
  if (status === 'disabled') return 'neutral'
  return 'failed'
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}
</script>

<style scoped>
.prompt-runtime__skeletons,.prompt-runtime__status-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
.prompt-runtime__details{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(240px,.55fr);gap:16px;margin-top:16px}
.prompt-runtime__metrics,.prompt-runtime__latest{min-width:0;padding:16px;border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius-panel)}
.prompt-runtime__metrics h3,.prompt-runtime__latest h3{margin:0 0 12px;color:var(--ui-text);font-size:13px;font-weight:600}
.prompt-runtime__metrics>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.prompt-runtime__metrics>p,.prompt-runtime__latest>p{margin:12px 0 0;color:var(--ui-text-muted);font-size:11px;line-height:18px}
.prompt-runtime__metrics>p span{margin-inline:6px;color:var(--ui-text-soft)}
.prompt-runtime__latest{display:flex;flex-direction:column;gap:10px}.prompt-runtime__latest>h3,.prompt-runtime__latest>p{margin:0}
.prompt-runtime__endpoints{display:flex;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:6px}
@media(max-width:1100px){.prompt-runtime__skeletons,.prompt-runtime__status-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:760px){.prompt-runtime__details{grid-template-columns:1fr}.prompt-runtime__metrics>div{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.prompt-runtime__skeletons,.prompt-runtime__status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
