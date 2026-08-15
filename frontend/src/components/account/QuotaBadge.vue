<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiBadge, UiTooltip } from '@/components/ui'

const props = defineProps<{
  used: number
  limit: number
  label?: string // 文字前缀，如 "D" / "W"；不传时显示 icon
}>()

const { t } = useI18n()

const tone = computed<'success' | 'warning' | 'danger'>(() => {
  if (props.used >= props.limit) {
    return 'danger'
  }
  if (props.used >= props.limit * 0.8) {
    return 'warning'
  }
  return 'success'
})

const tooltip = computed(() => {
  if (props.used >= props.limit) {
    return t('admin.accounts.capacity.quota.exceeded')
  }
  return t('admin.accounts.capacity.quota.normal')
})

const fmt = (v: number) => v.toFixed(2)
</script>

<template>
  <UiTooltip :content="tooltip">
    <UiBadge :tone="tone">
      <span v-if="label" class="quota-badge__label">{{ label }}</span>
      <Icon v-else name="dollar" size="xs" />
      <span class="quota-badge__number">${{ fmt(used) }}</span>
      <span class="quota-badge__separator">/</span>
      <span class="quota-badge__number">${{ fmt(limit) }}</span>
    </UiBadge>
  </UiTooltip>
</template>

<style scoped>
.quota-badge__label{color:var(--ui-text-muted);font-weight:700}.quota-badge__number{font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums}.quota-badge__separator{color:var(--ui-text-soft)}
</style>
