<template><UiFormField :label="label" :description="description" :error="error" :required="required"><label class="ui-upload" :class="{'ui-upload--drag':dragging,'ui-upload--disabled':disabled}" @dragenter.prevent="dragging=true" @dragover.prevent @dragleave.prevent="dragging=false" @drop.prevent="drop"><Icon name="upload" size="md"/><span><b>{{ buttonText }}</b><small>{{ acceptText }}</small></span><input type="file" :accept="accept" :multiple="multiple" :disabled="disabled" @change="select"/></label><div v-if="progress!==undefined" class="ui-upload__progress"><span :style="{width:`${Math.max(0,Math.min(100,progress))}%`}"/></div></UiFormField></template>
<script setup lang="ts">

import {ref} from 'vue';
import Icon from '@/components/icons/Icon.vue';
import UiFormField from './UiFormField.vue';
withDefaults(defineProps<{label?:string;
description?:string;
error?:string;
required?:boolean;
accept?:string;
acceptText?:string;
buttonText?:string;
multiple?:boolean;
disabled?:boolean;
progress?:number}>(),{accept:'',acceptText:'点击选择或拖放文件',buttonText:'选择文件'});
const emit=defineEmits<{select:[File[]]}>();
const dragging=ref(false);
function emitFiles(list:FileList|null){if(list)emit('select',Array.from(list))}function select(e:Event){emitFiles((e.target as HTMLInputElement).files)}function drop(e:DragEvent){dragging.value=false;
emitFiles(e.dataTransfer?.files??null)}

</script>
<style scoped>.ui-upload{display:flex;
min-height:72px;
align-items:center;
justify-content:center;
gap:10px;
padding:12px;
border:1px dashed var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text-muted);
background:var(--ui-surface);
cursor:pointer}.ui-upload--drag{border-color:var(--ui-text);
background:var(--ui-surface-muted)}.ui-upload--disabled{cursor:not-allowed;
opacity:.5}.ui-upload input{position:absolute;
width:1px;
height:1px;
opacity:0}.ui-upload span{display:grid;
gap:2px}.ui-upload b{color:var(--ui-text);
font-size:12px}.ui-upload small{font-size:10px}.ui-upload__progress{height:3px;
overflow:hidden;
border-radius:999px;
background:var(--ui-surface-strong)}.ui-upload__progress span{display:block;
height:100%;
background:var(--ui-text);
transition:width var(--ui-motion-base)}</style>
