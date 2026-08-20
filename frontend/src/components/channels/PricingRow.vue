<template>
  <div class="pricing-row">
    <span class="pricing-row__label">{{ label }}</span>
    <span class="pricing-row__value">{{ display }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatScaled } from '@/utils/pricing'

const props = withDefaults(
  defineProps<{
    label: string
    value: number | null
    unit: string
    scale: number
  }>(),
  { value: null }
)

const display = computed(() =>
  props.value == null ? '-' : `${formatScaled(props.value, props.scale)} ${props.unit}`
)
</script>

<style scoped>
.pricing-row { display: flex; min-width: 0; align-items: baseline; justify-content: space-between; gap: 12px; }
.pricing-row__label { min-width: 0; overflow: hidden; color: var(--ui-text-muted); text-overflow: ellipsis; white-space: nowrap; }
.pricing-row__value { min-width: 0; color: var(--ui-text); font-family: var(--ui-font-mono); font-variant-numeric: tabular-nums; text-align: right; }
</style>
