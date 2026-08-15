import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

interface OverlayEntry {
  id: symbol
  zIndex: number
}

interface OverlayLifecycleOptions {
  closeOnEscape?: () => boolean
  zIndex?: number
}

let scrollLockCount = 0
let originalBodyOverflow = ''
const overlayStack: OverlayEntry[] = []
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

function lockBody(): void {
  if (scrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLockCount += 1
}

function unlockBody(): void {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) document.body.style.overflow = originalBodyOverflow
}

function registerOverlay(id: symbol, requestedZIndex: number): number {
  const existing = overlayStack.find(entry => entry.id === id)
  if (existing) return existing.zIndex
  const top = overlayStack.at(-1)
  const zIndex = top ? Math.max(requestedZIndex, top.zIndex + 2) : requestedZIndex
  overlayStack.push({ id, zIndex })
  return zIndex
}

function unregisterOverlay(id: symbol): boolean {
  const index = overlayStack.findIndex(entry => entry.id === id)
  const wasTop = index === overlayStack.length - 1
  if (index >= 0) overlayStack.splice(index, 1)
  return wasTop
}

function isTopOverlay(id: symbol): boolean {
  return overlayStack.at(-1)?.id === id
}

export function useOverlayLifecycle(
  show: Ref<boolean>,
  emitClose: () => void,
  options: OverlayLifecycleOptions = {}
) {
  const panelRef = ref<HTMLElement | null>(null)
  const zIndex = ref(options.zIndex ?? 100_000_000)
  const id = Symbol('ui-overlay')
  let previousFocus: HTMLElement | null = null
  let registered = false
  let locked = false

  function getFocusableElements(): HTMLElement[] {
    return [...(panelRef.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])]
      .filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
  }

  function unregister(): void {
    if (!registered) return
    const wasTop = unregisterOverlay(id)
    registered = false
    if (wasTop && previousFocus?.isConnected) previousFocus.focus()
    previousFocus = null
  }

  function onKeydown(event: KeyboardEvent): void {
    const panel = panelRef.value
    if (!show.value || !isTopOverlay(id)) return
    if (event.key === 'Escape') {
      if (options.closeOnEscape?.() === false) return
      event.preventDefault()
      emitClose()
      return
    }
    if (event.key !== 'Tab' || !panel) return

    const focusable = getFocusableElements()
    if (!focusable.length) {
      event.preventDefault()
      panel.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(show, async open => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null
      if (!registered) {
        zIndex.value = registerOverlay(id, options.zIndex ?? 100_000_000)
        registered = true
      }
      if (!locked) {
        lockBody()
        locked = true
      }
      await nextTick()
      const panel = panelRef.value
      const initial = panel?.querySelector<HTMLElement>('[autofocus]') ?? getFocusableElements()[0] ?? panel
      initial?.focus()
      return
    }

    unregister()
    if (locked) {
      unlockBody()
      locked = false
    }
  }, { immediate: true })

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
    unregister()
    if (locked) unlockBody()
  })

  return { panelRef, zIndex }
}
