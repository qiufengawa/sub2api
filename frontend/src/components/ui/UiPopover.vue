<template>
  <span ref="root" class="ui-popover">
    <span
      :id="triggerId"
      ref="trigger"
      :aria-expanded="open"
      :aria-haspopup="panelRole"
      :aria-controls="panelId"
      :role="triggerNeedsKeyboard ? 'button' : undefined"
      :tabindex="triggerNeedsKeyboard ? 0 : -1"
      @click="toggle"
      @keydown="onTriggerKeydown"
    ><slot name="trigger" :open="open" /></span>
    <Teleport to="body">
      <Transition name="ui-popover">
        <div
          v-if="open"
          ref="panel"
          :id="panelId"
          class="ui-popover__panel ui-motion"
          :style="style"
          :role="panelRole"
          :aria-label="ariaLabel"
          :aria-labelledby="ariaLabel ? undefined : triggerId"
          :aria-modal="panelRole === 'dialog' ? 'true' : undefined"
          @keydown="onPanelKeydown"
        >
          <slot :close="close" />
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, onUpdated, ref, useId } from 'vue'

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
  panelRole: 'menu',
  focusOnOpen: true
})

const emit = defineEmits<{ openChange: [boolean] }>()
const open = ref(false)
const root = ref<HTMLElement>()
const trigger = ref<HTMLElement>()
const panel = ref<HTMLElement>()
const style = ref<Record<string, string>>()
const popoverId = useId()
const triggerId = `${popoverId}-trigger`
const panelId = `${popoverId}-panel`
const bodyOverflowBeforeOpen = ref<string | null>(null)
const triggerNeedsKeyboard = ref(true)
let tabDismissTimer: ReturnType<typeof setTimeout> | undefined

const focusableSelector = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

function focusTrigger(): void {
  if (triggerNeedsKeyboard.value) trigger.value?.focus()
  else root.value?.querySelector<HTMLElement>(focusableSelector)?.focus()
}

function syncTriggerA11y(): void {
  const focusable = trigger.value?.querySelector<HTMLElement>(focusableSelector)
  triggerNeedsKeyboard.value = !focusable
  if (focusable) {
    focusable.setAttribute('aria-expanded', String(open.value))
    focusable.setAttribute('aria-haspopup', panelRoleValue())
    focusable.setAttribute('aria-controls', panelId)
  }
}

function panelRoleValue(): string {
  return props.panelRole
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (!triggerNeedsKeyboard.value) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  void toggle()
}

function focusPanel(): void {
  panel.value?.querySelector<HTMLElement>(focusableSelector)?.focus()
}

function onPanelKeydown(event: KeyboardEvent): void {
  if (!['menu', 'listbox'].includes(props.panelRole)) return
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const role = props.panelRole === 'menu' ? 'menuitem' : 'option'
  const items = Array.from(panel.value?.querySelectorAll<HTMLElement>(`[role="${role}"]:not([aria-disabled="true"]):not(:disabled)`) ?? [])
  if (items.length === 0) return
  event.preventDefault()
  const current = items.indexOf(document.activeElement as HTMLElement)
  if (event.key === 'Home') items[0].focus()
  else if (event.key === 'End') items[items.length - 1].focus()
  else if (event.key === 'ArrowDown') items[current < 0 || current === items.length - 1 ? 0 : current + 1].focus()
  else items[current <= 0 ? items.length - 1 : current - 1].focus()
}

async function dismiss(restoreFocus: boolean): Promise<void> {
  if (!open.value) return
  open.value = false
  syncTriggerA11y()
  emit('openChange', false)
  if (props.panelRole === 'dialog' && bodyOverflowBeforeOpen.value !== null) {
    document.body.style.overflow = bodyOverflowBeforeOpen.value
    bodyOverflowBeforeOpen.value = null
  }
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
  syncTriggerA11y()
  emit('openChange', true)
  if (props.panelRole === 'dialog' && bodyOverflowBeforeOpen.value === null) {
    bodyOverflowBeforeOpen.value = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
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
    void dismiss(true)
  }
}

function key(event: KeyboardEvent): void {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    void dismiss(true)
    return
  }
  if (event.key !== 'Tab' || !panel.value) return
  if (props.panelRole !== 'dialog') {
    clearTimeout(tabDismissTimer)
    tabDismissTimer = setTimeout(() => { void dismiss(false) }, 0)
    return
  }
  const focusables = Array.from(panel.value.querySelectorAll<HTMLElement>(focusableSelector))
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  syncTriggerA11y()
  document.addEventListener('click', outside, true)
  document.addEventListener('keydown', key)
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
})

onUpdated(syncTriggerA11y)

onBeforeUnmount(() => {
  clearTimeout(tabDismissTimer)
  document.removeEventListener('click', outside, true)
  document.removeEventListener('keydown', key)
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
  if (bodyOverflowBeforeOpen.value !== null) {
    document.body.style.overflow = bodyOverflowBeforeOpen.value
    bodyOverflowBeforeOpen.value = null
  }
})
</script>

<style scoped>
.ui-popover{display:inline-flex}
.ui-popover__panel{position:fixed;z-index:100000010;min-width:180px;padding:6px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);box-shadow:0 8px 24px rgb(31 35 41/.08)}
.ui-popover-enter-active,.ui-popover-leave-active{transition:opacity var(--ui-motion-fast),transform var(--ui-motion-fast)}
.ui-popover-enter-from,.ui-popover-leave-to{opacity:0;transform:translateY(-2px)}
@media(prefers-reduced-motion:reduce){.ui-popover-enter-active,.ui-popover-leave-active{transition:none}}
</style>
