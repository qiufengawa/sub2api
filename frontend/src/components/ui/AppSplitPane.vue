<template><div class="app-split" :class="{'app-split--reverse':reverse}" :style="{'--split-master':masterWidth}"><aside><slot name="master"/></aside><section><slot/></section></div></template>
<script setup lang="ts">
withDefaults(defineProps<{masterWidth?:string;
reverse?:boolean}>(),{masterWidth:'320px',reverse:false})
</script>
<style scoped>.app-split{display:grid;
min-height:0;
grid-template-columns:var(--split-master) minmax(0,1fr);
gap:16px}.app-split--reverse{grid-template-columns:minmax(0,1fr) var(--split-master)}.app-split--reverse>aside{order:2}.app-split>aside,.app-split>section{min-width:0}@media(max-width:900px){.app-split,.app-split--reverse{grid-template-columns:1fr}.app-split--reverse>aside{order:0}}</style>
