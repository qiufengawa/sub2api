<template>
  <span
    class="ui-skeleton"
    :class="`ui-skeleton--${variant}`"
    :style="skeletonStyle"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'rect' | 'circle' | 'text'
  width?: string | number
  height?: string | number
}>(), { variant: 'rect', width: '100%' })

function dimension(value: string | number | undefined): string | undefined {
  return typeof value === 'number' ? `${value}px` : value
}

const skeletonStyle = computed(() => ({
  width: dimension(props.width),
  height: dimension(props.height) ?? (props.variant === 'text' ? '1em' : undefined)
}))
</script>

<style scoped>
.ui-skeleton{display:inline-block;max-width:100%;border-radius:var(--ui-radius-dense);background:linear-gradient(90deg,var(--ui-surface-strong) 25%,var(--ui-surface-muted) 50%,var(--ui-surface-strong) 75%);background-size:200% 100%;animation:ui-skeleton-shimmer 1.4s ease-in-out infinite}.ui-skeleton--circle{aspect-ratio:1;border-radius:50%}.ui-skeleton--text{margin-block:.25em;border-radius:3px}@keyframes ui-skeleton-shimmer{to{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.ui-skeleton{animation:none;background:var(--ui-surface-strong)}}
</style>
