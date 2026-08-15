<template><nav class="ui-breadcrumb" aria-label="面包屑"><ol><li v-for="(item,index) in items" :key="item.label"><Icon v-if="index" name="chevronRight" size="xs"/><UiLink v-if="item.to&&index<items.length-1" :to="item.to">{{ item.label }}</UiLink><span v-else :aria-current="index===items.length-1?'page':undefined">{{ item.label }}</span></li></ol></nav></template>
<script setup lang="ts">
import type {RouteLocationRaw} from 'vue-router';
import Icon from '@/components/icons/Icon.vue';
import UiLink from './UiLink.vue';
defineProps<{items:Array<{label:string;
to?:RouteLocationRaw}>}>()
</script>
<style scoped>.ui-breadcrumb ol{display:flex;
align-items:center;
gap:6px;
margin:0;
padding:0;
color:var(--ui-text-soft);
font-size:12px;
line-height:18px;
list-style:none}.ui-breadcrumb li{display:flex;
align-items:center;
gap:6px}.ui-breadcrumb li:last-child span{color:var(--ui-text-muted)}</style>
