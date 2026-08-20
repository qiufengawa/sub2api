<template>
  <div ref="animationContainer" class="home-earth-canvas" aria-hidden="true"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { AnimationItem } from 'lottie-web'

const animationContainer = ref<HTMLElement | null>(null)
let animation: AnimationItem | null = null
let disposed = false

onMounted(async () => {
  try {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const [lottieModule, response] = await Promise.all([
      import('lottie-web'),
      fetch('/animations/home-earth/data.json'),
    ])

    if (!response.ok) throw new Error(`Unable to load home animation: ${response.status}`)
    const animationData = await response.json()
    if (disposed || !animationContainer.value) return

    animation = lottieModule.default.loadAnimation({
      container: animationContainer.value,
      renderer: 'svg',
      loop: !reducedMotion,
      autoplay: !reducedMotion,
      animationData,
      assetsPath: '/animations/home-earth/images/',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
      },
    })
    if (reducedMotion) animation.goToAndStop(0, true)
  } catch {
    // The hero remains usable when animation assets are unavailable.
  }
})

onBeforeUnmount(() => {
  disposed = true
  animation?.destroy()
  animation = null
})
</script>

<style scoped>
.home-earth-canvas,
.home-earth-canvas :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
