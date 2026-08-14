<template><div class="ui-accordion"><section v-for="item in items" :key="item.key"><button type="button" :aria-expanded="isOpen(item.key)" @click="toggle(item.key)"><span>{{ item.title }}</span><Icon name="chevronDown" size="sm" :class="{'is-open':isOpen(item.key)}"/></button><div v-if="isOpen(item.key)" class="ui-accordion__body"><slot :name="item.key" :item="item">{{ item.content }}</slot></div></section></div></template>
<script setup lang="ts">
import {ref} from 'vue';
import Icon from '@/components/icons/Icon.vue';
export interface UiAccordionItem{key:string;
title:string;
content?:string}const props=withDefaults(defineProps<{items:UiAccordionItem[];
multiple?:boolean;
defaultOpen?:string[]}>(),{multiple:false,defaultOpen:()=>[]});
const opened=ref(new Set(props.defaultOpen));
function isOpen(k:string){return opened.value.has(k)}function toggle(k:string){const next=new Set(props.multiple?opened.value:[]);
next.has(k)?next.delete(k):next.add(k);
opened.value=next}
</script>
<style scoped>.ui-accordion{border-top:1px solid var(--ui-border-soft)}.ui-accordion section{border-bottom:1px solid var(--ui-border-soft)}.ui-accordion button{display:flex;
width:100%;
min-height:42px;
align-items:center;
justify-content:space-between;
padding:8px 0;
border:0;
color:var(--ui-text);
background:transparent;
font-size:13px;
font-weight:600;
text-align:left}.ui-accordion button svg{transition:transform var(--ui-motion-fast)}.ui-accordion button svg.is-open{transform:rotate(180deg)}.ui-accordion__body{padding:0 0 14px;
color:var(--ui-text-muted);
font-size:12px;
line-height:1.7}</style>
