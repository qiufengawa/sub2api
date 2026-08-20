<template><div class="ui-segmented" role="radiogroup" :aria-label="label"><button v-for="option in options" :key="String(option.value)" type="button" role="radio" :aria-checked="option.value===modelValue" :tabindex="option.value===modelValue?0:-1" :title="option.title" :class="{'is-active':option.value===modelValue}" :disabled="option.disabled" @click="emit('update:modelValue',option.value)" @keydown="navigate($event,option.value)"><slot name="option" :option="option" :selected="option.value===modelValue">{{ option.label }}</slot></button></div></template>
<script setup lang="ts">

import type {UiChoiceOption} from './types';
const props=defineProps<{modelValue:string|number;
options:UiChoiceOption[];
label:string}>();
const emit=defineEmits<{ 'update:modelValue':[string|number]}>()
function navigate(event:KeyboardEvent,value:string|number){if(!['ArrowLeft','ArrowRight'].includes(event.key))return;const enabled=props.options.filter(item=>!item.disabled),index=enabled.findIndex(item=>item.value===value),next=enabled[(index+(event.key==='ArrowRight'?1:-1)+enabled.length)%enabled.length];if(!next)return;event.preventDefault();emit('update:modelValue',next.value);const target=props.options.findIndex(item=>item.value===next.value);(event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button')[target]?.focus()}

</script>
<style scoped>.ui-segmented{display:inline-flex;
gap:2px;
padding:2px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
background:var(--ui-surface-muted)}.ui-segmented button{height:26px;
padding:0 10px;
border:0;
border-radius:4px;
color:var(--ui-text-muted);
background:transparent;
font-size:13px}.ui-segmented button.is-active{color:var(--ui-text);
background:var(--ui-surface);
box-shadow:0 1px 2px rgb(0 0 0/.06)}</style>
