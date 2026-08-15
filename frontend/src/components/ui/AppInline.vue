<template><div class="app-inline" :class="{'app-inline--nowrap':!wrap}" :style="{gap:`${gap}px`,justifyContent:justify}"><slot/></div></template>
<script setup lang="ts">
withDefaults(defineProps<{gap?:number;
wrap?:boolean;
justify?:'flex-start'|'center'|'space-between'|'flex-end'}>(),{gap:8,wrap:true,justify:'flex-start'})
</script>
<style scoped>.app-inline{display:flex;
min-width:0;
align-items:center;
flex-wrap:wrap}.app-inline--nowrap{flex-wrap:nowrap}</style>
