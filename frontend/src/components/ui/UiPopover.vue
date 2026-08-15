<template>
  <span ref="root" class="ui-popover">
    <span @click="toggle"><slot name="trigger" :open="open" /></span>
    <Teleport to="body">
      <Transition name="ui-popover">
        <div
          v-if="open"
          ref="panel"
          class="ui-popover__panel ui-motion"
          :style="style"
          :role="panelRole"
          :aria-label="ariaLabel"
        >
          <slot :close="close" />
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  placement?: 'bottom-start' | 'bottom-end'
  closeOnSelect?: boolean
  panelRole?: 'dialog' | 'menu' | 'listbox' | 'tree'
  ariaLabel?: string
  width?: string
  focusOnOpen?: boolean
}>(), {
  placement: 'bottom-start',
  closeOnSelect: false,
  focusOnOpen: true
})

const emit = defineEmits<{ openChange: [boolean] }>()
const open = ref(false)
const root = ref<HTMLElement>()
const panel = ref<HTMLElement>()
const style = ref<Record<string, string>>()

const focusableSelector = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

function focusTrigger(): void {
  root.value?.querySelector<HTMLElement>(focusableSelector)?.focus()
}

function focusPanel(): void {
  panel.value?.querySelector<HTMLElement>(focusableSelector)?.focus()
}

async function dismiss(restoreFocus: boolean): Promise<void> {
  if (!open.value) return
  open.value = false
  emit('openChange', false)
  if (restoreFocus) {
    await nextTick()
    focusTrigger()
  }
}

function close(): void {
  void dismiss(true)
}

async function toggle(): Promise<void> {
  if (open.value) {
    await dismiss(false)
    return
  }

  open.value = true
  emit('openChange', true)
  style.value = props.width
    ? { width: props.width, maxWidth: 'calc(100vw - 16px)' }
    : { maxWidth: 'min(320px, calc(100vw - 16px))' }
  await nextTick()
  position()
  if (props.focusOnOpen) focusPanel()
}

function position(): void {
  const triggerRect = root.value?.getBoundingClientRect()
  const popover = panel.value
  if (!triggerRect || !popover) return

  const width = popover.offsetWidth
  const height = popover.offsetHeight
  const left = props.placement === 'bottom-end' ? triggerRect.right - width : triggerRect.left
  const below = triggerRect.bottom + 6
  const above = triggerRect.top - height - 6
  const top = below + height <= innerHeight - 8 ? below : Math.max(8, above)

  style.value = {
    top: `${top}px`,
    left: `${Math.max(8, Math.min(innerWidth - width - 8, left))}px`,
    maxHeight: `${Math.max(120, innerHeight - 16)}px`,
    maxWidth: props.width ? 'calc(100vw - 16px)' : 'min(320px, calc(100vw - 16px))',
    overflowY: 'auto',
    ...(props.width ? { width: props.width } : {})
  }
}

function outside(event: MouseEvent): void {
  const target = event.target as Node
  if (open.value && !root.value?.contains(target) && !panel.value?.contains(target)) {
    void dismiss(false)
  }
}

function key(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  void dismiss(true)
}

onMounted(() => {
  document.addEventListener('click', outside, true)
  document.addEventListener('keydown', key)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', outside, true)
  document.removeEventListener('keydown', key)
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
})
</script>

<style scoped>
.ui-popover{display:inline-flex}
.ui-popover__panel{position:fixed;z-index:100000010;min-width:180px;padding:6px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);box-shadow:0 8px 24px rgb(31 35 41/.08)}
.ui-popover-enter-active,.ui-popover-leave-active{transition:opacity var(--ui-motion-fast),transform var(--ui-motion-fast)}
.ui-popover-enter-from,.ui-popover-leave-to{opacity:0;transform:translateY(-2px)}
@media(prefers-reduced-motion:reduce){.ui-popover-enter-active,.ui-popover-leave-active{transition:none}}
</style>
