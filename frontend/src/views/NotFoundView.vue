<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-dark-950 sm:px-6">
    <main class="w-full max-w-lg text-center">
      <div
        class="mx-auto flex h-12 w-12 items-center justify-center rounded-[4px] border border-gray-200 bg-white text-primary-600 dark:border-dark-700 dark:bg-dark-900 dark:text-primary-400"
      >
        <Icon name="exclamationCircle" size="lg" />
      </div>

      <p class="mt-6 text-7xl font-semibold leading-none text-gray-200 dark:text-dark-700 sm:text-8xl">
        404
      </p>
      <h1 class="mt-5 text-2xl font-semibold text-gray-900 dark:text-white">
        {{ t('errors.pageNotFound') }}
      </h1>
      <p class="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500 dark:text-dark-400">
        {{ t('errors.pageNotFoundDescription') }}
      </p>

      <div class="mt-8 flex flex-col-reverse justify-center gap-3 sm:flex-row">
        <button type="button" class="btn btn-secondary" @click="goBack">
          <Icon name="arrowLeft" size="md" />
          {{ t('common.back') }}
        </button>
        <router-link :to="primaryDestination" class="btn btn-primary">
          <Icon name="home" size="md" />
          {{ isAuthenticated ? t('home.goToDashboard') : t('common.goHome') }}
        </router-link>
      </div>

      <p
        v-if="contactInfo"
        class="mt-8 break-words border-t border-gray-200 pt-5 text-sm text-gray-500 dark:border-dark-700 dark:text-dark-400"
      >
        <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('common.contactSupport') }}:</span>
        {{ contactInfo }}
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const primaryDestination = computed(() => (isAuthenticated.value ? '/dashboard' : '/home'))
const contactInfo = computed(() => appStore.contactInfo.trim())

function goBack(): void {
  router.back()
}

onMounted(() => {
  if (!appStore.publicSettingsLoaded) {
    void appStore.fetchPublicSettings()
  }
})
</script>
