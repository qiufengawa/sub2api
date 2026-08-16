<template>
  <div class="monitor-availability-row">
    <div class="monitor-availability-row__copy">
      <div class="monitor-availability-row__label" :title="windowLabel">
        {{ windowLabel }}
      </div>
      <div v-if="samplesLabel" class="monitor-availability-row__meta" :title="samplesLabel">
        {{ samplesLabel }}
      </div>
    </div>
    <div class="monitor-availability-row__value ui-numeric" :class="valueTone">
      <span>
        {{ displayValue }}
      </span>
      <small>%</small>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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

const valueTone = computed(() => {
  if (props.value == null || Number.isNaN(props.value)) return 'is-neutral'
  if (props.value >= 99) return 'is-success'
  if (props.value >= 95) return 'is-warning'
  return 'is-danger'
})
</script>

<style scoped>
.monitor-availability-row { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 12px; }
.monitor-availability-row__copy { min-width: 0; }
.monitor-availability-row__label,.monitor-availability-row__meta { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.monitor-availability-row__label { color: var(--ui-text-soft); font-size: 10px; font-weight: 600; }
.monitor-availability-row__meta { margin-top: 4px; color: var(--ui-text-soft); font-size: 10px; }
.monitor-availability-row__value { display: flex; flex: none; align-items: baseline; gap: 2px; color: var(--ui-text-soft); }
.monitor-availability-row__value span { font-size: 18px; font-weight: 650; line-height: 1; }
.monitor-availability-row__value small { font-size: 11px; font-weight: 600; }
.monitor-availability-row__value.is-success { color: var(--ui-success); }
.monitor-availability-row__value.is-warning { color: var(--ui-warning); }
.monitor-availability-row__value.is-danger { color: var(--ui-danger); }
</style>
