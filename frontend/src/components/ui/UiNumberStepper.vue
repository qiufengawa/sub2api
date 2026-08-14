<template><UiFormField :for-id="id" :label="label" :description="description" :error="error"><div class="ui-stepper"><button type="button" :disabled="disabled||atMin" aria-label="减少" @click="change(-step)"><Icon name="minus" size="sm"/></button><input :id="id" :value="modelValue" type="number" :min="min" :step="step" :disabled="disabled" class="ui-numeric" @input="inputValue"/><button type="button" :disabled="disabled" aria-label="增加" @click="change(step)"><Icon name="plus" size="sm"/></button></div></UiFormField></template>
<script setup lang="ts">

import {computed} from 'vue';
import Icon from '@/components/icons/Icon.vue';
import UiFormField from './UiFormField.vue';
const props=withDefaults(defineProps<{modelValue:number;
id?:string;
label?:string;
description?:string;
error?:string;
min?:number;
step?:number;
disabled?:boolean}>(),{min:0,step:1});
const emit=defineEmits<{ 'update:modelValue':[number];
change:[number]}>();
const atMin=computed(()=>props.modelValue<=props.min);
function apply(v:number){const n=Math.max(props.min,v);
emit('update:modelValue',n);
emit('change',n)}function change(d:number){apply(props.modelValue+d)}function inputValue(e:Event){const v=Number((e.target as HTMLInputElement).value);
if(Number.isFinite(v))apply(v)}

</script>
<style scoped>.ui-stepper{display:grid;
width:132px;
height:32px;
grid-template-columns:32px 1fr 32px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
overflow:hidden;
background:var(--ui-surface)}.ui-stepper button,.ui-stepper input{border:0;
color:var(--ui-text);
background:transparent}.ui-stepper button{display:grid;
place-items:center;
cursor:pointer}.ui-stepper button:hover:not(:disabled){background:var(--ui-surface-muted)}.ui-stepper button:disabled{opacity:.35}.ui-stepper input{min-width:0;
border-inline:1px solid var(--ui-border);
text-align:center;
font-size:12px;
outline:0}</style>
