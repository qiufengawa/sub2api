<template>
  <div class="model-mapping-editor">
    <div v-if="modelValue.length" class="model-mapping-editor__rows">
      <div v-for="(mapping, index) in modelValue" :key="rowKey(mapping, index)" class="model-mapping-editor__row">
        <UiTextField
          :model-value="mapping.from"
          :placeholder="fromPlaceholder"
          :error="sourceError(mapping.from)"
          monospace
          density="compact"
          @update:model-value="updateRow(index, 'from', $event)"
        />
        <Icon name="arrowRight" size="sm" class="model-mapping-editor__arrow" aria-hidden="true" />
        <UiTextField
          :model-value="mapping.to"
          :placeholder="toPlaceholder"
          :error="targetError(mapping.to)"
          monospace
          density="compact"
          @update:model-value="updateRow(index, 'to', $event)"
        />
        <UiIconButton
          variant="danger"
          density="mini"
          :label="removeLabel"
          @click="removeRow(index)"
        >
          <Icon name="trash" size="sm" />
        </UiIconButton>
      </div>
    </div>
    <UiButton variant="secondary" density="compact" @click="addRow">
      <Icon name="plus" size="sm" />
      {{ addLabel }}
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiIconButton, UiTextField } from '@/components/ui'
import { isValidWildcardPattern, type ModelMappingEntry } from '@/composables/useModelWhitelist'

const props = withDefaults(defineProps<{
  modelValue: ModelMappingEntry[]
  fromPlaceholder: string
  toPlaceholder: string
  addLabel: string
  removeLabel: string
  validateWildcards?: boolean
  wildcardSourceError?: string
  wildcardTargetError?: string
}>(), {
  validateWildcards: false,
  wildcardSourceError: '',
  wildcardTargetError: ''
})

const emit = defineEmits<{
  'update:modelValue': [ModelMappingEntry[]]
}>()

function rowKey(mapping: ModelMappingEntry, index: number): string {
  return `${index}:${mapping.from}:${mapping.to}`
}

function sourceError(value: string): string {
  return props.validateWildcards && !isValidWildcardPattern(value)
    ? props.wildcardSourceError
    : ''
}

function targetError(value: string): string {
  return props.validateWildcards && value.includes('*')
    ? props.wildcardTargetError
    : ''
}

function updateRow(index: number, key: keyof ModelMappingEntry, value: string): void {
  emit('update:modelValue', props.modelValue.map((row, rowIndex) =>
    rowIndex === index ? { ...row, [key]: value } : row
  ))
}

function addRow(): void {
  emit('update:modelValue', [...props.modelValue, { from: '', to: '' }])
}

function removeRow(index: number): void {
  emit('update:modelValue', props.modelValue.filter((_, rowIndex) => rowIndex !== index))
}
</script>

<style scoped>
.model-mapping-editor{display:grid;gap:10px}
.model-mapping-editor__rows{display:grid;gap:8px}
.model-mapping-editor__row{display:grid;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr) 28px;align-items:start;gap:8px}
.model-mapping-editor__arrow{margin-top:8px;color:var(--ui-text-soft)}
@media(max-width:640px){.model-mapping-editor__row{grid-template-columns:minmax(0,1fr) 28px}.model-mapping-editor__arrow{display:none}.model-mapping-editor__row>*:nth-child(3){grid-column:1}.model-mapping-editor__row>*:nth-child(4){grid-column:2;grid-row:1}}
</style>
