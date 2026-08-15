<template><Teleport to="body"><section v-if="show" ref="panelRef" class="ui-fullscreen" :style="{zIndex}" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1"><header><h2>{{ title }}</h2><div><slot name="actions"/><UiIconButton label="退出全屏" variant="ghost" @click="emit('close')"><Icon name="x" size="sm"/></UiIconButton></div></header><main><slot/></main></section></Teleport></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
import { toRef } from 'vue';
import UiIconButton from './UiIconButton.vue';
import { useOverlayLifecycle } from './useOverlayLifecycle';
const props=defineProps<{show:boolean;
title:string}>();
const emit=defineEmits<{close:[]}>()
const { panelRef, zIndex } = useOverlayLifecycle(toRef(props, 'show'), () => emit('close'), { zIndex: 100_000_050 })
</script>
<style scoped>.ui-fullscreen{position:fixed;
z-index:100000050;
inset:0;
display:grid;
grid-template-rows:52px 1fr;
color:var(--ui-text);
background:var(--ui-bg)}.ui-fullscreen header{display:flex;
align-items:center;
justify-content:space-between;
padding:0 18px;
border-bottom:1px solid var(--ui-border)}.ui-fullscreen h2{margin:0;
font-size:16px}.ui-fullscreen header>div{display:flex;
gap:6px}.ui-fullscreen main{min-height:0;
padding:16px;
overflow:auto}</style>
