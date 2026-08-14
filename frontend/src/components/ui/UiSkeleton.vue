<template><Skeleton :variant="variant" :width="width" :height="height" class="ui-skeleton"/></template>
<script setup lang="ts">
import Skeleton from '@/components/common/Skeleton.vue';
withDefaults(defineProps<{variant?:'rect'|'circle'|'text';
width?:string|number;
height?:string|number}>(),{variant:'rect',width:'100%'})
</script>
<style scoped>:deep(.ui-skeleton){border-radius:var(--ui-radius-dense);
background:var(--ui-surface-strong)}</style>
