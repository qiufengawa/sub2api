<template>
  <ul
    ref="treeRef"
    class="ui-tree"
    :role="isRoot ? 'tree' : 'group'"
    :aria-label="isRoot ? resolvedAriaLabel() : undefined"
    @keydown="isRoot ? onKeydown($event) : undefined"
  >
    <li
      v-for="(item, index) in items"
      :key="item.key"
      :data-tree-key="item.key"
      role="treeitem"
      :tabindex="focusKey === item.key ? 0 : -1"
      :aria-level="depth"
      :aria-posinset="index + 1"
      :aria-setsize="items.length"
      :aria-selected="item.key === modelValue"
      :aria-expanded="item.children?.length ? 'true' : undefined"
      @focus="focusKey = item.key"
    >
      <button
        type="button"
        tabindex="-1"
        :class="{ 'is-selected': item.key === modelValue }"
        :aria-current="item.key === modelValue ? 'true' : undefined"
        @click="select(item.key)"
      >
        <Icon :name="item.children?.length ? 'chevronRight' : 'document'" size="xs" />
        <span>{{ item.label }}</span>
      </button>
      <UiTree
        v-if="item.children?.length"
        :items="item.children"
        :model-value="modelValue"
        :depth="depth + 1"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </li>
  </ul>
</template>

<script setup lang="ts">
import { inject, provide, ref, watch, type Ref } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import { useUiT } from './useUiI18n'

export interface UiTreeItem {
  key: string
  label: string
  children?: UiTreeItem[]
}

interface TreeContext {
  focusKey: Ref<string>
  rootRef: Ref<HTMLElement | null>
}

const TREE_CONTEXT_KEY = 'ui-tree-context'

defineOptions({ name: 'UiTree' })
const props = withDefaults(defineProps<{
  items: UiTreeItem[]
  modelValue?: string
  depth?: number
  ariaLabel?: string
}>(), { depth: 1 })
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const parentContext = inject<TreeContext | null>(TREE_CONTEXT_KEY, null)
const isRoot = !parentContext
const treeRef = ref<HTMLElement | null>(null)
const localFocusKey = ref(props.modelValue ?? props.items[0]?.key ?? '')
const focusKey = parentContext?.focusKey ?? localFocusKey
const rootRef = parentContext?.rootRef ?? treeRef
const t = useUiT()
const resolvedAriaLabel = () => props.ariaLabel || t('common.tree')

if (isRoot) provide(TREE_CONTEXT_KEY, { focusKey, rootRef })

watch(() => props.modelValue, (value) => {
  if (value) focusKey.value = value
})

function select(key: string): void {
  focusKey.value = key
  emit('update:modelValue', key)
}

function focusItem(item: HTMLElement | undefined): void {
  if (!item) return
  focusKey.value = item.dataset.treeKey ?? focusKey.value
  item.focus()
}

function onKeydown(event: KeyboardEvent): void {
  const current = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')
  if (!current || !rootRef.value) return
  const items = [...rootRef.value.querySelectorAll<HTMLElement>('[role="treeitem"]')]
  const index = items.indexOf(current)
  if (index < 0) return

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    focusItem(items[index + (event.key === 'ArrowDown' ? 1 : -1)])
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    focusItem(items[event.key === 'Home' ? 0 : items.length - 1])
  } else if (event.key === 'ArrowRight') {
    const child = current.querySelector<HTMLElement>('[role="group"] [role="treeitem"]')
    if (child) {
      event.preventDefault()
      focusItem(child)
    }
  } else if (event.key === 'ArrowLeft') {
    const parent = current.parentElement?.closest<HTMLElement>('[role="treeitem"]')
    if (parent) {
      event.preventDefault()
      focusItem(parent)
    }
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    select(current.dataset.treeKey ?? '')
  }
}
</script>

<style scoped>
.ui-tree{display:grid;gap:2px;margin:0;padding:0 0 0 14px;list-style:none}.ui-tree[role=tree]{padding-left:0}.ui-tree li[role=treeitem]{min-width:0;outline:none}.ui-tree li[role=treeitem]:focus-visible>button{outline:2px solid var(--ui-focus);outline-offset:1px}.ui-tree button{display:flex;width:100%;height:30px;align-items:center;gap:6px;padding:0 8px;border:0;border-radius:4px;color:var(--ui-text-muted);background:transparent;text-align:left}.ui-tree button:hover,.ui-tree button.is-selected{color:var(--ui-text);background:var(--ui-surface-muted)}
</style>
