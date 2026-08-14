import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

let scrollLockCount = 0
let originalBodyOverflow = ''
const overlayStack: HTMLElement[] = []
const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

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

export function useOverlayLifecycle(
  show: Ref<boolean>,
  emitClose: () => void
) {
  const panelRef = ref<HTMLElement | null>(null)
  let previousFocus: HTMLElement | null = null
  let locked = false

  function onKeydown(event: KeyboardEvent): void {
    const panel = panelRef.value
    if (!show.value) return
    if (panel && overlayStack.length && overlayStack.at(-1) !== panel) return
    if (event.key === 'Escape') {
      event.preventDefault()
      emitClose()
      return
    }
    if (event.key !== 'Tab' || !panel) return
    const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter(element => element.offsetParent !== null && element.getAttribute('aria-hidden') !== 'true')
    if (!focusable.length) {
      event.preventDefault()
      panel.focus()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(show, async (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null
      lockBody()
      locked = true
      await nextTick()
      const panel = panelRef.value
      if (panel) {
        overlayStack.push(panel)
        const initial = panel.querySelector<HTMLElement>('[autofocus],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')
        ;(initial || panel).focus()
      }
      return
    }

    if (locked) {
      unlockBody()
      locked = false
    }
    const panel = panelRef.value
    if (panel) {
      const index = overlayStack.lastIndexOf(panel)
      if (index >= 0) overlayStack.splice(index, 1)
    }
    if (previousFocus?.isConnected) previousFocus.focus()
    previousFocus = null
  }, { immediate: true })

  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
    const panel = panelRef.value
    if (panel) {
      const index = overlayStack.lastIndexOf(panel)
      if (index >= 0) overlayStack.splice(index, 1)
    }
    if (locked) unlockBody()
  })

  return { panelRef }
}
