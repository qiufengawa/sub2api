<template><span class="ui-spinner" :class="`ui-spinner--${size}`" role="status" :aria-label="label"/></template>
<script setup lang="ts">
withDefaults(defineProps<{size?:'sm'|'md'|'lg';
label?:string}>(),{size:'md',label:'加载中'})
</script>
<style scoped>.ui-spinner{display:inline-block;
border:1.5px solid color-mix(in srgb,currentColor 25%,transparent);
border-top-color:currentColor;
border-radius:50%;
animation:ui-spin .7s linear infinite}.ui-spinner--sm{width:12px;
height:12px}.ui-spinner--md{width:16px;
height:16px}.ui-spinner--lg{width:24px;
height:24px}@keyframes ui-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.ui-spinner{animation:none;border-top-color:transparent}}</style>
