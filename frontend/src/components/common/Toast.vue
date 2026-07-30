<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed right-4 top-4 z-[9999] space-y-2"
      aria-live="polite"
      aria-atomic="true"
    >
      <TransitionGroup
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 translate-x-full"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-full"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="[
            'pointer-events-auto w-[calc(100vw-2rem)] min-w-0 max-w-[360px] overflow-hidden rounded-[4px]',
            'border shadow-md',
            getSurfaceClass(toast.type)
          ]"
        >
          <div class="px-3 py-2.5">
            <div class="flex items-start gap-2.5">
              <!-- Icon -->
              <div
                :class="[
                  'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full',
                  getIconBackground(toast.type)
                ]"
              >
                <Icon
                  :name="getToastIconName(toast.type)"
                  size="sm"
                  :class="getIconColor(toast.type)"
                  aria-hidden="true"
                />
              </div>

              <!-- Content -->
              <div class="min-w-0 flex-1">
                <p v-if="toast.title" class="text-sm font-medium text-[#181818] dark:text-white">
                  {{ toast.title }}
                </p>
                <p
                  :class="[
                    'text-sm leading-5',
                    toast.title
                      ? 'mt-1 text-[#5e5e5e] dark:text-gray-300'
                      : 'text-[#383838] dark:text-white'
                  ]"
                >
                  {{ toast.message }}
                </p>
              </div>

              <!-- Close button -->
              <button
                @click="removeToast(toast.id)"
                class="-mr-1 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[3px] text-[#8b8b8b] transition-colors hover:bg-black/5 hover:text-[#383838] dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-300"
                aria-label="Close notification"
              >
                <Icon name="x" size="sm" />
              </button>
            </div>
          </div>

          <!-- Progress bar -->
          <div v-if="toast.duration" class="h-0.5 bg-black/5 dark:bg-white/5">
            <div
              :class="['h-full toast-progress', getProgressBarColor(toast.type)]"
              :style="{ animationDuration: `${toast.duration}ms` }"
            ></div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const toasts = computed(() => appStore.toasts)

const getToastIconName = (type: string): 'checkCircle' | 'xCircle' | 'exclamationTriangle' | 'infoCircle' => {
  switch (type) {
    case 'success':
      return 'checkCircle'
    case 'error':
      return 'xCircle'
    case 'warning':
      return 'exclamationTriangle'
    case 'info':
    default:
      return 'infoCircle'
  }
}

const getIconColor = (type: string): string => {
  const colors: Record<string, string> = {
    success: 'text-[#2ba471]',
    error: 'text-[#d54941]',
    warning: 'text-[#ed7b2f]',
    info: 'text-primary-600'
  }
  return colors[type] || colors.info
}

const getIconBackground = (type: string): string => {
  const colors: Record<string, string> = {
    success: 'bg-[#d9f3e8]',
    error: 'bg-[#fdecee]',
    warning: 'bg-[#fff1d2]',
    info: 'bg-primary-100'
  }
  return colors[type] || colors.info
}

const getSurfaceClass = (type: string): string => {
  const colors: Record<string, string> = {
    success: 'border-[#bcebdc] bg-[#f0fbf7] dark:border-[#2ba471]/40 dark:bg-dark-800',
    error: 'border-[#f7c7c3] bg-[#fff4f3] dark:border-[#d54941]/40 dark:bg-dark-800',
    warning: 'border-[#fce5c0] bg-[#fff7e8] dark:border-[#ed7b2f]/40 dark:bg-dark-800',
    info: 'border-primary-100 bg-primary-50 dark:border-primary-700/50 dark:bg-dark-800'
  }
  return colors[type] || colors.info
}

const getProgressBarColor = (type: string): string => {
  const colors: Record<string, string> = {
    success: 'bg-[#2ba471]',
    error: 'bg-[#d54941]',
    warning: 'bg-[#ed7b2f]',
    info: 'bg-primary-600'
  }
  return colors[type] || colors.info
}

const removeToast = (id: string) => {
  appStore.hideToast(id)
}
</script>

<style scoped>
.toast-progress {
  width: 100%;
  animation-name: toast-progress-shrink;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes toast-progress-shrink {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}
</style>
