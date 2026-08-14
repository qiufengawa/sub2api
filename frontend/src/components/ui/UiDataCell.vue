<template><div class="ui-data-cell" :class="{'ui-data-cell--mono':mono}"><div><strong :title="String(value)">{{ value }}</strong><small v-if="meta">{{ meta }}</small></div><UiCopyButton v-if="copyable" :value="String(value)" variant="ghost"/></div></template>
<script setup lang="ts">
import UiCopyButton from './UiCopyButton.vue';
defineProps<{value:string|number;
meta?:string;
mono?:boolean;
copyable?:boolean}>()
</script>
<style scoped>.ui-data-cell{display:flex;
min-width:0;
align-items:center;
gap:6px}.ui-data-cell>div{display:grid;
min-width:0}.ui-data-cell strong{overflow:hidden;
color:var(--ui-text);
font-size:12px;
font-weight:500;
text-overflow:ellipsis;
white-space:nowrap}.ui-data-cell small{overflow:hidden;
color:var(--ui-text-soft);
font-size:10px;
text-overflow:ellipsis;
white-space:nowrap}.ui-data-cell--mono strong{font-family:var(--ui-font-mono);
font-variant-numeric:tabular-nums}</style>
