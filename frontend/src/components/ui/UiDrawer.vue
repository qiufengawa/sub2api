<template><Teleport to="body"><Transition name="ui-drawer"><div v-if="show" class="ui-drawer__overlay" :style="{zIndex}" role="dialog" aria-modal="true" :aria-label="title" @click.self="closeFromOutside"><aside ref="panelRef" :id="id" class="ui-drawer" :class="`ui-drawer--${side}`" tabindex="-1"><header><h2>{{ title }}</h2><UiIconButton :label="resolvedCloseLabel" variant="ghost" density="dense" @click="emit('close')"><Icon name="x" size="sm"/></UiIconButton></header><div class="ui-drawer__body"><slot/></div><footer v-if="$slots.footer"><slot name="footer"/></footer></aside></div></Transition></Teleport></template>
<script setup lang="ts">
import{computed,toRef}from'vue';
import Icon from '@/components/icons/Icon.vue';
import UiIconButton from './UiIconButton.vue';
import { useOverlayLifecycle } from './useOverlayLifecycle';
import { useUiT } from './useUiI18n';
const props=withDefaults(defineProps<{show:boolean;
title:string;
id?:string;
closeLabel?:string;
side?:'left'|'right';
 closeOnOutside?:boolean}>(),{side:'right',closeOnOutside:true});
const emit=defineEmits<{close:[]}>();
const t = useUiT()
const resolvedCloseLabel = computed(() => props.closeLabel || t('common.close'))
function closeFromOutside(){if(props.closeOnOutside)emit('close')}
const { panelRef, zIndex } = useOverlayLifecycle(toRef(props, 'show'), () => emit('close'))
</script>
<style scoped>.ui-drawer__overlay{position:fixed;
z-index:100000000;
inset:0;
background:rgb(0 0 0/.32)}.ui-drawer{position:absolute;
top:0;
bottom:0;
display:grid;
width:min(460px,92vw);
grid-template-rows:auto 1fr auto;
background:var(--ui-surface);
box-shadow:0 0 28px rgb(31 35 41/.1)}.ui-drawer--right{right:0}.ui-drawer--left{left:0}.ui-drawer header,.ui-drawer footer{display:flex;
min-height:52px;
align-items:center;
justify-content:space-between;
gap:12px;
padding:10px 16px;
border-block:1px solid var(--ui-border-soft)}.ui-drawer header{border-top:0}.ui-drawer h2{margin:0;
font-size:16px}.ui-drawer__body{min-height:0;
padding:16px;
overflow:auto}.ui-drawer-enter-active,.ui-drawer-leave-active{transition:opacity var(--ui-motion-base)}.ui-drawer-enter-active .ui-drawer,.ui-drawer-leave-active .ui-drawer{transition:transform var(--ui-motion-base)}.ui-drawer-enter-from,.ui-drawer-leave-to{opacity:0}.ui-drawer-enter-from .ui-drawer--right,.ui-drawer-leave-to .ui-drawer--right{transform:translateX(100%)}.ui-drawer-enter-from .ui-drawer--left,.ui-drawer-leave-to .ui-drawer--left{transform:translateX(-100%)}@media(prefers-reduced-motion:reduce){.ui-drawer-enter-active,.ui-drawer-leave-active,.ui-drawer-enter-active .ui-drawer,.ui-drawer-leave-active .ui-drawer{transition:none}}</style>
