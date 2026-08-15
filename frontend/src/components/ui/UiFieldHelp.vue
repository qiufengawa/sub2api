<template>
  <UiTooltip :content="content" :trigger="trigger" :width-class="widthClass">
    <button type="button" class="ui-field-help ui-focus-ring" :aria-label="content">
      <Icon name="questionCircle" size="xs" />
    </button>
    <template v-if="$slots.default" #content><slot /></template>
  </UiTooltip>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'
import UiTooltip from './UiTooltip.vue'

withDefaults(defineProps<{
  content?: string
  trigger?: 'hover' | 'click'
  widthClass?: string
}>(), { content: '', trigger: 'hover', widthClass: '' })
</script>

<style scoped>
.ui-field-help{display:inline-grid;width:16px;height:16px;place-items:center;padding:0;border:0;color:var(--ui-text-soft);background:transparent;cursor:help}.ui-field-help:hover{color:var(--ui-text)}
</style>
