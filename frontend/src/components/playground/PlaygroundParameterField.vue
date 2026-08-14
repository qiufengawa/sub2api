<template>
  <div class="parameter-field">
    <div class="parameter-field__header">
      <span class="parameter-field__label">{{ label }}</span>
      <UiSwitch v-model="model" :label="label" />
    </div>
    <fieldset :disabled="!model" class="parameter-field__control" :class="{ 'is-disabled': !model }">
      <slot></slot>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { UiSwitch } from '@/components/ui'

defineProps<{ label: string }>()
const model = defineModel<boolean>('enabled', { required: true })
</script>

<style scoped>
.parameter-field {
  padding-top: 16px;
  border-top: 1px solid var(--ui-border-soft);
}

.parameter-field:first-child {
  padding-top: 0;
  border-top: 0;
}

.parameter-field__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.parameter-field__label {
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 500;
}

.parameter-field__control {
  min-width: 0;
  border: 0;
  padding: 0;
  transition: opacity var(--ui-motion-fast) var(--ui-ease-standard);
}

.parameter-field__control.is-disabled {
  opacity: 0.45;
}

@media (prefers-reduced-motion: reduce) {
  .parameter-field__control {
    transition: none;
  }
}
</style>
