<template><div class="ui-error-state"><Icon name="exclamationCircle" size="lg"/><h3>{{ title }}</h3><p v-if="description">{{ description }}</p><UiButton v-if="retryText" density="compact" @click="emit('retry')">{{ retryText }}</UiButton></div></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
import UiButton from './UiButton.vue';
withDefaults(defineProps<{title:string;
description?:string;
retryText?:string}>(),{retryText:'重试'});
const emit=defineEmits<{retry:[]}>()
</script>
<style scoped>.ui-error-state{display:flex;
min-height:112px;
flex-direction:column;
align-items:center;
justify-content:center;
padding:24px;
color:var(--ui-danger);
text-align:center}.ui-error-state h3{margin:10px 0 0;
color:var(--ui-text);
font-size:14px}.ui-error-state p{max-width:380px;
margin:5px 0 14px;
color:var(--ui-text-muted);
font-size:12px;
line-height:19px}</style>
