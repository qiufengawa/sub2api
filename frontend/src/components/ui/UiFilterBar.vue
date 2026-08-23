<template><div class="ui-filter-bar"><div class="ui-filter-bar__fields"><slot/></div><div class="ui-filter-bar__actions"><slot name="actions"/><UiButton v-if="activeCount" variant="quiet" density="dense" @click="emit('clear')">{{ clearLabel }} <UiBadge :label="String(activeCount)"/></UiButton></div></div></template>
<script setup lang="ts">
import UiBadge from './UiBadge.vue';
import UiButton from './UiButton.vue';
withDefaults(defineProps<{activeCount?:number;clearLabel?:string}>(),{activeCount:0,clearLabel:'清除筛选'});
const emit=defineEmits<{clear:[]}>()
</script>
<style scoped>.ui-filter-bar{display:flex;
align-items:flex-end;
gap:10px;
padding:8px 0}.ui-filter-bar__fields{display:flex;
min-width:0;
flex:1;
flex-wrap:wrap;
align-items:flex-end;
gap:8px}.ui-filter-bar__actions{display:flex;
align-items:center;
gap:6px}@media(max-width:640px){.ui-filter-bar{align-items:stretch;
flex-direction:column}.ui-filter-bar__fields{width:100%}.ui-filter-bar__fields>*{min-width:min(100%,160px);
flex:1}.ui-filter-bar__fields>:deep(.ui-button){width:100%;min-width:0;justify-content:flex-start}.ui-filter-bar__actions{width:100%;flex-wrap:wrap;justify-content:flex-start}}</style>
