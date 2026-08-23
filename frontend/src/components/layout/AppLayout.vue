<template>
  <div class="app-shell" :class="{ 'app-shell--collapsed': sidebarCollapsed }">
    <AppSidebar />

    <div
      class="app-shell__workspace"
      :inert="mobileOverlayActive ? true : undefined"
    >
      <AppHeader />

      <main class="app-main-content app-shell__main">
        <div class="app-page-content app-shell__page">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const appStore = useAppStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const mobileOpen = computed(() => appStore.mobileOpen)
const isMobileViewport = ref(
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 1023px)').matches
    : false,
)
const mobileOverlayActive = computed(() => mobileOpen.value && isMobileViewport.value)
let mobileViewportMediaQuery: MediaQueryList | null = null

function syncMobileViewport(event?: MediaQueryListEvent): void {
  isMobileViewport.value = event?.matches ?? mobileViewportMediaQuery?.matches ?? false
}
onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    mobileViewportMediaQuery = window.matchMedia('(max-width: 1023px)')
    if (mobileViewportMediaQuery.addEventListener) {
      mobileViewportMediaQuery.addEventListener('change', syncMobileViewport)
    } else {
      mobileViewportMediaQuery.addListener?.(syncMobileViewport)
    }
    // Keep the initial value in sync in browsers that report the media query late.
    syncMobileViewport()
  }
})

onBeforeUnmount(() => {
  if (mobileViewportMediaQuery?.removeEventListener) {
    mobileViewportMediaQuery.removeEventListener('change', syncMobileViewport)
  } else {
    mobileViewportMediaQuery?.removeListener?.(syncMobileViewport)
  }
  mobileViewportMediaQuery = null
})

</script>

<style scoped>
.app-shell {
  --app-sidebar-width: 240px;
  --app-sidebar-collapsed-width: 64px;
  --app-header-height: 54px;
  --app-content-inline-padding: 24px;
  --app-content-block-padding: 20px;
  min-height: 100dvh;
  color: var(--ui-text);
  background: var(--ui-bg);
}

.app-shell__workspace {
  display: flex;
  min-width: 0;
  min-height: 100dvh;
  flex-direction: column;
  margin-left: var(--app-sidebar-width);
  transition: margin-left var(--ui-motion-base) var(--ui-ease-standard);
}

.app-shell--collapsed .app-shell__workspace {
  margin-left: var(--app-sidebar-collapsed-width);
}

.app-shell__main,
.app-shell__page {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.app-shell__main {
  padding: var(--app-content-block-padding) var(--app-content-inline-padding) 32px;
}

@media (max-width: 1023px) {
  .app-shell {
    --app-content-inline-padding: 20px;
    --app-content-block-padding: 18px;
  }

  .app-shell__workspace,
  .app-shell--collapsed .app-shell__workspace {
    margin-left: 0;
  }
}

@media (max-width: 639px) {
  .app-shell {
    --app-content-inline-padding: 16px;
    --app-content-block-padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-shell__workspace {
    transition: none;
  }
}
</style>
