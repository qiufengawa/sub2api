<template><div class="ui-table-scroller" tabindex="0" role="region" :aria-label="label"><div :style="{minWidth}"><slot/></div></div></template>
<script setup lang="ts">
withDefaults(defineProps<{label?:string;
minWidth?:string}>(),{label:'可横向滚动的数据表',minWidth:'720px'})
</script>
<style scoped>.ui-table-scroller{max-width:100%;
overflow-x:auto;
overscroll-behavior-x:contain}.ui-table-scroller:focus-visible{outline:2px solid color-mix(in srgb,var(--ui-focus) 20%,transparent);
outline-offset:2px}</style>
