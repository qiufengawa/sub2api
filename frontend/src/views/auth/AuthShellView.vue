<template>
  <AuthLayout :content-width="contentWidth">
    <div class="auth-route-stage">
      <RouterView v-slot="{ Component, route }">
        <Transition name="auth-switch">
          <div :key="String(route.name)" class="auth-route-view">
            <component :is="Component" />
          </div>
        </Transition>
      </RouterView>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { AuthLayout } from '@/components/layout'

const route = useRoute()
const contentWidth = computed(() => route.name === 'OAuthCallback' ? '560px' : '460px')
</script>

<style scoped>
.auth-route-stage {
  display: grid;
  width: 100%;
  min-height: 370px;
}

.auth-route-view {
  grid-area: 1 / 1;
  width: 100%;
}

.auth-switch-enter-active,
.auth-switch-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.auth-switch-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.auth-switch-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (max-width: 640px) {
  .auth-route-stage {
    min-height: 380px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-switch-enter-active,
  .auth-switch-leave-active {
    transition: none;
  }
}
</style>
