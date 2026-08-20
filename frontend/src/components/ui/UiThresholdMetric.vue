<template>
  <div class="ui-threshold">
    <header>
      <span>{{ label }}</span>
      <UiStatusBadge :status="tone" :label="statusLabel" />
    </header>
    <div class="ui-threshold__value">
      <strong class="ui-numeric">{{ displayValue }}</strong>
      <small v-if="hasValue">{{ unit }}</small>
      <slot name="trend" />
    </div>
    <UiProgressBar :value="percent" :tone="progressTone" :show-value="false" :aria-label="label" />
    <footer>
      <span>{{ thresholdLabel }} {{ threshold }}{{ unit }}</span>
      <span v-if="context">{{ context }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import UiProgressBar from './UiProgressBar.vue'
import UiStatusBadge from './UiStatusBadge.vue'

const props = withDefaults(defineProps<{
  label: string
  value?: number | null
  threshold: number
  max?: number
  unit?: string
  context?: string
  inverse?: boolean
  thresholdLabel?: string
  normalLabel?: string
  nearLabel?: string
  breachedLabel?: string
  noDataLabel?: string
}>(), {
  value: null,
  max: 100,
  unit: '',
  inverse: false,
  thresholdLabel: 'Threshold',
  normalLabel: 'Normal',
  nearLabel: 'Near threshold',
  breachedLabel: 'Threshold breached',
  noDataLabel: 'No data'
})

const hasValue = computed(() => typeof props.value === 'number' && Number.isFinite(props.value))
const breached = computed(() => hasValue.value && (props.inverse ? props.value! < props.threshold : props.value! >= props.threshold))
const near = computed(() => hasValue.value && Math.abs(props.value! - props.threshold) / Math.max(props.threshold, 1) < 0.15)
const tone = computed(() => !hasValue.value ? 'neutral' : breached.value ? 'danger' : near.value ? 'warning' : 'success')
const statusLabel = computed(() => !hasValue.value ? props.noDataLabel : breached.value ? props.breachedLabel : near.value ? props.nearLabel : props.normalLabel)
const progressTone = computed(() => tone.value === 'danger' ? 'danger' : tone.value === 'warning' ? 'warning' : 'neutral')
const percent = computed(() => !hasValue.value ? 0 : Math.min(100, Math.max(0, props.value! / props.max * 100)))
const displayValue = computed(() => hasValue.value ? props.value : '-')
</script>

<style scoped>
.ui-threshold{display:grid;gap:8px;padding:10px;border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius);background:var(--ui-surface)}
.ui-threshold header,.ui-threshold footer,.ui-threshold__value{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ui-threshold header>span{color:var(--ui-text-muted);font-size:12px}
.ui-threshold__value{justify-content:flex-start}
.ui-threshold__value strong{font-size:22px;font-weight:500}
.ui-threshold__value small{color:var(--ui-text-soft);font-size:11px}
.ui-threshold footer{color:var(--ui-text-soft);font-size:10px}
</style>
