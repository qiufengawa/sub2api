import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/**
 * Reactive view of the application's document-level dark theme class.
 *
 * Theme changes are applied by the shell directly to <html>, so components
 * that render canvas/SVG configuration must observe that class instead of
 * reading it once during setup.
 */
export function useDarkMode(): Ref<boolean> {
  const dark = ref(false)
  let observer: MutationObserver | null = null

  const sync = () => {
    dark.value = document.documentElement.classList.contains('dark')
  }

  onMounted(() => {
    sync()
    observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return dark
}
