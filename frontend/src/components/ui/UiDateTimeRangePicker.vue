<template>
  <UiFormField :for-id="`${fieldId}-start-date`" :label="label">
    <div class="ui-datetime-range">
      <div>
        <span>{{ startLabel }}</span>
        <UiDateInput :id="`${fieldId}-start-date`" :label="startDateLabel" :description="description" :error="error" :model-value="startDate" @update:model-value="emit('update:startDate', $event)" />
        <UiTimeInput :id="`${fieldId}-start-time`" :label="startTimeLabel" :model-value="startTime" @update:model-value="emit('update:startTime', $event)" />
      </div>
      <Icon name="arrowRight" size="sm" aria-hidden="true" />
      <div>
        <span>{{ endLabel }}</span>
        <UiDateInput :id="`${fieldId}-end-date`" :label="endDateLabel" :model-value="endDate" @update:model-value="emit('update:endDate', $event)" />
        <UiTimeInput :id="`${fieldId}-end-time`" :label="endTimeLabel" :model-value="endTime" @update:model-value="emit('update:endTime', $event)" />
      </div>
    </div>
    <div v-if="presets.length" class="ui-datetime-range__presets"><UiButton v-for="preset in presets" :key="preset.value" density="mini" variant="quiet" @click="emit('preset', preset.value)">{{ preset.label }}</UiButton></div>
  </UiFormField>
</template>

<script setup lang="ts">
import { toRefs, useId } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiButton from './UiButton.vue'
import UiDateInput from './UiDateInput.vue'
import UiFormField from './UiFormField.vue'
import UiTimeInput from './UiTimeInput.vue'

const props = withDefaults(defineProps<{
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  id?: string
  label?: string
  description?: string
  error?: string
  startLabel?: string
  endLabel?: string
  startDateLabel?: string
  startTimeLabel?: string
  endDateLabel?: string
  endTimeLabel?: string
  presets?: { label: string; value: string }[]
}>(), {
  startLabel: '开始',
  endLabel: '结束',
  startDateLabel: '开始日期',
  startTimeLabel: '开始时间',
  endDateLabel: '结束日期',
  endTimeLabel: '结束时间',
  presets: () => [{ label: '最近 1 小时', value: '1h' }, { label: '今天', value: 'today' }, { label: '最近 7 天', value: '7d' }],
})
const fieldId = props.id || `ui-datetime-range-${useId()}`
const { startDate, startTime, endDate, endTime, label, description, error, startLabel, endLabel, startDateLabel, startTimeLabel, endDateLabel, endTimeLabel, presets } = toRefs(props)
const emit = defineEmits<{ 'update:startDate': [string]; 'update:startTime': [string]; 'update:endDate': [string]; 'update:endTime': [string]; preset: [string] }>()
</script>

<style scoped>.ui-datetime-range{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:8px}.ui-datetime-range>div{display:grid;grid-template-columns:auto minmax(120px,1fr) minmax(95px,.65fr);align-items:center;gap:6px}.ui-datetime-range>div>span{color:var(--ui-text-soft);font-size:11px}.ui-datetime-range__presets{display:flex;gap:3px;margin-top:4px}@media(max-width:700px){.ui-datetime-range{grid-template-columns:1fr}.ui-datetime-range>svg{display:none}.ui-datetime-range>div{grid-template-columns:38px minmax(0,1fr) minmax(90px,.6fr)}}</style>
