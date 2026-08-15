<template>
  <UiFormField :label="label" :description="description" :error="error">
    <div class="ui-entity-picker" @focusin="onFocusIn" @focusout="closeLater">
      <UiSearchInput :model-value="query" :placeholder="placeholder" :disabled="disabled" @update:model-value="search" />
      <div v-if="open && (query || showResultsWithoutQuery) && (loading || items.length || emptyText)" class="ui-entity-picker__results" role="listbox">
        <p v-if="loading" role="status"><UiSpinner size="sm" />{{ loadingText }}</p>
        <button v-for="item in items" v-else :key="String(item.value)" type="button" role="option" :aria-selected="item.value===modelValue" @click="select(item)">
          <span><strong>{{ item.label }}</strong><small v-if="item.description">{{ item.description }}</small></span>
          <Icon v-if="item.value===modelValue" class="ui-entity-picker__selected" name="check" size="sm" />
        </button>
        <p v-if="!loading && !items.length">{{ emptyText }}</p>
      </div>
    </div>
  </UiFormField>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiFormField from './UiFormField.vue'; import UiSearchInput from './UiSearchInput.vue'; import UiSpinner from './UiSpinner.vue'
export interface UiEntityOption { label:string; value:string|number; description?:string }
const props=withDefaults(defineProps<{modelValue?:string|number|null;items:UiEntityOption[];selectedLabel?:string;label?:string;description?:string;error?:string;placeholder?:string;emptyText?:string;loadingText?:string;loading?:boolean;disabled?:boolean;searchOnFocus?:boolean;showResultsWithoutQuery?:boolean;clearAfterSelect?:boolean}>(),{placeholder:'搜索用户、账号或密钥',emptyText:'没有匹配结果',loadingText:'正在搜索',searchOnFocus:false,showResultsWithoutQuery:false,clearAfterSelect:false})
const emit=defineEmits<{ 'update:modelValue':[string|number|null]; search:[string]; select:[UiEntityOption] }>()
const query=ref(props.selectedLabel||''); const open=ref(false); watch(()=>props.selectedLabel,value=>{if(value!==undefined)query.value=value})
function search(value:string){query.value=value;open.value=true;emit('search',value);if(!value)emit('update:modelValue',null)}
function select(item:UiEntityOption){query.value=props.clearAfterSelect?'':item.label;open.value=false;emit('update:modelValue',item.value);emit('select',item)}
function onFocusIn(){const wasOpen=open.value;open.value=true;if(props.searchOnFocus&&!wasOpen&&!query.value)emit('search','')}
function closeLater(){window.setTimeout(()=>{open.value=false},0)}
</script>
<style scoped>.ui-entity-picker{position:relative}.ui-entity-picker__selected{color:var(--ui-success)}.ui-entity-picker__results{position:absolute;z-index:40;top:calc(100% + 5px);width:100%;max-height:250px;padding:5px;overflow:auto;border:1px solid var(--ui-border);border-radius:var(--ui-radius-panel);background:var(--ui-surface);box-shadow:0 10px 28px rgb(31 35 41/.12)}.ui-entity-picker__results>button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;padding:7px 8px;border:0;border-radius:4px;color:var(--ui-text);background:transparent;text-align:left}.ui-entity-picker__results>button:hover{background:var(--ui-surface-muted)}.ui-entity-picker__results strong,.ui-entity-picker__results small{display:block;font-size:12px}.ui-entity-picker__results small{margin-top:2px;color:var(--ui-text-soft);font-weight:400}.ui-entity-picker__results>p{display:flex;align-items:center;justify-content:center;gap:6px;margin:18px;color:var(--ui-text-soft);font-size:12px}</style>
