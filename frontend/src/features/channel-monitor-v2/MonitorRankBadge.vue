<template>
  <UiBadge :tone="rankTone" :title="titleText">
    <Icon v-if="showTrophy" name="trophy" size="xs" aria-hidden="true" />
    <span v-if="showTrophy" class="sr-only">{{ ariaLabel }}</span>
    <span class="ui-numeric">{{ label }}</span>
  </UiBadge>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiBadge } from '@/components/ui'

const { t } = useI18n()

const props = defineProps<{
  rank: number | null | undefined
}>()

const rankNum = computed(() => {
  const n = Number(props.rank)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null
})

const showTrophy = computed(
  () => rankNum.value != null && rankNum.value >= 1 && rankNum.value <= 3,
)

const label = computed(() => {
  if (rankNum.value == null || rankNum.value <= 0) return '—'
  return `#${rankNum.value}`
})

const ariaLabel = computed(() => {
  if (rankNum.value == null || rankNum.value <= 0) return t('channelMonitorV2.rank.unranked')
  if (rankNum.value === 1) return t('channelMonitorV2.rank.gold')
  if (rankNum.value === 2) return t('channelMonitorV2.rank.silver')
  if (rankNum.value === 3) return t('channelMonitorV2.rank.bronze')
  return t('channelMonitorV2.rank.place', { n: rankNum.value })
})

const titleText = computed(() => ariaLabel.value)
const rankTone = computed<'neutral' | 'warning' | 'info'>(() => {
  if (rankNum.value === 1) return 'warning'
  if (rankNum.value === 2) return 'info'
  return 'neutral'
})
</script>
