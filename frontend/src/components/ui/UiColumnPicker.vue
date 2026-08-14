<template><UiPopover placement="bottom-end"><template #trigger><UiButton density="dense"><template #icon><Icon name="grid" size="sm"/></template>{{ label }}</UiButton></template><div class="ui-column-picker"><UiCheckbox v-for="column in columns" :key="column.key" :model-value="modelValue.includes(column.key)" :label="column.label" :disabled="column.required" @update:model-value="toggle(column.key,$event)"/></div></UiPopover></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
import UiButton from './UiButton.vue';
import UiCheckbox from './UiCheckbox.vue';
import UiPopover from './UiPopover.vue';
const props=withDefaults(defineProps<{modelValue:string[];
columns:Array<{key:string;
label:string;
required?:boolean}>;
label?:string}>(),{label:'显示列'});
const emit=defineEmits<{ 'update:modelValue':[string[]]}>();
function toggle(key:string,on:boolean){emit('update:modelValue',on?[...props.modelValue,key]:props.modelValue.filter(v=>v!==key))}
</script>
<style scoped>.ui-column-picker{display:grid;
gap:8px;
min-width:160px;
padding:6px}</style>
