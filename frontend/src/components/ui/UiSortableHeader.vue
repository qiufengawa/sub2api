<template><button type="button" class="ui-sort-header" :aria-label="label" :aria-pressed="direction!==null" @click="next"><span>{{ label }}</span><Icon :name="direction==='asc'?'arrowUp':direction==='desc'?'arrowDown':'arrowsUpDown'" size="xs"/></button></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
const props=defineProps<{label:string;
direction:'asc'|'desc'|null}>();
const emit=defineEmits<{change:['asc'|'desc'|null]}>();
function next(){emit('change',props.direction===null?'asc':props.direction==='asc'?'desc':null)}
</script>
<style scoped>.ui-sort-header{display:inline-flex;
align-items:center;
gap:4px;
padding:0;
border:0;
color:inherit;
background:transparent;
font:inherit}.ui-sort-header svg{color:var(--ui-text-soft)}</style>
