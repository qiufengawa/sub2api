<template><div class="ui-search" :class="`ui-search--${density}`"><Icon name="search" size="sm"/><input :value="modelValue" type="search" :placeholder="placeholder" :disabled="disabled" :aria-label="ariaLabel||placeholder" @input="onInput"/><button v-if="modelValue&&!disabled" type="button" aria-label="清除搜索" @click="clear"><Icon name="x" size="xs"/></button></div></template>
<script setup lang="ts">

import {useDebounceFn} from '@vueuse/core';
import Icon from '@/components/icons/Icon.vue';
import type {UiDensity} from './types';
const props=withDefaults(defineProps<{modelValue:string;
placeholder?:string;
ariaLabel?:string;
disabled?:boolean;
debounceMs?:number;
density?:UiDensity}>(),{placeholder:'搜索',debounceMs:300,density:'default'});
const emit=defineEmits<{ 'update:modelValue':[string];
search:[string]}>();
const notify=useDebounceFn((v:string)=>emit('search',v),props.debounceMs);
function onInput(e:Event){const v=(e.target as HTMLInputElement).value;
emit('update:modelValue',v);
notify(v)}function clear(){emit('update:modelValue','');
emit('search','')}

</script>
<style scoped>.ui-search{position:relative;
display:flex;
align-items:center;
color:var(--ui-text-soft)}.ui-search>svg{position:absolute;
left:10px}.ui-search input{width:100%;
height:32px;
padding:0 32px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text);
background:var(--ui-surface);
font-size:12px}.ui-search input:focus{border-color:var(--ui-focus);
outline:none;
box-shadow:0 0 0 3px color-mix(in srgb,var(--ui-focus) 7%,transparent)}.ui-search button{position:absolute;
right:5px;
display:grid;
width:24px;
height:24px;
place-items:center;
border:0;
color:inherit;
background:transparent}.ui-search--mini input{height:var(--ui-control-mini)}.ui-search--dense input{height:var(--ui-control-dense)}.ui-search--compact input{height:var(--ui-control-compact)}.ui-search--default input{height:var(--ui-control-default)}.ui-search--large input{height:var(--ui-control-large)}</style>
