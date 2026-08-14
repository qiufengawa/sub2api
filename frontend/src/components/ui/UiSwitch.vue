<template><button type="button" class="ui-switch" :class="{'ui-switch--on':modelValue}" role="switch" :aria-checked="modelValue" :aria-label="label" :disabled="disabled" @click="emit('update:modelValue',!modelValue)"><span/></button></template>
<script setup lang="ts">

defineProps<{modelValue:boolean;
label:string;
disabled?:boolean}>();
const emit=defineEmits<{ 'update:modelValue':[boolean]}>()

</script>
<style scoped>.ui-switch{position:relative;
width:34px;
height:20px;
padding:0;
border:1px solid var(--ui-border);
border-radius:999px;
background:var(--ui-surface-strong);
cursor:pointer;
transition:background var(--ui-motion-fast)}.ui-switch span{position:absolute;
top:2px;
left:2px;
width:14px;
height:14px;
border-radius:50%;
background:var(--ui-surface);
box-shadow:0 1px 2px rgb(0 0 0/.16);
transition:transform var(--ui-motion-fast)}.ui-switch--on{border-color:var(--ui-text);
background:var(--ui-text)}.ui-switch--on span{transform:translateX(14px)}.ui-switch:disabled{cursor:not-allowed;
opacity:.45}</style>
