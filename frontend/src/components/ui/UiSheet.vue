<template><Teleport to="body"><Transition name="ui-sheet"><div v-if="show" class="ui-sheet__overlay" :style="{zIndex}" role="dialog" aria-modal="true" :aria-label="title" @click.self="emit('close')"><section ref="panelRef" class="ui-sheet" tabindex="-1"><div class="ui-sheet__handle"/><header><h2>{{ title }}</h2><UiIconButton :label="closeLabel" variant="ghost" density="dense" @click="emit('close')"><Icon name="x" size="sm"/></UiIconButton></header><div class="ui-sheet__body"><slot/></div><footer v-if="$slots.footer"><slot name="footer"/></footer></section></div></Transition></Teleport></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
import { toRef } from 'vue';
import UiIconButton from './UiIconButton.vue';
import { useOverlayLifecycle } from './useOverlayLifecycle';
const props=withDefaults(defineProps<{show:boolean;
title:string;
closeLabel?:string}>(),{closeLabel:'关闭'});
const emit=defineEmits<{close:[]}>()
const { panelRef, zIndex } = useOverlayLifecycle(toRef(props, 'show'), () => emit('close'))
</script>
<style scoped>.ui-sheet__overlay{position:fixed;
z-index:100000000;
inset:0;
display:flex;
align-items:flex-end;
background:rgb(0 0 0/.32)}.ui-sheet{display:grid;
width:100%;
max-height:min(86dvh,760px);
grid-template-rows:auto auto minmax(0,1fr) auto;
padding-bottom:env(safe-area-inset-bottom);
border-radius:8px 8px 0 0;
background:var(--ui-surface)}.ui-sheet__handle{width:34px;
height:3px;
margin:7px auto 2px;
border-radius:99px;
background:var(--ui-border)}.ui-sheet header,.ui-sheet footer{display:flex;
min-height:46px;
align-items:center;
justify-content:space-between;
gap:10px;
padding:8px 16px;
border-bottom:1px solid var(--ui-border-soft)}.ui-sheet footer{border-top:1px solid var(--ui-border-soft);
border-bottom:0}.ui-sheet h2{margin:0;
font-size:15px}.ui-sheet__body{min-height:0;
padding:14px 16px;
overflow:auto}.ui-sheet-enter-active,.ui-sheet-leave-active{transition:opacity var(--ui-motion-base)}.ui-sheet-enter-active .ui-sheet,.ui-sheet-leave-active .ui-sheet{transition:transform var(--ui-motion-base)}.ui-sheet-enter-from,.ui-sheet-leave-to{opacity:0}.ui-sheet-enter-from .ui-sheet,.ui-sheet-leave-to .ui-sheet{transform:translateY(100%)}</style>
