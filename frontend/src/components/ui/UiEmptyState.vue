<template><div class="ui-empty"><slot name="icon"><Icon :name="icon" size="lg"/></slot><h3>{{ title }}</h3><p v-if="description">{{ description }}</p><div v-if="$slots.action" class="ui-empty__action"><slot name="action"/></div></div></template>
<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue';
type IconName=InstanceType<typeof Icon>['$props']['name'];
withDefaults(defineProps<{title:string;
description?:string;
icon?:IconName}>(),{icon:'inbox'})
</script>
<style scoped>.ui-empty{display:flex;
min-height:112px;
flex-direction:column;
align-items:center;
justify-content:center;
padding:24px;
color:var(--ui-text-soft);
text-align:center}.ui-empty h3{margin:10px 0 0;
color:var(--ui-text);
font-size:14px}.ui-empty p{max-width:360px;
margin:5px 0 0;
font-size:12px;
line-height:19px}.ui-empty__action{margin-top:14px}</style>
