<template><UiFormField :for-id="resolvedId" :label="label" :description="description" :error="error" :required="required"><template v-if="$slots.label" #label><slot name="label" /></template><template v-if="help" #help><UiFieldHelp :content="help" /></template><div class="ui-text-shell"><span v-if="$slots.prefix" class="ui-text-shell__prefix"><slot name="prefix" /></span><input v-bind="inputAttrs" :id="resolvedId" ref="input" :data-testid="testId" :data-test="dataTest" :data-tour="dataTour" :value="modelValue ?? ''" :type="type" :placeholder="placeholder" :disabled="disabled" :readonly="readonly" :required="required" :autofocus="autofocus" :autocomplete="autocomplete" :inputmode="inputmode" :maxlength="maxlength" :min="min" :max="max" :step="step" :pattern="pattern" :aria-describedby="description||error?`${resolvedId}-message`:undefined" :aria-invalid="(error||invalid)?true:undefined" class="ui-text-input ui-focus-ring" :class="[`ui-text-input--${density}`,{'ui-text-input--prefix':$slots.prefix,'ui-text-input--suffix':$slots.suffix,'ui-text-input--invalid':Boolean(error||invalid),'ui-text-input--mono':monospace,'ui-text-input--center':textAlign==='center','ui-text-input--right':textAlign==='right'}]" @input="onInput" @change="onChange" @blur="emit('blur',$event)" @focus="emit('focus',$event)" @keydown="onKeydown" @paste="onPaste" @compositionstart="emit('compositionstart')" @compositionend="emit('compositionend')"/><span v-if="$slots.suffix" class="ui-text-shell__suffix"><slot name="suffix" /></span></div></UiFormField></template>
<script setup lang="ts">

import {ref} from 'vue';
import UiFormField from './UiFormField.vue';
import UiFieldHelp from './UiFieldHelp.vue';
import type {UiDensity} from './types';
const props=withDefaults(defineProps<{modelValue?:string|number|null;
id?:string;
testId?:string;
dataTest?:string;
dataTour?:string;
label?:string;
description?:string;
help?:string;
error?:string;
invalid?:boolean;
type?:string;
placeholder?:string;
disabled?:boolean;
readonly?:boolean;
required?:boolean;
autofocus?:boolean;
autocomplete?:string;
inputmode?:'none'|'text'|'decimal'|'numeric'|'tel'|'search'|'email'|'url';
maxlength?:number;
monospace?:boolean;
textAlign?:'left'|'center'|'right';
min?:string|number;
max?:string|number;
step?:string|number;
pattern?:string;
inputAttrs?:Record<string,string|number|boolean|undefined>;
density?:UiDensity;
preventEnterDefault?:boolean;
modelModifiers?:{number?:boolean;trim?:boolean}}>(),{type:'text',density:'default',autofocus:false,monospace:false,textAlign:'left',preventEnterDefault:false,modelModifiers:()=>({})});
const resolvedId=props.id||`ui-field-${Math.random().toString(36).slice(2,9)}`;
const emit=defineEmits<{ 'update:modelValue':[string];
input:[Event];
change:[string];
blur:[FocusEvent];
focus:[FocusEvent];
keydown:[KeyboardEvent];
paste:[ClipboardEvent];
enter:[KeyboardEvent];
compositionstart:[];
compositionend:[]}>();
const input=ref<HTMLInputElement>();
function normalizeValue(value:string):string|number{
  const trimmed=props.modelModifiers.trim?value.trim():value;
  if(!props.modelModifiers.number||trimmed==='')return trimmed;
  const parsed=Number(trimmed);
  return Number.isNaN(parsed)?trimmed:parsed
}
function onInput(e:Event){emit('update:modelValue',normalizeValue((e.target as HTMLInputElement).value) as string);emit('input',e)}defineExpose({focus:()=>input.value?.focus(),select:()=>input.value?.select()})
function onChange(e:Event){emit('change',normalizeValue((e.target as HTMLInputElement).value) as string)}
function onKeydown(e:KeyboardEvent){emit('keydown',e);if(e.key?.toLowerCase()==='enter')onEnter(e)}
function onPaste(e:ClipboardEvent){emit('paste',e)}
function onEnter(e:KeyboardEvent){if(props.preventEnterDefault)e.preventDefault();emit('enter',e)}

</script>
<style scoped>.ui-text-shell{position:relative;
min-width:0}.ui-text-input{width:100%;
padding:0 11px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text);
background:var(--ui-surface);
font-size:13px;
transition:border-color var(--ui-motion-fast),box-shadow var(--ui-motion-fast)}.ui-text-input--mini{height:var(--ui-control-mini)}.ui-text-input--dense{height:var(--ui-control-dense)}.ui-text-input--compact{height:var(--ui-control-compact)}.ui-text-input--default{height:var(--ui-control-default)}.ui-text-input--large{height:var(--ui-control-large)}.ui-text-input:hover{border-color:var(--ui-text-soft)}.ui-text-input:focus{border-color:var(--ui-focus);
outline:none;
box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-focus) 16%,transparent)}.ui-text-input:disabled{cursor:not-allowed;
background:var(--ui-surface-muted);
opacity:.7}.ui-text-input--invalid{border-color:var(--ui-danger)}.ui-text-input--mono{font-family:var(--ui-font-mono);font-variant-numeric:tabular-nums}.ui-text-input--center{text-align:center}.ui-text-input--right{text-align:right}.ui-text-input--prefix{padding-left:34px}.ui-text-input--suffix{padding-right:34px}.ui-text-shell__prefix,.ui-text-shell__suffix{position:absolute;
z-index:1;
top:0;
bottom:0;
display:flex;
align-items:center;
color:var(--ui-text-soft)}.ui-text-shell__prefix{left:10px}.ui-text-shell__suffix{right:10px}</style>
