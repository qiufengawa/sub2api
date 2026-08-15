<template><div class="ui-ring" :style="{'--value':normalized,'--size':`${size}px`}"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16"/><circle class="ui-ring__value" cx="20" cy="20" r="16"/></svg><span><b class="ui-numeric">{{ normalized }}%</b><small v-if="label">{{ label }}</small></span></div></template>
<script setup lang="ts">
import {computed} from 'vue';
const props=withDefaults(defineProps<{value:number;
label?:string;
size?:number}>(),{size:88});
const normalized=computed(()=>Math.round(Math.max(0,Math.min(100,props.value))))
</script>
<style scoped>.ui-ring{position:relative;
display:grid;
width:var(--size);
height:var(--size);
place-items:center}.ui-ring svg{position:absolute;
inset:0;
transform:rotate(-90deg)}.ui-ring circle{fill:none;
stroke:var(--ui-surface-strong);
stroke-width:3}.ui-ring__value{stroke:var(--ui-text);
stroke-dasharray:100;
stroke-dashoffset:calc(100 - var(--value));
stroke-linecap:round;
transition:stroke-dashoffset var(--ui-motion-slow)}.ui-ring>span{display:grid;
text-align:center}.ui-ring b{font-size:16px}.ui-ring small{color:var(--ui-text-soft);
font-size:9px}</style>
