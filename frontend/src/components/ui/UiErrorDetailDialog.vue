<template><UiDialog :show="show" :title="title" width="wide" @close="emit('close')"><UiDescriptionList v-if="facts?.length" :items="facts"/><UiCodeBlock v-if="detail" :code="detail" label="错误详情"/></UiDialog></template>
<script setup lang="ts">
import UiCodeBlock from './UiCodeBlock.vue';
import UiDescriptionList from './UiDescriptionList.vue';
import UiDialog from './UiDialog.vue';
defineProps<{show:boolean;
title:string;
detail?:string;
facts?:Array<{label:string;
value:string|number}>}>();
const emit=defineEmits<{close:[]}>()
</script>
