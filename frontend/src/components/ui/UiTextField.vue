<template><UiFormField :for-id="resolvedId" :label="label" :description="description" :error="error" :required="required"><template v-if="help" #help><UiFieldHelp :content="help" /></template><div class="ui-text-shell"><span v-if="$slots.prefix" class="ui-text-shell__prefix"><slot name="prefix" /></span><input :id="resolvedId" ref="input" :value="modelValue ?? ''" :type="type" :placeholder="placeholder" :disabled="disabled" :readonly="readonly" :required="required" :autocomplete="autocomplete" :min="min" :max="max" :step="step" :aria-describedby="description||error?`${resolvedId}-message`:undefined" :aria-invalid="error?true:undefined" class="ui-text-input ui-focus-ring" :class="[`ui-text-input--${density}`,{'ui-text-input--prefix':$slots.prefix,'ui-text-input--suffix':$slots.suffix,'ui-text-input--invalid':Boolean(error)}]" @input="onInput" @change="emit('change',($event.target as HTMLInputElement).value)" @blur="emit('blur',$event)" @focus="emit('focus',$event)" @keyup.enter="emit('enter',$event)"/><span v-if="$slots.suffix" class="ui-text-shell__suffix"><slot name="suffix" /></span></div></UiFormField></template>
<script setup lang="ts">

import {ref} from 'vue';
import UiFormField from './UiFormField.vue';
import UiFieldHelp from './UiFieldHelp.vue';
import type {UiDensity} from './types';
const props=withDefaults(defineProps<{modelValue?:string|number|null;
id?:string;
label?:string;
description?:string;
help?:string;
error?:string;
type?:string;
placeholder?:string;
disabled?:boolean;
readonly?:boolean;
required?:boolean;
autocomplete?:string;
min?:string|number;
max?:string|number;
step?:string|number;
density?:UiDensity}>(),{type:'text',density:'default'});
const resolvedId=props.id||`ui-field-${Math.random().toString(36).slice(2,9)}`;
const emit=defineEmits<{ 'update:modelValue':[string];
change:[string];
blur:[FocusEvent];
focus:[FocusEvent];
enter:[KeyboardEvent]}>();
const input=ref<HTMLInputElement>();
function onInput(e:Event){emit('update:modelValue',(e.target as HTMLInputElement).value)}defineExpose({focus:()=>input.value?.focus(),select:()=>input.value?.select()})

</script>
<style scoped>.ui-text-shell{position:relative;
min-width:0}.ui-text-input{width:100%;
padding:0 11px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text);
background:var(--ui-surface);
font-size:13px;
transition:border-color var(--ui-motion-fast),box-shadow var(--ui-motion-fast)}.ui-text-input--mini{height:24px}.ui-text-input--dense{height:28px}.ui-text-input--compact,.ui-text-input--default{height:32px}.ui-text-input--large{height:40px}.ui-text-input:hover{border-color:var(--ui-text-soft)}.ui-text-input:focus{border-color:var(--ui-focus);
outline:none;
box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-focus) 16%,transparent)}.ui-text-input:disabled{cursor:not-allowed;
background:var(--ui-surface-muted);
opacity:.7}.ui-text-input--invalid{border-color:var(--ui-danger)}.ui-text-input--prefix{padding-left:34px}.ui-text-input--suffix{padding-right:34px}.ui-text-shell__prefix,.ui-text-shell__suffix{position:absolute;
z-index:1;
top:0;
bottom:0;
display:flex;
align-items:center;
color:var(--ui-text-soft)}.ui-text-shell__prefix{left:10px}.ui-text-shell__suffix{right:10px}</style>
