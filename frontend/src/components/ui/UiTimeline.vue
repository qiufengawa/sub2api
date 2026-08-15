<template><ol class="ui-timeline"><li v-for="item in items" :key="item.key"><span :class="`is-${item.tone||'neutral'}`"><Icon :name="item.icon||'check'" size="xs"/></span><div><div><strong>{{ item.title }}</strong><time class="ui-numeric">{{ item.time }}</time></div><p v-if="item.description">{{ item.description }}</p></div></li></ol></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
type IconName=InstanceType<typeof Icon>['$props']['name'];
defineProps<{items:Array<{key:string;
title:string;
time:string;
description?:string;
icon?:IconName;
tone?:'neutral'|'success'|'warning'|'danger'}>}>()
</script>
<style scoped>.ui-timeline{position:relative;
display:grid;
gap:16px;
margin:0;
padding:0;
list-style:none}.ui-timeline:before{position:absolute;
top:12px;
bottom:12px;
left:11px;
width:1px;
background:var(--ui-border);
content:""}.ui-timeline li{position:relative;
display:grid;
grid-template-columns:24px 1fr;
gap:10px}.ui-timeline li>span{z-index:1;
display:grid;
width:24px;
height:24px;
place-items:center;
border:1px solid var(--ui-border);
border-radius:50%;
color:var(--ui-text-muted);
background:var(--ui-surface)}.ui-timeline li>span.is-success{color:var(--ui-success)}.ui-timeline li>span.is-warning{color:var(--ui-warning)}.ui-timeline li>span.is-danger{color:var(--ui-danger)}.ui-timeline li>div>div{display:flex;
justify-content:space-between;
gap:10px}.ui-timeline strong{font-size:12px}.ui-timeline time{color:var(--ui-text-soft);
font-size:10px}.ui-timeline p{margin:3px 0 0;
color:var(--ui-text-muted);
font-size:11px;
line-height:17px}</style>
