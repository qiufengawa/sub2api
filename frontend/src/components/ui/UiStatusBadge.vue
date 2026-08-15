<template><span class="ui-status" :class="`ui-status--${tone}`"><i aria-hidden="true"/><slot>{{ label }}</slot></span></template>
<script setup lang="ts">
import {computed} from 'vue';
const props=defineProps<{status:string;
label:string}>();
const tone=computed<'neutral'|'success'|'warning'|'danger'|'info'>(()=>{if(['active','success','healthy','ready','online'].includes(props.status))return'success';
if(['warning','pending','stale'].includes(props.status))return'warning';
if(['error','danger','failed','offline'].includes(props.status))return'danger';
if(['info','running','reconnecting'].includes(props.status))return'info';
return'neutral'})
</script>
<style scoped>.ui-status{display:inline-flex;align-items:center;gap:6px;color:var(--ui-text-muted);font-size:13px;line-height:22px;white-space:nowrap}.ui-status i{width:6px;height:6px;border-radius:50%;background:var(--ui-text-soft)}.ui-status--success i{background:var(--ui-success)}.ui-status--warning i{background:var(--ui-warning)}.ui-status--danger i{background:var(--ui-danger)}.ui-status--info i{background:var(--ui-info)}</style>
