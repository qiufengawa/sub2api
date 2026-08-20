<template>
  <label class="flex flex-col items-center gap-0.5 cursor-pointer">
    <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ label }}</span>
    <UiSwitch
      :model-value="checked"
      :label="label"
      :native-input="false"
      @update:model-value="emit('toggle')"
    />
  </label>
</template>

<script setup lang="ts">
import { UiSwitch } from '@/components/ui'

defineProps<{ label: string; checked: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
</script>
