<template>
  <div class="ui-command" @keydown="onKeydown">
    <UiSearchInput v-model="query" :placeholder="placeholder" :debounce-ms="0" input-role="combobox" :aria-expanded="true" :aria-controls="listId" :aria-activedescendant="activeOptionId" aria-autocomplete="list" />
    <div :id="listId" class="ui-command__list" role="listbox" :aria-label="placeholder">
      <button v-for="(item, index) in filtered" :id="optionId(item.key)" :key="item.key" type="button" role="option" :disabled="item.disabled" :aria-selected="index === activeIndex" :tabindex="index === activeIndex ? 0 : -1" @mouseenter="activeIndex = index" @focus="activeIndex = index" @click="select(item)">
        <Icon v-if="item.icon" :name="item.icon" size="sm" /><span><b>{{ item.label }}</b><small v-if="item.description">{{ item.description }}</small></span><kbd v-if="item.shortcut">{{ item.shortcut }}</kbd>
      </button>
      <p v-if="!filtered.length">{{ emptyText }}</p>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch, useId } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiSearchInput from './UiSearchInput.vue'
type IconName = InstanceType<typeof Icon>['$props']['name']
export interface UiCommandItem { key:string; label:string; description?:string; shortcut?:string; icon?:IconName; disabled?:boolean }
const props = withDefaults(defineProps<{items:UiCommandItem[];placeholder?:string;emptyText?:string}>(),{placeholder:'搜索命令',emptyText:'没有匹配项'})
const emit = defineEmits<{select:[UiCommandItem]}>(); const query=ref(''); const activeIndex=ref(-1); const listId=`ui-command-${useId()}`
const filtered=computed(()=>{const q=query.value.trim().toLowerCase(); return q?props.items.filter(i=>`${i.label} ${i.description||''}`.toLowerCase().includes(q)):props.items})
const enabledIndexes=computed(()=>filtered.value.map((item,index)=>item.disabled?-1:index).filter(index=>index>=0))
const activeOptionId=computed(()=>activeIndex.value>=0?optionId(filtered.value[activeIndex.value]?.key||''):undefined)
function optionId(key:string):string{return `${listId}-option-${key.replace(/[^a-zA-Z0-9_-]/g,'-')}`}
function select(item:UiCommandItem):void{if(!item.disabled)emit('select',item)}
function move(delta:number):void{if(!enabledIndexes.value.length)return;const current=enabledIndexes.value.indexOf(activeIndex.value);const next=current<0?(delta>0?0:enabledIndexes.value.length-1):(current+delta+enabledIndexes.value.length)%enabledIndexes.value.length;activeIndex.value=enabledIndexes.value[next];void nextTick(()=>document.getElementById(activeOptionId.value||'')?.focus())}
function onKeydown(event:KeyboardEvent):void{if(event.key==='ArrowDown'){event.preventDefault();move(1)}else if(event.key==='ArrowUp'){event.preventDefault();move(-1)}else if(event.key==='Home'){event.preventDefault();activeIndex.value=enabledIndexes.value[0]??-1}else if(event.key==='End'){event.preventDefault();activeIndex.value=enabledIndexes.value.at(-1)??-1}else if(event.key==='Enter'&&activeIndex.value>=0){event.preventDefault();select(filtered.value[activeIndex.value])}}
watch(filtered,()=>{activeIndex.value=enabledIndexes.value[0]??-1})
</script>
<style scoped>.ui-command{display:grid;gap:6px;width:min(420px,100%)}.ui-command__list{display:grid;gap:2px;max-height:320px;overflow:auto}.ui-command__list button{display:grid;min-height:38px;grid-template-columns:16px 1fr auto;align-items:center;gap:8px;padding:6px 8px;border:0;border-radius:4px;color:var(--ui-text);background:transparent;text-align:left}.ui-command__list button:hover,.ui-command__list button:focus-visible,.ui-command__list button[aria-selected="true"]{background:var(--ui-surface-muted);outline:none}.ui-command__list button:disabled{opacity:.45;cursor:not-allowed}.ui-command__list span{display:grid}.ui-command__list b{font-size:12px}.ui-command__list small{color:var(--ui-text-soft);font-size:10px}.ui-command__list kbd{color:var(--ui-text-soft);font-size:10px}.ui-command__list>p{margin:20px;color:var(--ui-text-soft);font-size:12px;text-align:center}</style>
