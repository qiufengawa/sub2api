<template>
  <div class="ui-form-field" :class="{ 'ui-form-field--invalid': Boolean(error) }">
    <div v-if="label || $slots.label" class="ui-form-field__label-row">
      <label :for="forId"><slot name="label">{{ label }}</slot><span v-if="required" aria-hidden="true"> *</span></label>
      <slot name="help" />
    </div>
    <slot />
    <UiFieldError v-if="error" :id="messageId" :message="error" />
    <p v-else-if="description" :id="messageId" class="ui-form-field__description">{{ description }}</p>
  </div>
</template>
<script setup lang="ts">

import {computed} from 'vue';
import UiFieldError from './UiFieldError.vue';
const props=defineProps<{forId?:string;
label?:string;
description?:string;
error?:string;
required?:boolean}>()
const messageId=computed(()=>props.forId?`${props.forId}-message`:undefined)

</script>
<style scoped>.ui-form-field{display:grid;
gap:4px;
min-width:0}.ui-form-field__label-row{display:flex;
align-items:center;
gap:5px;
min-height:22px}.ui-form-field__label-row label{color:var(--ui-text-muted);
font-size:13px;
font-weight:400;
line-height:22px}.ui-form-field__label-row label span{color:var(--ui-danger)}.ui-form-field__description{margin:0;
color:var(--ui-text-soft);
font-size:12px;
line-height:18px}</style>
