<template><UiPopover :placement="placement"><template #trigger><slot name="trigger"/></template><template #default="{close}"><div class="ui-menu" role="menu"><button v-for="item in items" :key="item.key" type="button" role="menuitem" :disabled="item.disabled" :class="{'is-danger':item.danger}" @click="select(item,close)"><Icon v-if="item.icon" :name="item.icon" size="sm"/><span>{{ item.label }}</span></button><slot/></div></template></UiPopover></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
import UiPopover from './UiPopover.vue';
type IconName=InstanceType<typeof Icon>['$props']['name'];
export interface UiMenuItem{key:string;
label:string;
icon?:IconName;
disabled?:boolean;
danger?:boolean}withDefaults(defineProps<{items:UiMenuItem[];
placement?:'bottom-start'|'bottom-end'}>(),{placement:'bottom-end'});
const emit=defineEmits<{select:[UiMenuItem]}>();
function select(i:UiMenuItem,close:()=>void){if(i.disabled)return;
emit('select',i);
close()}
</script>
<style scoped>.ui-menu{display:grid;
gap:2px}.ui-menu button{display:flex;
width:100%;
height:32px;
align-items:center;
gap:8px;
padding:0 9px;
border:0;
border-radius:4px;
color:var(--ui-text);
background:transparent;
font-size:13px;
text-align:left}.ui-menu button:hover:not(:disabled){background:var(--ui-surface-muted)}.ui-menu button.is-danger{color:var(--ui-danger)}.ui-menu button:disabled{opacity:.4}</style>
