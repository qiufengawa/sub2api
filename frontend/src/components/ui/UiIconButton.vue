<template>
  <button ref="button" :type="type" :disabled="disabled" class="ui-icon-button ui-focus-ring ui-motion" :class="[`ui-icon-button--${density}`,`ui-icon-button--${variant}`]" :aria-label="label" :title="tooltip || label">
  <Icon v-if="icon" :name="icon" size="sm" />
  <slot />
  </button>
</template>
<script setup lang="ts">

import { ref } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import type { UiDensity } from './types'
type IconName = InstanceType<typeof Icon>['$props']['name']
withDefaults(defineProps<{ label:string;
icon?:IconName;
variant?:'outlined'|'ghost'|'success'|'danger';
tooltip?:string;
density?:UiDensity;
type?:'button'|'submit'|'reset';
disabled?:boolean }>(), { density:'compact', variant:'outlined', type:'button', disabled:false })

const button = ref<HTMLButtonElement | null>(null)
defineExpose({ focus: () => button.value?.focus() })


</script>
<style scoped>
.ui-icon-button{display:inline-grid;
place-items:center;
padding:0;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text-muted);
background:var(--ui-surface);
cursor:pointer;
transition:background var(--ui-motion-fast),color var(--ui-motion-fast),border-color var(--ui-motion-fast)}
.ui-icon-button:hover{border-color:var(--ui-text-soft);
color:var(--ui-text);
background:var(--ui-surface-muted)}
.ui-icon-button--ghost,.ui-icon-button--success,.ui-icon-button--danger{border-color:transparent;background:transparent}
.ui-icon-button--ghost:hover{border-color:transparent;background:var(--ui-surface-muted)}
.ui-icon-button--success{color:var(--ui-success)}.ui-icon-button--success:hover{border-color:transparent;color:var(--ui-success);background:color-mix(in srgb,var(--ui-success) 9%,transparent)}
.ui-icon-button--danger{color:var(--ui-danger)}.ui-icon-button--danger:hover{border-color:transparent;color:var(--ui-danger);background:color-mix(in srgb,var(--ui-danger) 9%,transparent)}
.ui-icon-button:disabled{cursor:not-allowed;
opacity:.45}.ui-icon-button--dense{width:28px;
height:28px}.ui-icon-button--compact{width:32px;
height:32px}.ui-icon-button--default{width:36px;
height:36px}.ui-icon-button--mini{width:24px;height:24px}.ui-icon-button--large{width:40px;height:40px}
</style>
