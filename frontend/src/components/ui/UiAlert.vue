<template><div class="ui-alert" :class="`ui-alert--${tone}`" role="status"><Icon :name="icon" size="sm"/><div><strong v-if="title">{{ title }}</strong><p><slot>{{ message }}</slot></p></div><button v-if="dismissible" type="button" aria-label="关闭" @click="emit('dismiss')"><Icon name="x" size="xs"/></button></div></template>
<script setup lang="ts">
import {computed} from 'vue';
import Icon from '@/components/icons/Icon.vue';
const props=withDefaults(defineProps<{tone?:'info'|'success'|'warning'|'danger';
title?:string;
message?:string;
dismissible?:boolean}>(),{tone:'info',dismissible:false});
const emit=defineEmits<{dismiss:[]}>();
const icon=computed(()=>({info:'infoCircle',success:'checkCircle',warning:'exclamationTriangle',danger:'exclamationCircle'} as const)[props.tone])
</script>
<style scoped>.ui-alert{display:grid;
grid-template-columns:16px 1fr auto;
gap:9px;
padding:9px 16px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-info);
background:color-mix(in srgb,var(--ui-info) 6%,var(--ui-surface))}.ui-alert--success{color:var(--ui-success);
background:color-mix(in srgb,var(--ui-success) 6%,var(--ui-surface))}.ui-alert--warning{color:var(--ui-warning);
background:color-mix(in srgb,var(--ui-warning) 6%,var(--ui-surface))}.ui-alert--danger{color:var(--ui-danger);
background:color-mix(in srgb,var(--ui-danger) 6%,var(--ui-surface))}.ui-alert strong{display:block;
font-size:13px;line-height:22px}.ui-alert p{margin:1px 0 0;
color:var(--ui-text-muted);
font-size:13px;
line-height:22px}.ui-alert button{border:0;
color:currentColor;
background:transparent}</style>
