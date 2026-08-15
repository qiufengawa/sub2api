<template>
  <div>
    <UiTagInput
      :model-value="models"
      :placeholder="placeholder"
      @update:model-value="emit('update:models', $event)"
    />
    <p class="mt-1 text-xs text-[var(--ui-text-soft)]">
      {{ t('admin.channels.form.modelInputHint', 'Press Enter to add, supports paste for batch import.') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { UiTagInput } from '@/components/ui'

const { t } = useI18n()

defineProps<{
  models: string[]
  placeholder?: string
  platform?: string
}>()

const emit = defineEmits<{
  'update:models': [models: string[]]
}>()
</script>
