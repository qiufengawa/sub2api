<template>
  <UiFormField :for-id="resolvedId" :label="label" :description="description" :error="error" :required="required">
    <UiSelectControl
      v-bind="$attrs"
      :id="resolvedId"
      :model-value="modelValue"
      :options="options"
      :placeholder="placeholder"
      :disabled="disabled"
      :error="Boolean(error)"
      :searchable="searchable"
      :search-placeholder="searchPlaceholder"
      :empty-text="emptyText"
      :value-key="valueKey"
      :label-key="labelKey"
      :creatable="creatable"
      :creatable-prefix="creatablePrefix"
      :clearable="clearable"
      :density="density"
      :aria-label="label"
      :aria-describedby="description || error ? `${resolvedId}-message` : undefined"
      @update:model-value="emit('update:modelValue', $event)"
      @change="onChange"
    >
      <template v-if="$slots.selected" #selected="scope"><slot name="selected" v-bind="scope" /></template>
      <template v-if="$slots.option" #option="scope"><slot name="option" v-bind="scope" /></template>
    </UiSelectControl>
  </UiFormField>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiFormField from './UiFormField.vue'
import UiSelectControl from './internal/UiSelectControl.vue'
import type { UiDensity } from './types'
import type { SelectOption, SelectOptionLike, SelectValue } from './selectTypes'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue: SelectValue | undefined
  options: SelectOptionLike[]
  id?: string
  label?: string
  description?: string
  error?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  searchable?: boolean | 'auto'
  searchPlaceholder?: string
  emptyText?: string
  valueKey?: string
  labelKey?: string
  creatable?: boolean
  creatablePrefix?: string
  clearable?: boolean
  density?: UiDensity
}>(), {
  disabled: false,
  searchable: 'auto',
  creatable: false,
  creatablePrefix: '',
  clearable: false,
  valueKey: 'value',
  labelKey: 'label',
  density: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [SelectValue]
  change: [SelectValue, SelectOption | null]
}>()

const resolvedId = computed(() => props.id || `ui-select-${Math.random().toString(36).slice(2, 9)}`)

function onChange(value: SelectValue, option: SelectOption | null): void {
  emit('change', value, option)
}
</script>
