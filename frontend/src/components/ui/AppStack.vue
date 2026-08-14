<template><div class="app-stack" :style="{gap:`${gap}px`}"><slot/></div></template>
<script setup lang="ts">
withDefaults(defineProps<{gap?:number}>(),{gap:12})
</script>
<style scoped>.app-stack{display:flex;
min-width:0;
flex-direction:column}</style>
