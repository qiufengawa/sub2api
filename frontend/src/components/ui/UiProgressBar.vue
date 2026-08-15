<template><div class="ui-progress"><div v-if="label||showValue" class="ui-progress__meta"><span>{{ label }}</span><b v-if="showValue" class="ui-numeric">{{ normalized }}%</b></div><div class="ui-progress__track" role="progressbar" :aria-valuenow="normalized" aria-valuemin="0" aria-valuemax="100" :aria-label="label"><span :class="`is-${tone}`" :style="{width:`${normalized}%`}"/></div></div></template>
<script setup lang="ts">
import {computed} from 'vue';
const props=withDefaults(defineProps<{value:number;
label?:string;
showValue?:boolean;
tone?:'neutral'|'success'|'warning'|'danger'|'info'}>(),{showValue:true,tone:'neutral'});
const normalized=computed(()=>Math.round(Math.max(0,Math.min(100,props.value))))
</script>
<style scoped>.ui-progress{display:grid;
gap:6px}.ui-progress__meta{display:flex;
justify-content:space-between;
gap:12px;
color:var(--ui-text-muted);
font-size:11px}.ui-progress__meta b{color:var(--ui-text);
font-weight:600}.ui-progress__track{height:6px;
overflow:hidden;
border-radius:999px;
background:var(--ui-surface-strong)}.ui-progress__track span{display:block;
height:100%;
border-radius:inherit;
background:var(--ui-text);
transition:width var(--ui-motion-base)}.ui-progress__track .is-success{background:var(--ui-success)}.ui-progress__track .is-warning{background:var(--ui-warning)}.ui-progress__track .is-danger{background:var(--ui-danger)}.ui-progress__track .is-info{background:var(--ui-info)}</style>
