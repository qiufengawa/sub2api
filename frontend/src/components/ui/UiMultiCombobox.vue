<template>
  <UiFormField :for-id="resolvedId" :label="label" :description="description" :error="error">
    <div ref="root" class="ui-multi">
      <button ref="trigger" :id="resolvedId" type="button" class="ui-multi__trigger ui-focus-ring" :disabled="disabled" :aria-label="ariaLabel || label || placeholder" :aria-expanded="open" aria-haspopup="listbox" :aria-controls="listboxId" :aria-describedby="description || error ? `${resolvedId}-message` : undefined" :aria-invalid="error ? 'true' : undefined" @click="toggleOpen" @keydown.down.prevent="openAndFocusOptions" @keydown.esc.prevent="close(true)">
        <span v-if="selected.length" class="ui-multi__summary">
          <UiBadge v-for="item in selected.slice(0, 2)" :key="String(item.value)" :label="item.label" />
          <UiBadge v-if="selected.length > 2" :label="`+${selected.length - 2}`" />
        </span>
        <span v-else class="ui-multi__placeholder">{{ placeholder }}</span>
        <Icon name="chevronDown" size="sm" />
      </button>
      <div v-if="open" class="ui-multi__panel ui-scale-enter">
        <UiSearchInput v-model="query" density="dense" :placeholder="searchPlaceholder" @keydown.down.prevent="focusOption(0)" @keydown.esc.prevent="close(true)" />
        <div :id="listboxId" ref="listbox" class="ui-multi__options" role="listbox" aria-multiselectable="true" :aria-label="ariaLabel || label || placeholder">
          <button v-for="(option, index) in filtered" :key="String(option.value)" type="button" role="option" :aria-selected="isSelected(option.value)" :disabled="option.disabled" :tabindex="index === activeIndex ? 0 : -1" @focus="activeIndex = index" @keydown="onOptionKeydown($event, index)" @click="toggle(option.value)">
            <span class="ui-multi__check" aria-hidden="true"><Icon v-if="isSelected(option.value)" name="check" size="xs" /></span>
            <span>{{ option.label }}</span>
          </button>
          <p v-if="!filtered.length">{{ emptyText }}</p>
        </div>
        <footer><span>已选择 {{ modelValue.length }} 项</span><UiButton density="dense" variant="primary" @click="close(true)">完成</UiButton></footer>
      </div>
    </div>
  </UiFormField>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiBadge from './UiBadge.vue'
import UiButton from './UiButton.vue'
import UiFormField from './UiFormField.vue'
import UiSearchInput from './UiSearchInput.vue'
import type { UiChoiceOption } from './types'
const props = withDefaults(defineProps<{ modelValue:(string|number)[]; options:UiChoiceOption[]; id?:string; label?:string; ariaLabel?:string; description?:string; error?:string; placeholder?:string; searchPlaceholder?:string; emptyText?:string; disabled?:boolean }>(), { placeholder:'请选择', searchPlaceholder:'搜索选项', emptyText:'没有匹配项' })
const emit = defineEmits<{ 'update:modelValue':[(string|number)[]]; change:[(string|number)[]] }>()
const resolvedId = props.id || `ui-multi-${useId()}`
const listboxId = `${resolvedId}-listbox`
const root = ref<HTMLElement>(); const trigger = ref<HTMLButtonElement>(); const listbox = ref<HTMLElement>(); const open = ref(false); const query = ref(''); const activeIndex = ref(-1)
const selected = computed(() => props.options.filter(item => props.modelValue.includes(item.value)))
const filtered = computed(() => props.options.filter(item => item.label.toLowerCase().includes(query.value.trim().toLowerCase())))
const isSelected = (value:string|number) => props.modelValue.includes(value)
function toggle(value:string|number){ const next=isSelected(value)?props.modelValue.filter(item=>item!==value):[...props.modelValue,value]; emit('update:modelValue',next); emit('change',next) }
function outside(event:MouseEvent){ if(!root.value?.contains(event.target as Node)) open.value=false }
function focusSearch(){ nextTick(()=>root.value?.querySelector<HTMLInputElement>('.ui-search input')?.focus()) }
function toggleOpen(){ open.value=!open.value; if(open.value){activeIndex.value=availableIndex(0,1);focusSearch()} }
function close(restoreFocus=false){ open.value=false; if(restoreFocus)nextTick(()=>trigger.value?.focus()) }
function availableIndex(start:number,step:number){ if(!filtered.value.length)return-1; for(let offset=0;offset<filtered.value.length;offset++){const index=(start+offset*step+filtered.value.length)%filtered.value.length;if(!filtered.value[index]?.disabled)return index}return-1 }
function focusOption(index:number){ const next=availableIndex(index,1); if(next<0)return; activeIndex.value=next; nextTick(()=>listbox.value?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus()) }
function onOptionKeydown(event:KeyboardEvent,index:number){ if(event.key==='Escape'){event.preventDefault();close(true);return} if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const start=event.key==='Home'?0:event.key==='End'?filtered.value.length-1:index+(event.key==='ArrowDown'?1:-1);const next=availableIndex(start,event.key==='ArrowUp'||event.key==='End'?-1:1);if(next>=0)focusOption(next) }
function openAndFocusOptions(){ if(!open.value)open.value=true;nextTick(()=>focusOption(activeIndex.value)) }
watch(filtered,()=>{activeIndex.value=availableIndex(0,1)})
onMounted(()=>document.addEventListener('mousedown',outside)); onBeforeUnmount(()=>document.removeEventListener('mousedown',outside))
</script>
<style scoped>
.ui-multi{position:relative}.ui-multi__trigger{display:flex;width:100%;min-height:var(--ui-control-default);align-items:center;justify-content:space-between;gap:8px;padding:3px 9px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);font-size:13px}.ui-multi__summary{display:flex;min-width:0;flex-wrap:wrap;gap:4px}.ui-multi__placeholder{color:var(--ui-text-soft)}.ui-multi__panel{position:absolute;z-index:40;top:calc(100% + 5px);width:min(100%,360px);min-width:260px;padding:8px;border:1px solid var(--ui-border);border-radius:var(--ui-radius-panel);background:var(--ui-surface);box-shadow:0 10px 28px rgb(31 35 41/.12)}.ui-multi__options{max-height:220px;margin-top:6px;overflow:auto}.ui-multi__options>button{display:flex;width:100%;min-height:32px;align-items:center;gap:8px;padding:4px 7px;border:0;border-radius:4px;color:var(--ui-text);background:transparent;text-align:left}.ui-multi__options>button:hover{background:var(--ui-surface-muted)}.ui-multi__check{display:grid;width:16px;height:16px;flex:none;place-items:center;border:1px solid var(--ui-border);border-radius:4px;color:var(--ui-inverse);background:var(--ui-surface)}.ui-multi__options>button[aria-selected="true"] .ui-multi__check{border-color:var(--ui-text);background:var(--ui-text)}.ui-multi__options>p{margin:20px 8px;color:var(--ui-text-soft);font-size:12px;text-align:center}.ui-multi footer{display:flex;align-items:center;justify-content:space-between;padding-top:7px;border-top:1px solid var(--ui-border-soft);color:var(--ui-text-soft);font-size:11px}
</style>
