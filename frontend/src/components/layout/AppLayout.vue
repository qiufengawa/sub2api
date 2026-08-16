<template>
  <div class="app-shell" :class="{ 'app-shell--collapsed': sidebarCollapsed }">
    <AppSidebar />

    <div class="app-shell__workspace">
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
import '@/styles/onboarding.css'
import { computed, onMounted } from 'vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingTour } from '@/composables/useOnboardingTour'
import { useOnboardingStore } from '@/stores/onboarding'
import AppSidebar from './AppSidebar.vue'
import AppHeader from './AppHeader.vue'

const appStore = useAppStore()
const authStore = useAuthStore()
const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const isAdmin = computed(() => authStore.user?.role === 'admin')

const { replayTour } = useOnboardingTour({
  storageKey: isAdmin.value ? 'admin_guide' : 'user_guide',
  autoStart: true
})

const onboardingStore = useOnboardingStore()

onMounted(() => {
  onboardingStore.setReplayCallback(replayTour)
})

defineExpose({ replayTour })
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
