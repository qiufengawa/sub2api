<template>
  <div class="auth-page" :class="{ 'qiu-home-dark': isDark }">
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
  --auth-bg: #fcfaf8;
  --auth-surface: #ffffff;
  --auth-text: #0a0a0a;
  --auth-soft: #9b958f;
  --auth-line: #e8e2dc;
  position: relative;
  min-height: 100svh;
  overflow-x: hidden;
  background: var(--auth-bg);
  color: var(--auth-text);
  font-family: "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.auth-page :deep(.qiu-site-header) {
  border-bottom: 1px solid var(--auth-line);
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

.auth-form-footer :deep(.auth-register-footer) {
  margin: 0;
  color: #6c6762;
}

.auth-form-footer :deep(.auth-text-link),
.auth-form-wrap :deep(.auth-text-link) {
  margin-left: 4px;
  color: #0a0a0a;
  font-size: 13px;
  font-weight: 600;
  text-decoration-line: underline;
  text-decoration-color: #c7c0ba;
  text-underline-offset: 4px;
}

.auth-form-footer :deep(.auth-text-link:hover),
.auth-form-wrap :deep(.auth-text-link:hover) {
  text-decoration-color: #0a0a0a;
}

.auth-page.qiu-home-dark .auth-form-footer :deep(.auth-register-footer) {
  color: #aaa49d;
}

.auth-page.qiu-home-dark .auth-form-footer :deep(.auth-text-link),
.auth-page.qiu-home-dark .auth-form-wrap :deep(.auth-text-link) {
  color: #f5f3f0;
}

.auth-copyright {
  position: absolute;
  right: 28px;
  bottom: 24px;
  left: 28px;
  color: var(--auth-soft);
  font-size: 11px;
  text-align: center;
}

.auth-page.qiu-home-dark {
  --auth-bg: #0a0a0a;
  --auth-surface: #111111;
  --auth-text: #f6f4f1;
  --auth-soft: #77716b;
  --auth-line: #2b2926;
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
