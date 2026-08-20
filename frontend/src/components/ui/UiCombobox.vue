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
      searchable
      :search-placeholder="searchPlaceholder"
      :empty-text="emptyText"
      :value-key="valueKey"
      :label-key="labelKey"
      :creatable="creatable"
      :creatable-prefix="creatablePrefix"
      :clearable="clearable"
      :density="density"
      :aria-label="ariaLabel || label"
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
  ariaLabel?: string
  description?: string
  error?: string
  required?: boolean
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  creatable?: boolean
  creatablePrefix?: string
  searchPlaceholder?: string
  emptyText?: string
  valueKey?: string
  labelKey?: string
  density?: UiDensity
}>(), {
  disabled: false,
  clearable: false,
  creatable: false,
  valueKey: 'value',
  labelKey: 'label',
  density: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [SelectValue]
  change: [SelectValue, SelectOption | null]
}>()

const resolvedId = computed(() => props.id || `ui-combobox-${Math.random().toString(36).slice(2, 9)}`)

function onChange(value: SelectValue, option: SelectOption | null): void {
  emit('change', value, option)
}
</script>
