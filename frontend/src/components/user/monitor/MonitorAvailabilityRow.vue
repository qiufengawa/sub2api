<template>
  <div class="flex min-w-0 items-center justify-between gap-3 border-y border-gray-100 py-2 md:border-y-0 md:py-0 dark:border-dark-700/60">
    <div class="min-w-0">
      <div class="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400" :title="windowLabel">
        {{ windowLabel }}
      </div>
      <div v-if="samplesLabel" class="mt-1 truncate text-[10px] text-gray-400" :title="samplesLabel">
        {{ samplesLabel }}
      </div>
    </div>
    <div class="flex shrink-0 items-baseline gap-0.5">
      <span
        class="text-lg font-bold tabular-nums leading-none"
        :style="colorStyle"
      >
        {{ displayValue }}
      </span>
      <span
        class="text-xs font-semibold leading-none"
        :style="colorStyle"
      >%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { hslForPct } from '@/composables/useChannelMonitorFormat'

const props = defineProps<{
  windowLabel: string
  value: number | null
  samplesLabel?: string
}>()

const { t } = useI18n()

const displayValue = computed(() => {
  if (props.value === null || Number.isNaN(props.value)) return t('monitorCommon.latencyEmpty')
  return props.value.toFixed(2)
})

const colorStyle = computed(() => {
  const colour = hslForPct(props.value)
  return colour ? { color: colour } : { color: 'rgb(156 163 175)' }
})
</script>
