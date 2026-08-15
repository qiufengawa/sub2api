<template><div class="app-toolbar" :class="{'app-toolbar--sticky':sticky}"><div><slot/></div><div v-if="$slots.actions"><slot name="actions"/></div></div></template>
<script setup lang="ts">
defineProps<{sticky?:boolean}>()
</script>
<style scoped>.app-toolbar{display:flex;
min-height:44px;
align-items:center;
justify-content:space-between;
gap:12px;
padding:6px 0;
background:var(--ui-bg)}.app-toolbar--sticky{position:sticky;
z-index:20;
top:0}.app-toolbar>div{display:flex;
min-width:0;
align-items:center;
gap:8px}@media(max-width:640px){.app-toolbar{align-items:stretch;
flex-direction:column}.app-toolbar>div:last-child{justify-content:flex-end}}</style>
