<template><component :is="to?RouterLink:'button'" :to="to" :type="to?undefined:'button'" class="ui-nav-item" :class="{'is-active':active,'is-collapsed':collapsed}" :aria-current="active?'page':undefined" :title="collapsed?label:undefined"><slot name="icon"/><span>{{ label }}</span><small v-if="badge" class="ui-numeric">{{ badge }}</small></component></template>
<script setup lang="ts">
import {RouterLink} from 'vue-router';
import type {RouteLocationRaw} from 'vue-router';
defineProps<{label:string;
to?:RouteLocationRaw;
active?:boolean;
collapsed?:boolean;
badge?:string|number}>()
</script>
<style scoped>.ui-nav-item{display:flex;
width:100%;
height:32px;
align-items:center;
gap:8px;
padding:0 12px;
border:0;
border-radius:var(--ui-radius);
color:var(--ui-text-muted);
background:transparent;
font-size:14px;
line-height:20px;
text-decoration:none}.ui-nav-item:hover{color:var(--ui-text);
background:var(--ui-surface-muted)}.ui-nav-item.is-active{color:var(--ui-text);
background:var(--ui-surface-strong);
font-weight:500}.ui-nav-item small{margin-left:auto}.ui-nav-item.is-collapsed{width:32px;
justify-content:center;
padding:0}.ui-nav-item.is-collapsed span,.ui-nav-item.is-collapsed small{display:none}</style>
