<template>
  <div class="auth-page relative min-h-screen bg-white dark:bg-dark-950">
    <header
      v-if="settingsLoaded"
      class="absolute left-5 top-6 z-20 flex items-center gap-3 sm:top-8"
    >
      <div
        class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[4px] border border-[#e7e7e7] bg-white p-1.5 dark:border-dark-700 dark:bg-dark-900"
      >
        <img :src="siteLogo || '/logo.svg'" :alt="siteName" class="h-full w-full object-contain" />
      </div>
      <div class="min-w-0">
        <div class="text-lg font-semibold tracking-tight text-[#181818] dark:text-white">
          {{ siteName }}
        </div>
      </div>
    </header>

    <div
      class="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] items-start px-5 pb-20 pt-24 sm:px-10 sm:pb-24 sm:pt-28 lg:items-center lg:px-[5%] lg:py-20"
    >
      <main class="w-full lg:w-[44%]">
        <div class="mx-auto w-full max-w-[400px] lg:mx-0">
          <slot />

          <div class="mt-8 text-center text-sm">
            <slot name="footer" />
          </div>
        </div>
      </main>

      <aside
        class="relative hidden min-h-[560px] flex-1 items-center justify-center overflow-hidden lg:flex"
        aria-hidden="true"
      >
        <div class="auth-console relative h-[390px] w-[590px] overflow-hidden rounded-md">
          <div class="flex h-11 items-center border-b border-[#e7e7e7] bg-white px-4 dark:border-dark-700 dark:bg-dark-900">
            <div class="flex gap-1.5">
              <span class="h-2 w-2 rounded-full bg-[#dcdcdc] dark:bg-dark-600"></span>
              <span class="h-2 w-2 rounded-full bg-[#dcdcdc] dark:bg-dark-600"></span>
              <span class="h-2 w-2 rounded-full bg-primary-200 dark:bg-primary-800"></span>
            </div>
            <div class="ml-7 h-2 w-28 rounded-sm bg-[#eeeeee] dark:bg-dark-700"></div>
          </div>

          <div class="flex h-[346px] bg-[#f3f3f3] dark:bg-dark-950">
            <div class="w-32 border-r border-[#e7e7e7] bg-white px-3 py-5 dark:border-dark-700 dark:bg-dark-900">
              <div class="mb-6 flex items-center gap-2 px-2">
                <div class="h-6 w-6 rounded-[3px] bg-primary-600"></div>
                <div class="h-2 w-14 rounded-sm bg-[#dcdcdc] dark:bg-dark-600"></div>
              </div>
              <div class="space-y-2">
                <div class="flex h-8 items-center gap-2 rounded-[3px] bg-primary-50 px-2 dark:bg-primary-950/40">
                  <div class="h-3 w-3 rounded-[2px] bg-primary-600"></div>
                  <div class="h-2 w-12 rounded-sm bg-primary-200 dark:bg-primary-800"></div>
                </div>
                <div v-for="index in 5" :key="index" class="flex h-8 items-center gap-2 px-2">
                  <div class="h-3 w-3 rounded-[2px] bg-[#dcdcdc] dark:bg-dark-600"></div>
                  <div class="h-2 rounded-sm bg-[#e7e7e7] dark:bg-dark-700" :class="index % 2 === 0 ? 'w-14' : 'w-10'"></div>
                </div>
              </div>
            </div>

            <div class="flex-1 p-5">
              <div class="mb-5 flex items-center justify-between">
                <div>
                  <div class="h-3 w-24 rounded-sm bg-[#777777] dark:bg-dark-400"></div>
                  <div class="mt-2 h-2 w-36 rounded-sm bg-[#dcdcdc] dark:bg-dark-600"></div>
                </div>
                <div class="h-7 w-16 rounded-[3px] bg-primary-600"></div>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div v-for="index in 3" :key="index" class="rounded-[4px] border border-[#e7e7e7] bg-white p-3 dark:border-dark-700 dark:bg-dark-900">
                  <div class="h-2 w-12 rounded-sm bg-[#c5c5c5] dark:bg-dark-600"></div>
                  <div class="mt-4 h-4 w-16 rounded-sm" :class="index === 1 ? 'bg-primary-600' : 'bg-[#5e5e5e] dark:bg-dark-400'"></div>
                  <div class="mt-3 h-1.5 w-20 rounded-sm bg-[#eeeeee] dark:bg-dark-700"></div>
                </div>
              </div>

              <div class="mt-3 rounded-[4px] border border-[#e7e7e7] bg-white p-4 dark:border-dark-700 dark:bg-dark-900">
                <div class="mb-5 flex items-center justify-between">
                  <div class="h-2.5 w-20 rounded-sm bg-[#777777] dark:bg-dark-400"></div>
                  <div class="h-2 w-12 rounded-sm bg-primary-200 dark:bg-primary-800"></div>
                </div>
                <div class="flex h-24 items-end gap-2 border-b border-l border-[#eeeeee] pl-3 dark:border-dark-700">
                  <div v-for="height in chartBars" :key="height" class="flex-1 rounded-t-[2px] bg-primary-100 dark:bg-primary-900/60" :style="{ height: `${height}%` }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <div class="absolute bottom-7 left-5 z-20 text-xs text-[#8b8b8b] dark:text-dark-500 sm:left-10 lg:left-[5%]">
      &copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import { sanitizeUrl } from '@/utils/url'

const appStore = useAppStore()
const { t } = useI18n()

const siteName = computed(() => appStore.siteName || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const settingsLoaded = computed(() => appStore.publicSettingsLoaded)

const currentYear = computed(() => new Date().getFullYear())
const chartBars = [34, 48, 42, 67, 58, 82, 64, 88, 76, 94, 84, 100]

onMounted(() => {
  appStore.fetchPublicSettings()
})
</script>

<style scoped>
.auth-console {
  border: 1px solid rgb(220 220 220 / 0.9);
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.06);
}

:global(.dark) .auth-console {
  border-color: rgb(51 65 85 / 0.9);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
}
</style>
