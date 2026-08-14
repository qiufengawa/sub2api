<template><div class="ui-filter-bar"><div class="ui-filter-bar__fields"><slot/></div><div class="ui-filter-bar__actions"><slot name="actions"/><UiButton v-if="activeCount" variant="quiet" density="dense" @click="emit('clear')">清除筛选 <UiBadge :label="String(activeCount)"/></UiButton></div></div></template>
<script setup lang="ts">
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
withDefaults(defineProps<{activeCount?:number}>(),{activeCount:0});
const emit=defineEmits<{clear:[]}>()
</script>
<style scoped>.ui-filter-bar{display:flex;
align-items:flex-end;
gap:10px;
padding:8px 0;
border-block:1px solid var(--ui-border-soft)}.ui-filter-bar__fields{display:flex;
min-width:0;
flex:1;
flex-wrap:wrap;
align-items:flex-end;
gap:8px}.ui-filter-bar__actions{display:flex;
align-items:center;
gap:6px}@media(max-width:640px){.ui-filter-bar{align-items:stretch;
flex-direction:column}.ui-filter-bar__fields>*{min-width:min(100%,160px);
flex:1}}</style>
