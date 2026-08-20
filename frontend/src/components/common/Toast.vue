<template>
  <Teleport to="body">
    <div class="ui-toast-region" aria-label="通知" aria-live="polite">
      <TransitionGroup name="ui-toast-list">
        <UiToast
          v-for="toast in toasts"
          :key="toast.id"
          :show="true"
          :tone="toTone(toast.type)"
          :title="toast.title"
          :message="toast.message"
          :close-label="t('common.close')"
          @close="removeToast(toast.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { UiToast } from '@/components/ui'

const appStore = useAppStore()
const { t } = useI18n()
const toasts = computed(() => appStore.toasts)
const toTone = (type: string): 'info' | 'success' | 'warning' | 'danger' => type === 'error' ? 'danger' : type === 'success' || type === 'warning' ? type : 'info'
const removeToast = (id: string): void => appStore.hideToast(id)
</script>

<style scoped>
.ui-toast-region{position:fixed;z-index:9999;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));display:grid;gap:8px;pointer-events:none}.ui-toast-region :deep(.ui-toast){pointer-events:auto}.ui-toast-list-enter-active,.ui-toast-list-leave-active{transition:opacity var(--ui-motion-base),transform var(--ui-motion-base)}.ui-toast-list-enter-from,.ui-toast-list-leave-to{opacity:0;transform:translateX(8px)}@media(max-width:639px){.ui-toast-region{right:max(8px,env(safe-area-inset-right));left:max(8px,env(safe-area-inset-left))}.ui-toast-region :deep(.ui-toast){width:100%}}@media(prefers-reduced-motion:reduce){.ui-toast-list-enter-active,.ui-toast-list-leave-active{transition:none}}
</style>
