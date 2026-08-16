<template>
  <div
    class="ui-ring"
    :class="`ui-ring--${tone}`"
    :style="{ '--value': normalized, '--size': `${size}px` }"
    role="img"
    :aria-label="ariaLabel || `${label || ''} ${resolvedDisplayValue}`.trim()"
  >
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="16" />
      <circle class="ui-ring__value" cx="20" cy="20" r="16" />
    </svg>
    <span>
      <b class="ui-numeric">{{ resolvedDisplayValue }}</b>
      <small v-if="label">{{ label }}</small>
    </span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  label?: string
  size?: number
  displayValue?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  ariaLabel?: string
}>(), {
  size: 88,
  tone: 'neutral',
})

const normalized = computed(() => Math.round(Math.max(0, Math.min(100, props.value))))
const resolvedDisplayValue = computed(() => props.displayValue ?? `${normalized.value}%`)
</script>
<style scoped>
.ui-ring { position:relative; display:grid; width:var(--size); height:var(--size); place-items:center; color:var(--ui-text); }
.ui-ring svg { position:absolute; inset:0; transform:rotate(-90deg); }
.ui-ring circle { fill:none; stroke:var(--ui-surface-strong); stroke-width:3; }
.ui-ring__value { stroke:currentColor; stroke-dasharray:100; stroke-dashoffset:calc(100 - var(--value)); stroke-linecap:round; transition:stroke-dashoffset var(--ui-motion-slow); }
.ui-ring--success { color:var(--ui-success); }
.ui-ring--warning { color:var(--ui-warning); }
.ui-ring--danger { color:var(--ui-danger); }
.ui-ring--info { color:var(--ui-info); }
.ui-ring > span { display:grid; min-width:0; color:var(--ui-text); text-align:center; }
.ui-ring b { max-width:calc(var(--size) - 28px); overflow:hidden; font-size:16px; font-weight:600; line-height:20px; text-overflow:ellipsis; white-space:nowrap; }
.ui-ring small { color:var(--ui-text-soft); font-size:9px; line-height:14px; }
@media (prefers-reduced-motion: reduce) { .ui-ring__value { transition:none; } }
</style>
