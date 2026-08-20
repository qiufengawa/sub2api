<template>
  <UiFormField :for-id="resolvedId" :label="label" :description="description" :error="error">
    <UiPopover placement="bottom-start" panel-role="dialog" :aria-label="timePickerLabel">
      <template #trigger>
        <button
          type="button"
          :id="resolvedId"
          class="ui-time-trigger ui-focus-ring"
          :class="[`ui-time-trigger--${density}`, { 'is-empty': !modelValue, 'is-error': error }]"
          :disabled="disabled"
          :aria-describedby="error || description ? `${resolvedId}-message` : undefined"
          :aria-invalid="error ? 'true' : undefined"
        >
          <span>{{ modelValue || resolvedPlaceholder }}</span>
          <Icon name="clock" size="sm" />
        </button>
      </template>
      <template #default="{ close }">
        <div class="ui-time-panel ui-scale-enter" :aria-label="timePickerLabel">
          <div class="ui-time-panel__head"><span>{{ hoursLabel }}</span><span>{{ minutesLabel }}</span></div>
          <div class="ui-time-panel__columns">
            <div role="listbox" :aria-label="hoursLabel">
              <button v-for="hour in hours" :key="hour" type="button" role="option" :aria-selected="hour === selectedHour" :class="{ 'is-selected': hour === selectedHour }" @click="selectHour(hour)">{{ hour }}</button>
            </div>
            <div role="listbox" :aria-label="minutesLabel">
              <button v-for="minute in minutes" :key="minute" type="button" role="option" :aria-selected="minute === selectedMinute" :class="{ 'is-selected': minute === selectedMinute }" @click="selectMinute(minute)">{{ minute }}</button>
            </div>
          </div>
          <footer><button type="button" @click="setNow">{{ nowLabel }}</button><button type="button" class="is-primary" @click="close">{{ confirmLabel }}</button></footer>
        </div>
      </template>
    </UiPopover>
  </UiFormField>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiFormField from './UiFormField.vue'
import UiPopover from './UiPopover.vue'
import type { UiDensity } from './types'
import { useUiT } from './useUiI18n'

const props = withDefaults(defineProps<{
  modelValue: string
  id?: string
  label?: string
  description?: string
  error?: string
  placeholder?: string
  density?: UiDensity
  minuteStep?: number
  disabled?: boolean
}>(), { density: 'default', minuteStep: 5 })
const resolvedId = props.id || `ui-time-${useId()}`
const emit = defineEmits<{ 'update:modelValue': [string] }>()
const t = useUiT()
const resolvedPlaceholder = computed(() => props.placeholder || t('common.timePicker'))
const timePickerLabel = computed(() => props.label || t('common.timePicker'))
const hoursLabel = computed(() => t('common.hours'))
const minutesLabel = computed(() => t('common.minutesLabel'))
const nowLabel = computed(() => t('common.now'))
const confirmLabel = computed(() => t('common.confirm'))
const hours = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, '0'))
const safeMinuteStep = computed(() => Number.isFinite(props.minuteStep) && props.minuteStep > 0 ? Math.min(60, Math.floor(props.minuteStep)) : 5)
const minutes = computed(() => Array.from({ length: Math.ceil(60 / safeMinuteStep.value) }, (_, index) => String(index * safeMinuteStep.value).padStart(2, '0')).filter(value => Number(value) < 60))
const selectedHour = computed(() => props.modelValue?.split(':')[0] || '09')
const selectedMinute = computed(() => props.modelValue?.split(':')[1] || '00')
function update(hour: string, minute: string) { emit('update:modelValue', `${hour}:${minute}`) }
function selectHour(hour: string) { update(hour, selectedMinute.value) }
function selectMinute(minute: string) { update(selectedHour.value, minute) }
function setNow() { const now = new Date(); const minute = Math.floor(now.getMinutes() / safeMinuteStep.value) * safeMinuteStep.value; update(String(now.getHours()).padStart(2, '0'), String(minute).padStart(2, '0')) }
</script>

<style scoped>
.ui-time-trigger{display:flex;width:100%;height:var(--ui-control-default);align-items:center;justify-content:space-between;gap:8px;padding:0 11px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);font-size:13px;text-align:left;transition:border-color var(--ui-motion-fast),box-shadow var(--ui-motion-fast),background var(--ui-motion-fast)}.ui-time-trigger:hover:not(:disabled){border-color:var(--ui-text-soft)}.ui-time-trigger:focus-visible{border-color:var(--ui-focus);outline:0;box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-focus) 16%,transparent)}.ui-time-trigger.is-empty{color:var(--ui-text-soft)}.ui-time-trigger.is-error{border-color:var(--ui-danger)}.ui-time-trigger:disabled{cursor:not-allowed;background:var(--ui-surface-muted);opacity:.65}.ui-time-trigger--mini{height:var(--ui-control-mini)}.ui-time-trigger--dense{height:var(--ui-control-dense)}.ui-time-trigger--compact{height:var(--ui-control-compact)}.ui-time-trigger--default{height:var(--ui-control-default)}.ui-time-trigger--large{height:var(--ui-control-large)}.ui-time-panel{width:220px}.ui-time-panel__head{display:grid;grid-template-columns:1fr 1fr;padding:4px 4px 6px;color:var(--ui-text-soft);font-size:11px;text-align:center}.ui-time-panel__columns{display:grid;height:190px;grid-template-columns:1fr 1fr;border-block:1px solid var(--ui-border-soft)}.ui-time-panel__columns>div{padding:4px;overflow:auto;scrollbar-width:thin}.ui-time-panel__columns>div+div{border-left:1px solid var(--ui-border-soft)}.ui-time-panel__columns button{display:block;width:100%;height:28px;border:0;border-radius:4px;color:var(--ui-text-muted);background:transparent;font-size:12px;font-variant-numeric:tabular-nums}.ui-time-panel__columns button:hover{background:var(--ui-surface-muted)}.ui-time-panel__columns button.is-selected{color:var(--ui-text);background:var(--ui-surface-strong);font-weight:600}.ui-time-panel footer{display:flex;justify-content:space-between;padding:6px 4px 0}.ui-time-panel footer button{height:28px;padding:0 9px;border:0;border-radius:4px;color:var(--ui-text-muted);background:transparent}.ui-time-panel footer button:hover{background:var(--ui-surface-muted)}.ui-time-panel footer button.is-primary{color:var(--ui-inverse);background:var(--ui-text)}
</style>
