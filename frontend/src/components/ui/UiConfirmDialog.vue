<template><ConfirmDialog v-bind="$attrs" :show="show" :title="title" :message="message" :danger="danger" :pending="pending" @confirm="emit('confirm')" @cancel="emit('cancel')"><slot/></ConfirmDialog></template>
<script setup lang="ts">
import ConfirmDialog from '@/components/common/ConfirmDialog.vue';
defineOptions({inheritAttrs:false});
withDefaults(defineProps<{show:boolean;
title:string;
message:string;
danger?:boolean;
pending?:boolean}>(),{danger:false,pending:false});
const emit=defineEmits<{confirm:[];
cancel:[]}>()
</script>
