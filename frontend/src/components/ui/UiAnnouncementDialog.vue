<template><UiDialog :show="show" :title="title" width="normal" @close="emit('close')"><div class="ui-announcement"><time v-if="time" class="ui-numeric">{{ time }}</time><div class="ui-announcement__content"><slot/></div></div><template v-if="$slots.footer" #footer><slot name="footer"/></template></UiDialog></template>
<script setup lang="ts">
import UiDialog from './UiDialog.vue';
defineProps<{show:boolean;
title:string;
time?:string}>();
const emit=defineEmits<{close:[]}>()
</script>
<style scoped>.ui-announcement{display:grid;
gap:12px}.ui-announcement>time{color:var(--ui-text-soft);
font-size:10px}.ui-announcement__content{color:var(--ui-text-muted);
font-size:13px;
line-height:1.75;
overflow-wrap:anywhere}</style>
