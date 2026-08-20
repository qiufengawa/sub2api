<template>
  <UiFormField :label="label" :description="description" :error="error">
    <div class="ui-entity-picker" @focusin="onFocusIn" @focusout="closeLater" @keydown="onKeydown">
      <UiSearchInput
        :model-value="query"
        :placeholder="placeholder"
        :disabled="disabled"
        input-role="combobox"
        aria-autocomplete="list"
        :aria-expanded="showResults"
        :aria-controls="listboxId"
        :aria-activedescendant="activeOptionId"
        @update:model-value="search"
      />
      <div v-if="showResults" :id="listboxId" class="ui-entity-picker__results" role="listbox">
        <p v-if="loading" role="status"><UiSpinner size="sm" />{{ loadingText }}</p>
        <button v-for="(item,index) in items" v-else :id="optionId(index)" :key="String(item.value)" type="button" role="option" :class="{'is-active':index===activeIndex}" :aria-selected="item.value===modelValue" tabindex="-1" @mouseenter="activeIndex=index" @click="select(item)">
          <span><strong>{{ item.label }}</strong><small v-if="item.description">{{ item.description }}</small></span>
          <Icon v-if="item.value===modelValue" class="ui-entity-picker__selected" name="check" size="sm" />
        </button>
        <p v-if="!loading && !items.length">{{ emptyText }}</p>
      </div>
    </div>
  </UiFormField>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiFormField from './UiFormField.vue'; import UiSearchInput from './UiSearchInput.vue'; import UiSpinner from './UiSpinner.vue'
export interface UiEntityOption { label:string; value:string|number; description?:string }
const props=withDefaults(defineProps<{modelValue?:string|number|null;items:UiEntityOption[];selectedLabel?:string;label?:string;description?:string;error?:string;placeholder?:string;emptyText?:string;loadingText?:string;loading?:boolean;disabled?:boolean;searchOnFocus?:boolean;showResultsWithoutQuery?:boolean;clearAfterSelect?:boolean}>(),{placeholder:'搜索用户、账号或密钥',emptyText:'没有匹配结果',loadingText:'正在搜索',searchOnFocus:false,showResultsWithoutQuery:false,clearAfterSelect:false})
const emit=defineEmits<{ 'update:modelValue':[string|number|null]; search:[string]; select:[UiEntityOption] }>()
let pickerId=0
const listboxId=`ui-entity-picker-${++pickerId}`
const query=ref(props.selectedLabel||'')
const open=ref(false)
const activeIndex=ref(-1)
let closeTimer:number|null=null
const showResults=computed(()=>Boolean(open.value&&(query.value||props.showResultsWithoutQuery)&&(props.loading||props.items.length||props.emptyText)))
const optionId=(index:number)=>`${listboxId}-option-${index}`
const activeOptionId=computed(()=>activeIndex.value>=0&&activeIndex.value<props.items.length?optionId(activeIndex.value):undefined)
watch(()=>props.selectedLabel,value=>{if(value!==undefined)query.value=value})
watch(()=>props.items,()=>{if(activeIndex.value>=props.items.length)activeIndex.value=props.items.length-1})
function search(value:string){query.value=value;open.value=true;activeIndex.value=props.items.length?0:-1;emit('search',value);if(!value)emit('update:modelValue',null)}
function select(item:UiEntityOption){query.value=props.clearAfterSelect?'':item.label;open.value=false;activeIndex.value=-1;emit('update:modelValue',item.value);emit('select',item)}
function onFocusIn(){if(closeTimer){clearTimeout(closeTimer);closeTimer=null}const wasOpen=open.value;open.value=true;if(props.searchOnFocus&&!wasOpen&&!query.value)emit('search','')}
function closeLater(){if(closeTimer)clearTimeout(closeTimer);closeTimer=window.setTimeout(()=>{closeTimer=null;open.value=false;activeIndex.value=-1},0)}
function onKeydown(event:KeyboardEvent){
  if(props.disabled)return
  if(event.key==='Escape'){if(open.value){event.preventDefault();open.value=false;activeIndex.value=-1}return}
  if(!props.items.length)return
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();open.value=true
    const offset=event.key==='ArrowDown'?1:-1
    const start=activeIndex.value<0?(offset>0?-1:0):activeIndex.value
    activeIndex.value=(start+offset+props.items.length)%props.items.length
    return
  }
  if(event.key==='Home'){event.preventDefault();open.value=true;activeIndex.value=0;return}
  if(event.key==='End'){event.preventDefault();open.value=true;activeIndex.value=props.items.length-1;return}
  if(event.key==='Enter'&&open.value&&activeIndex.value>=0){event.preventDefault();select(props.items[activeIndex.value])}
}
onUnmounted(()=>{if(closeTimer)clearTimeout(closeTimer)})
</script>
<style scoped>.ui-entity-picker{position:relative}.ui-entity-picker__selected{color:var(--ui-success)}.ui-entity-picker__results{position:absolute;z-index:40;top:calc(100% + 5px);width:100%;max-height:250px;padding:5px;overflow:auto;border:1px solid var(--ui-border);border-radius:var(--ui-radius-panel);background:var(--ui-surface);box-shadow:0 10px 28px rgb(31 35 41/.12)}.ui-entity-picker__results>button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:7px 8px;border:0;border-radius:4px;color:var(--ui-text);background:transparent;text-align:left}.ui-entity-picker__results>button:hover,.ui-entity-picker__results>button.is-active{background:var(--ui-surface-muted)}.ui-entity-picker__results strong,.ui-entity-picker__results small{display:block;font-size:12px}.ui-entity-picker__results small{margin-top:2px;color:var(--ui-text-soft);font-weight:400}.ui-entity-picker__results>p{display:flex;align-items:center;justify-content:center;gap:6px;margin:18px;color:var(--ui-text-soft);font-size:12px}</style>
