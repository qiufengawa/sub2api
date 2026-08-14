<template><Transition name="ui-toast"><div v-if="show" class="ui-toast ui-motion" :class="`ui-toast--${tone}`" role="status"><Icon :name="icon" size="sm"/><span><b v-if="title">{{ title }}</b>{{ message }}</span><button v-if="dismissible" type="button" aria-label="关闭" @click="emit('close')"><Icon name="x" size="xs"/></button></div></Transition></template>
<script setup lang="ts">
import {computed} from 'vue';
import Icon from '@/components/icons/Icon.vue';
const props=withDefaults(defineProps<{show:boolean;
tone?:'info'|'success'|'warning'|'danger';
title?:string;
message:string;
dismissible?:boolean}>(),{tone:'info',dismissible:true});
const emit=defineEmits<{close:[]}>();
const icon=computed(()=>({info:'infoCircle',success:'checkCircle',warning:'exclamationTriangle',danger:'exclamationCircle'} as const)[props.tone])
</script>
<style scoped>.ui-toast{display:grid;
width:min(360px,calc(100vw - 32px));
grid-template-columns:16px 1fr auto;
align-items:start;
gap:8px;
padding:10px 12px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text);
background:var(--ui-surface);
box-shadow:0 8px 24px rgb(0 0 0/.12);
font-size:12px}.ui-toast--success>svg{color:var(--ui-success)}.ui-toast--warning>svg{color:var(--ui-warning)}.ui-toast--danger>svg{color:var(--ui-danger)}.ui-toast--info>svg{color:var(--ui-info)}.ui-toast b{display:block;
margin-bottom:2px}.ui-toast button{border:0;
color:var(--ui-text-soft);
background:transparent}.ui-toast-enter-active,.ui-toast-leave-active{transition:opacity var(--ui-motion-base),transform var(--ui-motion-base)}.ui-toast-enter-from,.ui-toast-leave-to{opacity:0;
transform:translateY(4px)}</style>
