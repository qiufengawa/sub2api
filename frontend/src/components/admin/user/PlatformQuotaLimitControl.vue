<template>
  <div class="platform-quota-limit">
    <UiTextField
      density="compact"
      type="number"
      min="0"
      step="0.01"
      :model-value="modelValue ?? ''"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <UiIconButton
      icon="refresh"
      density="mini"
      variant="ghost"
      :disabled="resetting"
      :label="resetLabel"
      @click="emit('reset')"
    />
  </div>
</template>

<script setup lang="ts">
import { UiIconButton, UiTextField } from '@/components/ui'

defineProps<{
  modelValue: number | null
  placeholder: string
  resetLabel: string
  resetting?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [string | number]
  reset: []
}>()
</script>

<style scoped>
.platform-quota-limit{display:flex;min-width:176px;align-items:center;gap:4px}.platform-quota-limit :deep(.ui-form-field){min-width:0;flex:1}
</style>
