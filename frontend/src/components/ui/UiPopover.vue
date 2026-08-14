<template><span ref="root" class="ui-popover"><span @click="toggle"><slot name="trigger" :open="open"/></span><Teleport to="body"><Transition name="ui-popover"><div v-if="open" ref="panel" class="ui-popover__panel ui-motion" :style="style" role="dialog"><slot :close="close"/></div></Transition></Teleport></span></template>
<script setup lang="ts">
import {nextTick,onBeforeUnmount,onMounted,ref} from 'vue';
const props=withDefaults(defineProps<{placement?:'bottom-start'|'bottom-end';
closeOnSelect?:boolean}>(),{placement:'bottom-start',closeOnSelect:false});
const open=ref(false),root=ref<HTMLElement>(),panel=ref<HTMLElement>(),style=ref<Record<string,string>>({});
function close(){open.value=false}async function toggle(){open.value=!open.value;
if(open.value){await nextTick();
position()}}function position(){const r=root.value?.getBoundingClientRect(),p=panel.value;
if(!r||!p)return;
const width=p.offsetWidth,height=p.offsetHeight;
const left=props.placement==='bottom-end'?r.right-width:r.left;
const below=r.bottom+6,above=r.top-height-6;
const top=below+height<=innerHeight-8?below:Math.max(8,above);
style.value={top:`${top}px`,left:`${Math.max(8,Math.min(innerWidth-width-8,left))}px`,maxHeight:`${Math.max(120,innerHeight-16)}px`,overflowY:'auto'}}function outside(e:MouseEvent){const n=e.target as Node;
if(open.value&&!root.value?.contains(n)&&!panel.value?.contains(n))close()}function key(e:KeyboardEvent){if(e.key==='Escape')close()}onMounted(()=>{document.addEventListener('click',outside,true);
document.addEventListener('keydown',key);
window.addEventListener('resize',position);
window.addEventListener('scroll',position,true)});
onBeforeUnmount(()=>{document.removeEventListener('click',outside,true);
document.removeEventListener('keydown',key);
window.removeEventListener('resize',position);
window.removeEventListener('scroll',position,true)})
</script>
<style scoped>.ui-popover{display:inline-flex}.ui-popover__panel{position:fixed;
z-index:100000010;
min-width:180px;
max-width:min(320px,calc(100vw - 16px));
padding:6px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text);
background:var(--ui-surface);
box-shadow:0 8px 24px rgb(31 35 41/.08)}.ui-popover-enter-active,.ui-popover-leave-active{transition:opacity var(--ui-motion-fast),transform var(--ui-motion-fast)}.ui-popover-enter-from,.ui-popover-leave-to{opacity:0;
transform:translateY(-2px)}</style>
