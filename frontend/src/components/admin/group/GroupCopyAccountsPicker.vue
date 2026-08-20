<template>
  <section class="group-copy-picker">
    <div class="group-copy-picker__label">
      <span>{{ label }}</span>
      <UiFieldHelp :content="tooltip" />
    </div>

    <div v-if="selectedIds.length" class="group-copy-picker__selection">
      <UiBadge v-for="groupId in selectedIds" :key="groupId">
        <span>{{ labelFor(groupId) }}</span>
        <UiIconButton
          type="button"
          icon="x"
          variant="ghost"
          density="mini"
          :label="`${removeLabel}: ${labelFor(groupId)}`"
          @click="remove(groupId)"
        />
      </UiBadge>
    </div>

    <UiSelect
      :model-value="pendingSelection"
      :options="availableOptions"
      :placeholder="placeholder"
      density="compact"
      searchable="auto"
      @update:model-value="add"
    />
    <p class="group-copy-picker__hint">{{ hint }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { UiBadge, UiFieldHelp, UiIconButton, UiSelect, type SelectOption, type SelectValue } from '@/components/ui'

interface GroupOption extends SelectOption {
  value: number
  label: string
}

const props = defineProps<{
  selectedIds: number[]
  options: GroupOption[]
  label: string
  tooltip: string
  placeholder: string
  hint: string
  removeLabel: string
}>()
const emit = defineEmits<{ 'update:selectedIds': [number[]] }>()

const pendingSelection = ref<SelectValue>(null)
const availableOptions = computed(() => props.options.filter(option => !props.selectedIds.includes(option.value)))

const labelFor = (groupId: number) =>
  props.options.find(option => option.value === groupId)?.label || `#${groupId}`

const add = (value: SelectValue) => {
  const groupId = Number(value)
  if (Number.isInteger(groupId) && groupId > 0 && !props.selectedIds.includes(groupId)) {
    emit('update:selectedIds', [...props.selectedIds, groupId])
  }
  pendingSelection.value = null
}

const remove = (groupId: number) => {
  emit('update:selectedIds', props.selectedIds.filter(id => id !== groupId))
}
</script>

<style scoped>
.group-copy-picker{display:grid;gap:6px}
.group-copy-picker__label{display:flex;align-items:center;gap:4px;color:var(--ui-text);font-size:12px;font-weight:600;line-height:18px}
.group-copy-picker__selection{display:flex;flex-wrap:wrap;gap:5px}
.group-copy-picker__selection button{display:inline-grid;place-items:center;padding:0;border:0;color:var(--ui-text-soft);background:transparent;cursor:pointer}
.group-copy-picker__selection button:hover{color:var(--ui-danger)}
.group-copy-picker__hint{margin:0;color:var(--ui-text-muted);font-size:11px;line-height:17px}
</style>
