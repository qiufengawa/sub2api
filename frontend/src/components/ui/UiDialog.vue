<template><BaseDialog v-bind="$attrs" :show="show" :title="title" :width="width" @close="emit('close')"><slot/><template v-if="$slots.footer" #footer><slot name="footer"/></template></BaseDialog></template>
<script setup lang="ts">
import BaseDialog from '@/components/common/BaseDialog.vue';
defineOptions({inheritAttrs:false});
withDefaults(defineProps<{show:boolean;
title:string;
width?:'narrow'|'normal'|'wide'|'extra-wide'|'full'}>(),{width:'normal'});
const emit=defineEmits<{close:[]}>()
</script>
<style scoped>:deep(.modal-content){border:1px solid var(--ui-border)!important;
border-radius:var(--ui-radius-panel)!important;
background:var(--ui-surface)!important;
box-shadow:0 10px 30px rgb(31 35 41/.1)!important}:deep(.modal-header),:deep(.modal-footer){border-color:var(--ui-border-soft)!important}:deep(.modal-title){color:var(--ui-text)!important;
font-size:16px!important;
letter-spacing:0!important}</style>
