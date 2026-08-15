<template><UiIconButton :label="copied ? successText : label" :tooltip="copied ? successText : label" :density="density" :variant="copied?'success':variant" @click="copy"><Icon :name="copied?'check':'copy'" size="sm"/></UiIconButton></template>
<script setup lang="ts">

import {ref} from 'vue';
import UiIconButton from './UiIconButton.vue';
import Icon from '@/components/icons/Icon.vue';
import type {UiDensity} from './types';
const props=withDefaults(defineProps<{value:string;
label?:string;
successText?:string;
density?:UiDensity;
variant?:'outlined'|'ghost'}>(),{label:'复制',successText:'已复制',density:'dense',variant:'outlined'});
const emit=defineEmits<{success:[];
error:[unknown]}>();
const copied=ref(false);
async function copy(){try{await navigator.clipboard.writeText(props.value);
copied.value=true;
emit('success');
window.setTimeout(()=>copied.value=false,1400)}catch(e){emit('error',e)}}

</script>
