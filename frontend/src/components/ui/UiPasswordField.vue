<template><UiTextField v-bind="$attrs" :model-value="modelValue" :type="revealed?'text':'password'" :help="rules" autocomplete="current-password" @update:model-value="emit('update:modelValue',$event)"><template #prefix><Icon name="lock" size="sm" /></template><template #suffix><button type="button" class="ui-password-toggle ui-focus-ring" :aria-label="revealed ? '隐藏密码' : '显示密码'" @click="revealed=!revealed"><Icon :name="revealed?'eyeOff':'eye'" size="sm" /></button></template></UiTextField></template>
<script setup lang="ts">

import {ref} from 'vue';
import UiTextField from './UiTextField.vue';
import Icon from '@/components/icons/Icon.vue';
defineOptions({inheritAttrs:false});
defineProps<{modelValue:string;
rules?:string}>();
const emit=defineEmits<{ 'update:modelValue':[string]}>();
const revealed=ref(false)

</script>
<style scoped>.ui-password-toggle{display:grid;
width:24px;
height:24px;
place-items:center;
padding:0;
border:0;
color:var(--ui-text-soft);
background:transparent;
cursor:pointer}.ui-password-toggle:hover{color:var(--ui-text)}</style>
