<template><span class="ui-badge" :class="[`ui-badge--${tone}`,{'ui-badge--dot':dot}]"><span v-if="dot" aria-hidden="true"/><slot>{{ label }}</slot></span></template>
<script setup lang="ts">
withDefaults(defineProps<{label?:string;
tone?:'neutral'|'success'|'warning'|'danger'|'info';
dot?:boolean}>(),{tone:'neutral',dot:false})
</script>
<style scoped>.ui-badge{display:inline-flex;
min-height:20px;
align-items:center;
gap:5px;
padding:2px 7px;
border:1px solid var(--ui-border);
border-radius:4px;
color:var(--ui-text-muted);
background:var(--ui-surface-muted);
font-size:11px;
font-weight:600;
line-height:14px;
white-space:nowrap}.ui-badge--dot>span{width:6px;
height:6px;
border-radius:50%;
background:currentColor}.ui-badge--success{border-color:color-mix(in srgb,var(--ui-success) 25%,var(--ui-border));
color:var(--ui-success);
background:color-mix(in srgb,var(--ui-success) 8%,var(--ui-surface))}.ui-badge--warning{color:var(--ui-warning);
background:color-mix(in srgb,var(--ui-warning) 8%,var(--ui-surface))}.ui-badge--danger{color:var(--ui-danger);
background:color-mix(in srgb,var(--ui-danger) 8%,var(--ui-surface))}.ui-badge--info{color:var(--ui-info);
background:color-mix(in srgb,var(--ui-info) 8%,var(--ui-surface))}</style>
