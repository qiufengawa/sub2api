<template>
  <UiFormField :for-id="id" :label="label" :description="description" :error="error">
    <div class="ui-stepper" :aria-busy="ariaBusy">
      <button
        type="button"
        :disabled="disabled || atMin"
        :aria-label="decreaseLabel"
        @click="change(-step)"
      >
        <Icon name="minus" size="sm" />
      </button>
      <input
        :id="id"
        :value="inputValue ?? modelValue"
        :type="inputType"
        :min="min"
        :max="max"
        :step="step"
        :disabled="disabled"
        :inputmode="inputmode"
        :pattern="pattern"
        :aria-label="ariaLabel"
        class="ui-numeric"
        @input="handleInput"
        @blur="emit('blur', $event)"
        @keydown.enter.prevent="emit('enter', $event)"
        @keydown.esc.prevent="emit('escape', $event)"
      />
      <button
        type="button"
        :disabled="disabled || atMax"
        :aria-label="increaseLabel"
        @click="change(step)"
      >
        <Icon name="plus" size="sm" />
      </button>
    </div>
  </UiFormField>
</template>
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
max?:number;
step?:number;
disabled?:boolean;
inputValue?:string;
inputType?:'number'|'text';
inputmode?:'none'|'text'|'decimal'|'numeric'|'tel'|'search';
pattern?:string;
ariaLabel?:string;
ariaBusy?:boolean;
decreaseLabel?:string;
increaseLabel?:string}>(),{min:0,step:1,inputType:'number',decreaseLabel:'减少',increaseLabel:'增加'});
const emit=defineEmits<{ 'update:modelValue':[number];
change:[number];
input:[Event];
blur:[FocusEvent];
enter:[KeyboardEvent];
escape:[KeyboardEvent]} >();
const atMin=computed(()=>props.modelValue<=props.min);
const atMax=computed(()=>props.max !== undefined && props.modelValue>=props.max);
function apply(v:number){const upper=props.max === undefined ? v : Math.min(props.max,v);const n=Math.max(props.min,upper);
emit('update:modelValue',n);
emit('change',n)}function change(d:number){apply(props.modelValue+d)}function processInput(e:Event){const v=Number((e.target as HTMLInputElement).value);
if(props.inputValue !== undefined || props.inputType === 'text'){emit('input',e);return}if(Number.isFinite(v))apply(v)}
function handleInput(e:Event){processInput(e)}

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
