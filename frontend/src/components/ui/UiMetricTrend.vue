<template><span class="ui-trend ui-numeric" :class="`is-${tone}`"><Icon :name="direction==='up'?'arrowUp':direction==='down'?'arrowDown':'minus'" size="xs"/>{{ formatted }}<small v-if="period">{{ period }}</small></span></template>
<script setup lang="ts">
import{computed}from'vue';
import Icon from '@/components/icons/Icon.vue';
const props=withDefaults(defineProps<{value:number;
period?:string;
positiveIsGood?:boolean}>(),{positiveIsGood:true});
const direction=computed(()=>props.value>0?'up':props.value<0?'down':'flat');
const tone=computed(()=>props.value===0?'neutral':(props.value>0)===props.positiveIsGood?'success':'danger');
const formatted=computed(()=>`${props.value>0?'+':''}${props.value}%`)
</script>
<style scoped>.ui-trend{display:inline-flex;
align-items:center;
gap:3px;
color:var(--ui-text-muted);
font-size:10px}.ui-trend.is-success{color:var(--ui-success)}.ui-trend.is-danger{color:var(--ui-danger)}.ui-trend small{margin-left:2px;
color:var(--ui-text-soft)}</style>
