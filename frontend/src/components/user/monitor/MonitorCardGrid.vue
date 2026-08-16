<template>
  <div class="monitor-list">
    <div v-if="loading && items.length === 0" class="monitor-list__skeleton" aria-hidden="true">
      <div v-for="i in 6" :key="i" class="monitor-list__skeleton-row">
        <UiSkeleton variant="circle" width="28px" height="28px" />
        <UiSkeleton variant="text" width="36%" />
        <UiSkeleton variant="text" width="18%" />
        <UiSkeleton variant="text" width="24%" />
      </div>
    </div>

    <UiEmptyState
      v-else-if="items.length === 0"
      :title="t('channelStatus.empty.title')"
      :description="t('channelStatus.empty.description')"
    />

    <div v-else class="monitor-list__rows" role="list">
      <MonitorCard
        v-for="item in items"
        :key="item.id"
        :item="item"
        :window="window"
        :availability-value="resolveAvailability(item)"
        :countdown-seconds="countdownSeconds"
        @click="emit('cardClick', item)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UserMonitorView, UserMonitorDetail } from '@/api/channelMonitor'
import { UiEmptyState, UiSkeleton } from '@/components/ui'
import MonitorCard from './MonitorCard.vue'

const props = defineProps<{
  items: UserMonitorView[]
  window: '7d' | '15d' | '30d'
  countdownSeconds: number
  loading: boolean
  detailCache: Record<number, UserMonitorDetail>
}>()

const emit = defineEmits<{
  (e: 'cardClick', item: UserMonitorView): void
}>()

const { t } = useI18n()

function resolveAvailability(item: UserMonitorView): number | null {
  if (props.window === '7d') {
    return item.availability_7d ?? null
  }
  const detail = props.detailCache[item.id]
  if (!detail) return null
  const primary = detail.models.find(m => m.model === item.primary_model)
  if (!primary) return null
  return props.window === '15d' ? primary.availability_15d ?? null : primary.availability_30d ?? null
}
</script>

<style scoped>
.monitor-list {
  min-width: 0;
  border: 1px solid var(--ui-border-soft);
  border-radius: var(--ui-radius-panel);
  background: var(--ui-surface);
}

.monitor-list__rows,
.monitor-list__skeleton {
  min-width: 0;
}

.monitor-list__skeleton-row {
  display: grid;
  min-height: 76px;
  grid-template-columns: 28px minmax(160px, 1fr) minmax(90px, .35fr) minmax(160px, .75fr);
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.monitor-list__skeleton-row:last-child {
  border-bottom: 0;
}

@media (max-width: 640px) {
  .monitor-list__skeleton-row {
    grid-template-columns: 28px minmax(120px, 1fr) 72px;
  }

  .monitor-list__skeleton-row > :last-child {
    display: none;
  }
}
</style>
