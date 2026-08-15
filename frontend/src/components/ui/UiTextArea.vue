<template><UiFormField :for-id="id" :label="label" :description="description" :error="error" :required="required"><div class="ui-textarea-shell"><textarea ref="textarea" :id="id" :value="modelValue ?? ''" :rows="rows" :maxlength="maxlength" :placeholder="placeholder" :disabled="disabled" :readonly="readonly" :required="required" class="ui-textarea ui-focus-ring" :class="{'ui-textarea--mono':monospace}" @input="onInput" @change="emit('change',($event.target as HTMLTextAreaElement).value)" @blur="emit('blur',$event)" @focus="emit('focus',$event)"/><span v-if="maxlength" class="ui-textarea__count ui-numeric">{{ String(modelValue??'').length }}/{{ maxlength }}</span></div></UiFormField></template>
<script setup lang="ts">

import { ref } from 'vue';
import UiFormField from './UiFormField.vue';
withDefaults(defineProps<{modelValue?:string|null;
id?:string;
label?:string;
description?:string;
error?:string;
placeholder?:string;
disabled?:boolean;
readonly?:boolean;
required?:boolean;
rows?:number;
maxlength?:number;
monospace?:boolean}>(),{rows:3,monospace:false});
const emit=defineEmits<{ 'update:modelValue':[string];change:[string];blur:[FocusEvent];focus:[FocusEvent]}>();
const textarea=ref<HTMLTextAreaElement>();
function onInput(event:Event){emit('update:modelValue',(event.target as HTMLTextAreaElement).value)}
defineExpose({focus:()=>textarea.value?.focus(),select:()=>textarea.value?.select()})

</script>
<style scoped>.ui-textarea-shell{position:relative}.ui-textarea{display:block;
width:100%;
min-height:54px;
padding:7px 11px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text);
background:var(--ui-surface);
font-size:13px;
line-height:22px;
resize:vertical}.ui-textarea--mono{font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums}.ui-textarea:focus{border-color:var(--ui-focus);
outline:none;
box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-focus) 16%,transparent)}.ui-textarea__count{position:absolute;
right:8px;
bottom:5px;
color:var(--ui-text-soft);
font-size:10px}</style>
