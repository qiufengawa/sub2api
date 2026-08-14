<template><div class="app-grid" :style="{'--grid-min':min,'--grid-gap':`${gap}px`}"><slot/></div></template>
<script setup lang="ts">
withDefaults(defineProps<{min?:string;
gap?:number}>(),{min:'240px',gap:16})
</script>
<style scoped>.app-grid{display:grid;
min-width:0;
grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--grid-min)),1fr));
gap:var(--grid-gap)}</style>
