<template>
  <div class="group-option-item">
    <!-- Left: name + description -->
    <div
      class="group-option-item__copy"
      :title="description || undefined"
    >
      <!-- Row 1: platform badge (name bold) -->
      <GroupBadge
        :name="name"
        :platform="platform"
        :show-rate="false"
        class="groupOptionItemBadge"
      />
      <!-- Row 2: description with top spacing -->
      <span
        v-if="description"
        class="group-option-item__description whitespace-pre-line [overflow-wrap:anywhere] line-clamp-2"
      >
        {{ description }}
      </span>
    </div>

    <!-- Right: rate pill + checkmark (vertically centered to first row) -->
    <div class="group-option-item__details">
      <div class="group-option-item__rates">
        <!-- Rate pill (platform color) -->
        <UiBadge v-if="rateMultiplier !== undefined">
          <template v-if="hasCustomRate">
            <span class="mr-1 line-through opacity-50">{{ rateMultiplier }}x</span>
            <span class="font-bold">{{ userRateMultiplier }}x</span>
          </template>
          <template v-else>
            {{ rateMultiplier }}x {{ t('admin.groups.rateLabel') }}
          </template>
        </UiBadge>
        <UiBadge
          v-if="hasPeakRate"
          tone="warning"
          :title="peakRateTitle"
        >
          {{ peakRateText }}
        </UiBadge>
      </div>
      <Icon v-if="showCheckmark && selected" name="check" size="sm" class="group-option-item__check" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GroupBadge from './GroupBadge.vue'
import Icon from '@/components/icons/Icon.vue'
import { UiBadge } from '@/components/ui'
import type { GroupPlatform } from '@/types'
import { useAppStore } from '@/stores/app'
import { formatPeakRateWindow, serverTimezoneLabel } from '@/utils/peak-rate'

const { t } = useI18n()

interface Props {
  name: string
  platform: GroupPlatform
  rateMultiplier?: number
  userRateMultiplier?: number | null
  peakRateEnabled?: boolean
  peakStart?: string
  peakEnd?: string
  peakRateMultiplier?: number
  description?: string | null
  selected?: boolean
  showCheckmark?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  showCheckmark: true,
  userRateMultiplier: null,
  peakRateEnabled: false
})

// Whether user has a custom rate different from default
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
  return Boolean(props.peakRateEnabled && props.peakStart && props.peakEnd)
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

</script>

<style scoped>
.group-option-item{display:flex;min-width:0;flex:1;align-items:flex-start;justify-content:space-between;gap:10px}
.group-option-item__copy{display:flex;min-width:0;flex:1;flex-direction:column;align-items:flex-start}
.group-option-item__description{width:100%;margin-top:4px;overflow:hidden;color:var(--ui-text-soft);font-size:11px;line-height:17px;text-align:left;white-space:pre-line;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.group-option-item__details{display:flex;flex:none;align-items:center;gap:7px;padding-top:2px}
.group-option-item__rates{display:flex;flex:none;flex-direction:column;align-items:flex-end;gap:4px}
.group-option-item__check{flex:none;color:var(--ui-success)}
.groupOptionItemBadge :deep(.group-badge__name) {
  font-weight: 600;
}
</style>
