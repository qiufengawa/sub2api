<template>
  <div class="ui-tabs" role="tablist" :aria-label="label">
    <button v-for="tab in tabs" :key="String(tab.value)" type="button" role="tab" :aria-selected="modelValue===tab.value" :tabindex="modelValue===tab.value?0:-1" :disabled="tab.disabled" :class="{ 'is-active': modelValue===tab.value }" @click="emit('update:modelValue',tab.value)" @keydown="navigate($event,tab.value)">
      <Icon v-if="tab.icon" :name="tab.icon" size="sm" /><span>{{ tab.label }}</span><small v-if="tab.count!==undefined" class="ui-numeric">{{ tab.count }}</small>
    </button>
  </div>
</template>
<script setup lang="ts">

import Icon from '@/components/icons/Icon.vue'
type IconName = InstanceType<typeof Icon>['$props']['name']
export interface UiTabOption { label:string;
value:string|number;
icon?:IconName;
count?:number;
disabled?:boolean }
const props=defineProps<{modelValue:string|number;
tabs:UiTabOption[];
label:string}>()
const emit=defineEmits<{ 'update:modelValue':[string|number] }>()
function navigate(event:KeyboardEvent,value:string|number){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
  const enabled=props.tabs.filter(tab=>!tab.disabled),current=enabled.findIndex(tab=>tab.value===value)
  const next=event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1):enabled[(current+(event.key==='ArrowRight'?1:-1)+enabled.length)%enabled.length]
  if(!next)return
  event.preventDefault();emit('update:modelValue',next.value)
  const index=props.tabs.findIndex(tab=>tab.value===next.value)
  ;(event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus()
}

</script>
<style scoped>.ui-tabs{display:flex;
min-width:0;
gap:20px;
border-bottom:1px solid var(--ui-border-soft);
overflow-x:auto}.ui-tabs button{position:relative;
display:inline-flex;
height:32px;
flex:none;
align-items:center;
gap:6px;
padding:0 1px;
border:0;
color:var(--ui-text-muted);
background:transparent;
font-size:13px;
white-space:nowrap}.ui-tabs button:after{position:absolute;
right:0;
bottom:-1px;
left:0;
height:2px;
background:transparent;
content:""}.ui-tabs button.is-active{color:var(--ui-text);
font-weight:500}.ui-tabs button.is-active:after{background:var(--ui-text)}.ui-tabs small{padding:1px 5px;
border-radius:999px;
background:var(--ui-surface-muted);
font-size:10px}.ui-tabs button:disabled{opacity:.45}</style>
