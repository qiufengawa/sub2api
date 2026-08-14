<template><UiFormField :for-id="id" :label="label" :description="description" :error="error" :required="required"><Select :id="id" :model-value="modelValue" :options="options" :placeholder="placeholder" :disabled="disabled" :error="Boolean(error)" :searchable="false" :clearable="clearable" :aria-label="label" @update:model-value="emit('update:modelValue',$event)" @change="onChange"><template v-if="$slots.option" #option="scope"><slot name="option" v-bind="scope" /></template></Select></UiFormField></template>
<script setup lang="ts">

import Select,{type SelectOption} from '@/components/common/Select.vue';
import UiFormField from './UiFormField.vue';
defineProps<{modelValue:string|number|boolean|null|undefined;
options:SelectOption[];
id?:string;
label?:string;
description?:string;
error?:string;
required?:boolean;
placeholder?:string;
disabled?:boolean;
clearable?:boolean}>();
const emit=defineEmits<{ 'update:modelValue':[string|number|boolean|null];
change:[string|number|boolean|null,SelectOption|null]}>();
function onChange(value:string|number|boolean|null,option:SelectOption|null){emit('change',value,option)}

</script>
<style scoped>:deep(.select-trigger){height:var(--ui-control-default);
border-color:var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text);
background:var(--ui-surface);
box-shadow:none}:deep(.select-trigger:hover){border-color:var(--ui-text-soft)}</style>
