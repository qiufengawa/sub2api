<template>
  <span class="group-badge" :data-platform="platform || 'default'">
    <PlatformIcon v-if="platform" :platform="platform" size="sm" />
    <span class="group-badge__name">{{ name }}</span>
    <UiBadge v-if="showLabel" class="group-badge__rate">
      <template v-if="hasCustomRate">
        <span class="group-badge__old-rate">{{ rateMultiplier }}x</span>
        <strong>{{ userRateMultiplier }}x</strong>
      </template>
      <template v-else>{{ labelText }}</template>
    </UiBadge>
    <UiBadge v-if="hasPeakRate" tone="warning" :title="peakRateTitle">{{ peakRateText }}</UiBadge>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { GroupPlatform } from '@/types'
import { useAppStore } from '@/stores/app'
import { formatPeakRateWindow, serverTimezoneLabel } from '@/utils/peak-rate'
import PlatformIcon from './PlatformIcon.vue'
import { UiBadge } from '@/components/ui'

interface Props {
  name: string
  platform?: GroupPlatform
  rateMultiplier?: number
  userRateMultiplier?: number | null // 用户专属倍率
  peakRateEnabled?: boolean
  peakStart?: string
  peakEnd?: string
  peakRateMultiplier?: number
  showRate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showRate: true,
  userRateMultiplier: null,
  peakRateEnabled: false
})

const { t } = useI18n()

// 是否有专属倍率（且与默认倍率不同）
const hasCustomRate = computed(() => {
  return (
    props.userRateMultiplier !== null &&
    props.userRateMultiplier !== undefined &&
    props.rateMultiplier !== undefined &&
    props.userRateMultiplier !== props.rateMultiplier
  )
})

const appStore = useAppStore()

const hasPeakRate = computed(() => {
  return Boolean(props.showRate && props.peakRateEnabled && props.peakStart && props.peakEnd)
})

const peakRateText = computed(() => {
  return formatPeakRateWindow(
    {
      peak_rate_enabled: props.peakRateEnabled,
      peak_start: props.peakStart,
      peak_end: props.peakEnd,
      peak_rate_multiplier: props.peakRateMultiplier
    },
    serverTimezoneLabel(appStore.cachedPublicSettings?.server_utc_offset)
  )
})

const peakRateTitle = computed(() => {
  return t('common.peakRateTooltip', { window: peakRateText.value })
})

// 是否显示右侧标签
const showLabel = computed(() => {
  if (!props.showRate) return false
  return props.rateMultiplier !== undefined || hasCustomRate.value
})

const labelText = computed(() => {
  return props.rateMultiplier !== undefined ? `${props.rateMultiplier}x` : ''
})

</script>

<style scoped>
.group-badge{display:inline-flex;min-width:0;align-items:center;gap:6px;color:var(--ui-text);font-size:12px;font-weight:500;line-height:20px}
.group-badge__name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.group-badge__rate{font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums}
.group-badge__old-rate{color:var(--ui-text-soft);text-decoration:line-through}
.group-badge__rate strong{color:var(--ui-text);font-weight:600}
</style>
