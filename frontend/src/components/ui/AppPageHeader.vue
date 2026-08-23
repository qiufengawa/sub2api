<template><header class="app-page-header"><div><div class="app-page-header__title"><h1>{{ title }}</h1><slot name="status"/></div><p v-if="description">{{ description }}</p></div><div v-if="$slots.actions" class="app-page-header__actions"><slot name="actions"/></div></header></template>
<script setup lang="ts">
defineProps<{title:string;
description?:string}>()
</script>
<style scoped>.app-page-header{display:flex;
min-height:52px;
align-items:flex-start;
justify-content:space-between;
gap:24px;
padding:0 0 16px}.app-page-header__title{display:flex;
align-items:center;
gap:10px}.app-page-header h1{margin:0;
font-size:20px;
font-weight:650;
line-height:28px}.app-page-header p{max-width:760px;
margin:4px 0 0;
color:var(--ui-text-muted);
font-size:13px;
line-height:20px}.app-page-header__actions{display:flex;
flex:none;
align-items:center;
gap:8px}@media(max-width:640px){.app-page-header{align-items:stretch;
flex-direction:column;
gap:12px}.app-page-header__actions{justify-content:flex-end}}</style>
