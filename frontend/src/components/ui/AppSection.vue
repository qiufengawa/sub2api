<template><section class="app-section" :class="{'app-section--divided':divided}"><header v-if="title||description||$slots.actions"><div><h2 v-if="title">{{ title }}</h2><p v-if="description">{{ description }}</p></div><div v-if="$slots.actions"><slot name="actions"/></div></header><slot/></section></template>
<script setup lang="ts">
defineProps<{title?:string;
description?:string;
divided?:boolean}>()
</script>
<style scoped>.app-section{padding:20px 0}.app-section--divided{border-bottom:1px solid var(--ui-border-soft)}.app-section>header{display:flex;
align-items:flex-end;
justify-content:space-between;
gap:16px;
margin-bottom:16px}.app-section h2{margin:0;
font-size:18px;
line-height:28px}.app-section p{margin:3px 0 0;
color:var(--ui-text-muted);
font-size:12px}</style>
