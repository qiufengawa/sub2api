import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** Reactive prefers-reduced-motion state for canvas/SVG components. */
export function useReducedMotion(): Ref<boolean> {
  const reduced = ref(false)
  let media: MediaQueryList | null = null
  const sync = () => { reduced.value = media?.matches ?? false }

  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    sync()
    if (media.addEventListener) media.addEventListener('change', sync)
    else media.addListener?.(sync)
  })

  onBeforeUnmount(() => {
    if (media?.removeEventListener) media.removeEventListener('change', sync)
    else media?.removeListener?.(sync)
    media = null
  })

  return reduced
}
