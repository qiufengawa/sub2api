<template>
  <div v-if="items.length" class="ui-filter-chips" :aria-label="ariaLabel || appliedLabel">
    <span>{{ appliedLabel }}</span>
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="ui-focus-ring"
      :aria-label="`${removeLabel}: ${item.label}${item.value ? ` ${item.value}` : ''}`"
      @click="emit('remove', item.key)"
    >
      {{ item.label }}<strong v-if="item.value">{{ item.value }}</strong><Icon name="x" size="xs" />
    </button>
    <UiButton v-if="items.length > 1" density="mini" variant="quiet" @click="emit('clear')">
      {{ clearLabel }}
    </UiButton>
  </div>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'
import UiButton from './UiButton.vue'

withDefaults(defineProps<{
  items: { key: string; label: string; value?: string }[]
  appliedLabel?: string
  clearLabel?: string
  removeLabel?: string
  ariaLabel?: string
}>(), {
  appliedLabel: '已应用',
  clearLabel: '全部清除',
  removeLabel: '移除筛选',
  ariaLabel: '',
})
const emit = defineEmits<{ remove: [string]; clear: [] }>()
</script>

<style scoped>
.ui-filter-chips{display:flex;min-width:0;align-items:center;flex-wrap:wrap;gap:5px;color:var(--ui-text-soft);font-size:11px}.ui-filter-chips>button:not(.ui-button){display:inline-flex;height:24px;align-items:center;gap:4px;padding:0 6px;border:1px solid var(--ui-border-soft);border-radius:4px;color:var(--ui-text-muted);background:var(--ui-surface-muted);font-size:11px}.ui-filter-chips>button:not(.ui-button):hover{border-color:var(--ui-border);background:var(--ui-surface-strong)}.ui-filter-chips strong{font-weight:600;color:var(--ui-text)}
</style>
