<template>
  <UiDropdownMenu :items="menuItems" placement="bottom-end" @select="handleSelect">
    <template #trigger>
      <UiButton density="dense" :aria-label="t('common.autoRefresh.title')">
        <template #icon><Icon name="refresh" size="sm" :class="{ 'auto-refresh__spin': enabled }" /></template>
        {{ enabled ? t('common.autoRefresh.countdown', { seconds: countdown }) : t('common.autoRefresh.title') }}
      </UiButton>
    </template>
  </UiDropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiDropdownMenu, type UiMenuItem } from '@/components/ui'

const props = defineProps<{
  enabled: boolean
  intervalSeconds: number
  countdown: number
  intervals: readonly number[]
}>()

const emit = defineEmits<{
  'update:enabled': [value: boolean]
  'update:interval': [value: number]
}>()

const { t } = useI18n()
const menuItems = computed<UiMenuItem[]>(() => [
  {
    key: 'toggle',
    label: t('common.autoRefresh.enable'),
    icon: props.enabled ? ('check' as const) : undefined,
  },
  ...props.intervals.map((seconds) => ({
    key: `interval:${seconds}`,
    label: t('common.autoRefresh.seconds', { n: seconds }),
    icon: props.intervalSeconds === seconds ? ('check' as const) : undefined,
  })),
])

function handleSelect(item: UiMenuItem) {
  if (item.key === 'toggle') {
    emit('update:enabled', !props.enabled)
    return
  }
  const seconds = Number(item.key.split(':')[1])
  if (Number.isFinite(seconds)) emit('update:interval', seconds)
}
</script>

<style scoped>
.auto-refresh__spin{animation:auto-refresh-spin 1s linear infinite}
@keyframes auto-refresh-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.auto-refresh__spin{animation:none}}
</style>
