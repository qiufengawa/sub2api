<template><UiStatusBadge :status="status" :label="resolvedLabel"/></template>
<script setup lang="ts">
import{computed}from'vue';
import UiStatusBadge from './UiStatusBadge.vue';
const props=defineProps<{status:'live'|'reconnecting'|'stale'|'offline';
label?:string}>();
const resolvedLabel=computed(()=>props.label||({live:'实时',reconnecting:'重新连接中',stale:'数据延迟',offline:'离线'} as const)[props.status])
</script>
