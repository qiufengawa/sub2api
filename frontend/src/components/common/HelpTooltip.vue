<template>
  <UiTooltip
    v-bind="$attrs"
    class="group relative ml-1 inline-flex items-center align-middle"
    :content="content"
    :trigger="trigger"
    :width-class="widthClass"
  >
    <slot name="trigger">
      <UiIconButton
        icon="infoCircle"
        variant="ghost"
        density="mini"
        class="help-tooltip__trigger"
        :label="content"
      />
    </slot>
    <template #content><slot>{{ content }}</slot></template>
  </UiTooltip>
</template>

<script setup lang="ts">
import { UiTooltip } from '@/components/ui'
import { UiIconButton } from '@/components/ui'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  content?: string
  trigger?: 'hover' | 'click'
  widthClass?: string
}>(), {
  content: '',
  trigger: 'hover',
  widthClass: 'w-64'
})
</script>

<style scoped>
.help-tooltip__trigger{display:inline-grid;width:16px;height:16px;place-items:center;padding:0;border:0;color:var(--ui-text-soft);background:transparent;cursor:help}.help-tooltip__trigger:hover{color:var(--ui-text)}
</style>
