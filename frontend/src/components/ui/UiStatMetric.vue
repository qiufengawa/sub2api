<template><div class="ui-stat"><div class="ui-stat__label"><span>{{ label }}</span><slot name="status"/></div><strong class="ui-numeric">{{ value }}<small v-if="unit">{{ unit }}</small></strong><p v-if="context">{{ context }}</p></div></template>
<script setup lang="ts">
defineProps<{label:string;
value:string|number;
unit?:string;
context?:string}>()
</script>
<style scoped>.ui-stat{display:grid;
gap:5px;
min-width:0;
padding:12px;
border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius);background:var(--ui-surface-muted)}.ui-stat__label{display:flex;
align-items:center;
justify-content:space-between;
gap:8px;
color:var(--ui-text-soft);
font-size:12px;line-height:20px}.ui-stat>strong{color:var(--ui-text);
font-size:22px;
font-weight:500;
line-height:1.1}.ui-stat>strong small{margin-left:4px;
color:var(--ui-text-muted);
font-size:11px;
font-weight:500}.ui-stat p{margin:0;
color:var(--ui-text-soft);
font-size:10px}</style>
