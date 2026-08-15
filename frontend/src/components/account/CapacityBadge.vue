<script setup lang="ts">
import { computed } from 'vue'
import { UiBadge, UiTooltip } from '@/components/ui'

const props = withDefaults(defineProps<{
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  tooltip?: string
  current: string | number
  max: string | number
  suffix?: string
}>(), {
  tone: 'neutral',
  tooltip: '',
  suffix: ''
})

const accessibleLabel = computed(() =>
  props.tooltip || `${props.current} / ${props.max}${props.suffix ? ` ${props.suffix}` : ''}`
)
</script>

<template>
  <UiTooltip :content="accessibleLabel">
    <UiBadge :tone="tone">
      <slot />
      <span class="capacity-badge__number">{{ current }}</span>
      <span class="capacity-badge__separator">/</span>
      <span class="capacity-badge__number">{{ max }}</span>
      <span v-if="suffix" class="capacity-badge__suffix">{{ suffix }}</span>
    </UiBadge>
  </UiTooltip>
</template>

<style scoped>
.capacity-badge__number{font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums}.capacity-badge__separator{color:var(--ui-text-soft)}.capacity-badge__suffix{color:var(--ui-text-soft);font-size:9px}
</style>
