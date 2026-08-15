<template><fieldset class="ui-radio-group" :class="`ui-radio-group--${layout}`"><legend v-if="label">{{ label }}</legend><label v-for="option in options" :key="String(option.value)" class="ui-radio"><input type="radio" :name="name" :value="option.value" :checked="modelValue===option.value" :disabled="disabled||option.disabled" @change="emit('update:modelValue',option.value)"/><span></span><b>{{ option.label }}</b></label></fieldset></template>
<script setup lang="ts">

import type {UiChoiceOption} from './types';
withDefaults(defineProps<{modelValue:string|number;
options:UiChoiceOption[];
name:string;
label?:string;
disabled?:boolean;
layout?:'inline'|'stacked'}>(), { layout:'inline' });
const emit=defineEmits<{ 'update:modelValue':[string|number]}>()

</script>
<style scoped>.ui-radio-group{display:flex;
flex-wrap:wrap;
gap:12px;
padding:0;
border:0}.ui-radio-group legend{width:100%;
margin-bottom:1px;
font-size:11px;
font-weight:600}.ui-radio{display:inline-flex;
align-items:center;
gap:6px;
font-size:12px;
cursor:pointer}.ui-radio input{position:absolute;
opacity:0}.ui-radio span{display:grid;
width:16px;
height:16px;
place-items:center;
border:1px solid var(--ui-border);
border-radius:50%}.ui-radio input:checked+span:after{width:8px;
height:8px;
border-radius:50%;
background:var(--ui-text);
content:""}.ui-radio b{font-weight:400}.ui-radio-group--stacked{display:grid;gap:4px}.ui-radio-group--stacked .ui-radio{min-height:32px;padding:5px 8px;border:1px solid var(--ui-border);border-radius:var(--ui-radius)}.ui-radio-group--stacked .ui-radio:has(input:checked){border-color:var(--ui-text);background:var(--ui-surface-muted)}</style>
