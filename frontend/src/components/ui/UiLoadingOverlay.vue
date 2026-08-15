<template><div class="ui-loading-host" :aria-busy="show"><slot/><Transition name="ui-fade"><div v-if="show" class="ui-loading-overlay" role="status" aria-live="polite" :aria-label="label"><UiSpinner/><span>{{ label }}</span></div></Transition></div></template>
<script setup lang="ts">
import UiSpinner from './UiSpinner.vue';
withDefaults(defineProps<{show:boolean;
label?:string}>(),{label:'加载中'})
</script>
<style scoped>.ui-loading-host{position:relative}.ui-loading-overlay{position:absolute;
z-index:20;
inset:0;
display:flex;
align-items:center;
justify-content:center;
gap:8px;
color:var(--ui-text-muted);
background:color-mix(in srgb,var(--ui-surface) 84%,transparent);
font-size:12px;
backdrop-filter:blur(1px)}.ui-fade-enter-active,.ui-fade-leave-active{transition:opacity var(--ui-motion-fast)}.ui-fade-enter-from,.ui-fade-leave-to{opacity:0}</style>
