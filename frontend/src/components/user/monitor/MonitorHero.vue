<template>
  <AppPageHeader :title="t('channelStatus.title')" :description="t('channelStatus.description')">
    <template #status>
      <UiStatusBadge :status="overallStatusName" :label="overallLabel" />
    </template>
    <template #actions>
      <AppInline justify="flex-end">
        <UiSegmentedControl
          :model-value="window"
          :options="windowOptions"
          :label="t('channelStatus.title')"
          @update:model-value="emit('update:window', $event as MonitorWindow)"
        />
        <UiIconButton
          icon="refresh"
          :label="t('common.refresh')"
          :disabled="loading"
          @click="emit('refresh')"
        />
        <AutoRefreshButton
          v-if="autoRefresh"
          :enabled="autoRefresh.enabled.value"
          :interval-seconds="autoRefresh.intervalSeconds.value"
          :countdown="autoRefresh.countdown.value"
          :intervals="autoRefresh.intervals"
          @update:enabled="autoRefresh.setEnabled"
          @update:interval="autoRefresh.setInterval"
        />
      </AppInline>
    </template>
  </AppPageHeader>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoRefreshButton from '@/components/common/AutoRefreshButton.vue'
import {
  AppInline,
  AppPageHeader,
  UiIconButton,
  UiSegmentedControl,
  UiStatusBadge,
} from '@/components/ui'
export type MonitorWindow = '7d' | '15d' | '30d'
export type OverallStatus = 'operational' | 'degraded'

const props = defineProps<{
  overallStatus: OverallStatus
  intervalSeconds: number
  window: MonitorWindow
  loading: boolean
  autoRefresh?: {
    enabled: { value: boolean }
    intervalSeconds: { value: number }
    countdown: { value: number }
    intervals: readonly number[]
    setEnabled: (v: boolean) => void
    setInterval: (v: number) => void
  }
}>()

const emit = defineEmits<{
  (e: 'update:window', value: MonitorWindow): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()

const windowOptions = computed<{ value: MonitorWindow; label: string }[]>(() => [
  { value: '7d', label: t('channelStatus.windowTab.7d') },
  { value: '15d', label: t('channelStatus.windowTab.15d') },
  { value: '30d', label: t('channelStatus.windowTab.30d') },
])

const overallLabel = computed(() => t(`channelStatus.overall.${props.overallStatus}`))
const overallStatusName = computed(() => props.overallStatus === 'operational' ? 'online' : 'warning')
</script>
