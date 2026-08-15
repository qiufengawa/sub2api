<template><label class="ui-check" :class="{'ui-check--disabled':disabled}"><input v-bind="$attrs" type="checkbox" :checked="modelValue" :disabled="disabled" :indeterminate="indeterminate" @change="emit('update:modelValue',($event.target as HTMLInputElement).checked)"/><span class="ui-check__box"><Icon name="check" size="xs"/></span><span v-if="label||$slots.default"><slot>{{ label }}</slot></span></label></template>
<script setup lang="ts">

import Icon from '@/components/icons/Icon.vue';
defineOptions({inheritAttrs:false});
defineProps<{modelValue:boolean;
label?:string;
disabled?:boolean;
indeterminate?:boolean}>();
const emit=defineEmits<{ 'update:modelValue':[boolean]}>()

</script>
<style scoped>.ui-check{display:inline-flex;
align-items:center;
gap:7px;
color:var(--ui-text);
font-size:13px;
line-height:22px;
cursor:pointer}.ui-check input{position:absolute;
opacity:0}.ui-check__box{display:grid;
width:16px;
height:16px;
place-items:center;
border:1px solid var(--ui-border);
border-radius:4px;
color:transparent;
background:var(--ui-surface)}.ui-check input:checked+.ui-check__box{border-color:var(--ui-text);
color:var(--ui-inverse);
background:var(--ui-text)}.ui-check input:focus-visible+.ui-check__box{outline:2px solid color-mix(in srgb,var(--ui-focus) 20%,transparent);
outline-offset:2px}.ui-check--disabled{cursor:not-allowed;
opacity:.5}</style>
