<template><UiTextField :model-value="modelValue" :id="id" :label="label" :description="description" :error="error" type="date" :disabled="disabled" :min="min" :max="max" @update:model-value="emit('update:modelValue',$event)" /></template>
<script setup lang="ts">

import UiTextField from './UiTextField.vue';
defineProps<{modelValue:string;
id?:string;
label?:string;
description?:string;
error?:string;
disabled?:boolean;
min?:string;
max?:string}>();
const emit=defineEmits<{ 'update:modelValue':[string]}>()

</script>
