<template>
  <div class="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0 dark:border-dark-700">
    <div class="mb-2 flex items-center justify-between gap-3">
      <label class="text-sm font-medium text-gray-700 dark:text-dark-200">{{ label }}</label>
      <Toggle v-model="model" :aria-label="label" />
    </div>
    <fieldset :disabled="!model" :class="model ? '' : 'opacity-45'">
      <slot></slot>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import Toggle from '@/components/common/Toggle.vue'

defineProps<{ label: string }>()
const model = defineModel<boolean>('enabled', { required: true })
</script>
