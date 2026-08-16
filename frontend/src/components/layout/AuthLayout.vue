<template>
  <div class="auth-page">
    <HomeSiteHeader
      :site-name="siteName"
      :site-logo="siteLogo"
      :doc-url="docUrl"
      :is-dark="isDark"
      :is-authenticated="authStore.isAuthenticated"
      :dashboard-path="dashboardPath"
      :model-plaza-enabled="modelPlazaEnabled"
      compact
      @toggle-theme="toggleTheme"
    />

    <main class="auth-main">
      <div class="auth-form-wrap" :style="{ '--auth-form-width': contentWidth }">
        <slot />

        <div class="auth-form-footer">
          <slot name="footer" />
        </div>
      </div>
    </main>

    <div class="auth-copyright">
      &copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import HomeSiteHeader from '@/components/home/HomeSiteHeader.vue'
import { sanitizeUrl } from '@/utils/url'

const appStore = useAppStore()
const authStore = useAuthStore()
const { t } = useI18n()

withDefaults(
  defineProps<{
    contentWidth?: string
  }>(),
  {
    contentWidth: '420px'
  }
)

const siteName = computed(
  () => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API'
)
const siteLogo = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', {
    allowRelative: true,
    allowDataUrl: true
  })
)
const docUrl = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
)
const modelPlazaEnabled = computed(
  () => appStore.cachedPublicSettings?.model_plaza_enabled === true
)
const dashboardPath = computed(() => (authStore.isAdmin ? '/admin/dashboard' : '/dashboard'))
const currentYear = computed(() => new Date().getFullYear())
const isDark = ref(document.documentElement.classList.contains('dark'))

function toggleTheme(): void {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

onMounted(() => {
  if (!appStore.publicSettingsLoaded) void appStore.fetchPublicSettings()
})
</script>

<style scoped>
.auth-page {
  position: relative;
  min-height: 100svh;
  overflow-x: hidden;
  color: var(--ui-text);
  background: var(--ui-bg);
  font-family: var(--ui-font-sans);
}

.auth-main {
  display: flex;
  width: 100%;
  min-height: calc(100svh - 54px);
  align-items: center;
  justify-content: center;
  padding: 72px 28px 100px;
}

.auth-form-wrap {
  width: 100%;
  max-width: var(--auth-form-width);
}

.auth-form-footer {
  margin-top: 28px;
  text-align: center;
  font-size: 14px;
}

.auth-copyright {
  position: absolute;
  right: 28px;
  bottom: 24px;
  left: 28px;
  color: var(--ui-text-soft);
  font-size: 11px;
  text-align: center;
}

@media (max-width: 640px) {
  .auth-main {
    min-height: calc(100svh - 52px);
    align-items: flex-start;
    padding: 58px 24px 92px;
  }

  .auth-copyright {
    bottom: 20px;
  }
}
</style>
