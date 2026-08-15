<template><Teleport to="body"><div v-if="show" ref="panelRef" class="ui-image-preview" :style="{zIndex}" role="dialog" aria-modal="true" :aria-label="alt" tabindex="-1" @click.self="emit('close')"><div class="ui-image-preview__tools"><UiIconButton label="下载" @click="download"><Icon name="download" size="sm"/></UiIconButton><UiIconButton label="关闭" @click="emit('close')"><Icon name="x" size="sm"/></UiIconButton></div><img :src="src" :alt="alt" draggable="false"/></div></Teleport></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
import { toRef } from 'vue';
import UiIconButton from './UiIconButton.vue';
import { useOverlayLifecycle } from './useOverlayLifecycle';
const props=defineProps<{show:boolean;
src:string;
alt:string;
filename?:string}>();
const emit=defineEmits<{close:[]}>();
const { panelRef, zIndex } = useOverlayLifecycle(toRef(props, 'show'), () => emit('close'), { zIndex: 100_000_100 })
function download(){const a=document.createElement('a');
a.href=props.src;
a.download=props.filename||'image';
a.click()}
</script>
<style scoped>.ui-image-preview{position:fixed;
z-index:100000100;
inset:0;
display:grid;
place-items:center;
padding:24px;
background:rgb(0 0 0/.82)}.ui-image-preview img{max-width:100%;
max-height:calc(100dvh - 48px);
object-fit:contain;
user-select:none}.ui-image-preview__tools{position:fixed;
z-index:1;
top:16px;
right:16px;
display:flex;
gap:6px}</style>
