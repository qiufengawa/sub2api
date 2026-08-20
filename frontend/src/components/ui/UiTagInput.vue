<template>
  <UiFormField :for-id="fieldId" :label="label" :error="error">
    <div class="ui-tag-input" :class="{ 'is-focused': focused }">
      <span v-for="tag in modelValue" :key="tag">{{ tag }}<button type="button" :aria-label="`删除 ${tag}`" @click="remove(tag)"><Icon name="x" size="xs" /></button></span>
      <input :id="fieldId" v-model="draft" :placeholder="modelValue.length ? '' : placeholder" :aria-label="ariaLabel || label || placeholder" :aria-describedby="error ? `${fieldId}-message` : undefined" :aria-invalid="error ? 'true' : undefined" @focus="focused = true" @blur="onBlur" @keydown.enter.prevent="add" @keydown.,.prevent="add" @keydown.tab="handleTab" @keydown.backspace="removeLast" @paste="handlePaste" />
    </div>
  </UiFormField>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiFormField from './UiFormField.vue'

const props = defineProps<{ modelValue: string[]; id?: string; label?: string; ariaLabel?: string; placeholder?: string; error?: string }>()
const fieldId = props.id || `ui-tag-${useId()}`
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()
const draft = ref('')
const focused = ref(false)
function add() { const value = draft.value.trim().replace(/,$/, ''); if (value && !props.modelValue.includes(value)) emit('update:modelValue', [...props.modelValue, value]); draft.value = '' }
function onBlur() { add(); focused.value = false }
function handleTab(event: KeyboardEvent) { if (draft.value.trim()) { event.preventDefault(); add() } }
function handlePaste(event: ClipboardEvent) { event.preventDefault(); const values = (event.clipboardData?.getData('text') || '').split(/[,\n;]+/).map(value => value.trim()).filter(Boolean); if (values.length) emit('update:modelValue', [...new Set([...props.modelValue, ...values])]); draft.value = '' }
function remove(value: string) { emit('update:modelValue', props.modelValue.filter(tag => tag !== value)) }
function removeLast() { if (!draft.value && props.modelValue.length) emit('update:modelValue', props.modelValue.slice(0, -1)) }
</script>

<style scoped>.ui-tag-input{display:flex;min-height:32px;align-items:center;gap:4px;padding:3px 6px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);background:var(--ui-surface);flex-wrap:wrap;transition:border-color var(--ui-motion-fast),box-shadow var(--ui-motion-fast)}.ui-tag-input.is-focused{border-color:var(--ui-focus);box-shadow:0 0 0 2px color-mix(in srgb,var(--ui-focus) 16%,transparent)}.ui-tag-input>span{display:inline-flex;height:24px;align-items:center;gap:3px;padding:0 5px;border-radius:4px;background:var(--ui-surface-muted);font-size:12px}.ui-tag-input button{display:grid;padding:0;border:0;color:var(--ui-text-soft);background:transparent}.ui-tag-input input{min-width:80px;height:24px;flex:1;border:0;outline:0;background:transparent;font-size:13px}</style>
