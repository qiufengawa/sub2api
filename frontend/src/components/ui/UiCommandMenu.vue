<template><div class="ui-command"><UiSearchInput v-model="query" :placeholder="placeholder" :debounce-ms="0"/><div class="ui-command__list" role="listbox"><button v-for="item in filtered" :key="item.key" type="button" role="option" :disabled="item.disabled" @click="emit('select',item)"><Icon v-if="item.icon" :name="item.icon" size="sm"/><span><b>{{ item.label }}</b><small v-if="item.description">{{ item.description }}</small></span><kbd v-if="item.shortcut">{{ item.shortcut }}</kbd></button><p v-if="!filtered.length">{{ emptyText }}</p></div></div></template>
<script setup lang="ts">
import {computed,ref} from 'vue';
import Icon from '@/components/icons/Icon.vue';
import UiSearchInput from './UiSearchInput.vue';
type IconName=InstanceType<typeof Icon>['$props']['name'];
export interface UiCommandItem{key:string;
label:string;
description?:string;
shortcut?:string;
icon?:IconName;
disabled?:boolean}const props=withDefaults(defineProps<{items:UiCommandItem[];
placeholder?:string;
emptyText?:string}>(),{placeholder:'搜索命令',emptyText:'没有匹配项'});
const emit=defineEmits<{select:[UiCommandItem]}>();
const query=ref('');
const filtered=computed(()=>{const q=query.value.trim().toLowerCase();
return q?props.items.filter(i=>`${i.label} ${i.description||''}`.toLowerCase().includes(q)):props.items})
</script>
<style scoped>.ui-command{display:grid;
gap:6px;
width:min(420px,100%)}.ui-command__list{display:grid;
gap:2px;
max-height:320px;
overflow:auto}.ui-command__list button{display:grid;
min-height:38px;
grid-template-columns:16px 1fr auto;
align-items:center;
gap:8px;
padding:6px 8px;
border:0;
border-radius:4px;
color:var(--ui-text);
background:transparent;
text-align:left}.ui-command__list button:hover{background:var(--ui-surface-muted)}.ui-command__list span{display:grid}.ui-command__list b{font-size:12px}.ui-command__list small{color:var(--ui-text-soft);
font-size:10px}.ui-command__list kbd{color:var(--ui-text-soft);
font-size:10px}.ui-command__list>p{margin:20px;
color:var(--ui-text-soft);
font-size:12px;
text-align:center}</style>
