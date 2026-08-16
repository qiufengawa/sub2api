<template>
  <header class="plaza-nav">
    <div class="plaza-nav__inner">
      <RouterLink to="/" class="plaza-nav__brand" :aria-label="siteName">
        <img v-if="siteLogo" :src="siteLogo" :alt="siteName" class="plaza-nav__logo" />
        <span v-else-if="settings" class="plaza-nav__name">{{ siteName }}</span>
        <template v-else>
          <UiSkeleton variant="rect" width="32px" height="32px" />
          <UiSkeleton variant="text" width="112px" height="18px" />
        </template>
      </RouterLink>

      <UiLink
        v-if="isAuthenticated"
        :to="backTarget"
      >{{ t('modelPlaza.nav.backToDashboard') }}</UiLink>
      <UiLink
        v-else
        :to="{ path: '/login', query: { redirect: '/model-plaza' } }"
      >{{ t('modelPlaza.nav.login') }}</UiLink>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { sanitizeUrl } from '@/utils/url'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { UiLink, UiSkeleton } from '@/components/ui'

const { t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const settings = computed(() => appStore.cachedPublicSettings)
const siteName = computed(() => settings.value?.site_name || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(settings.value?.site_logo || '', { allowRelative: true, allowDataUrl: true }))
const isAuthenticated = computed(() => authStore.isAuthenticated)
const backTarget = computed(() => (authStore.isAdmin ? '/admin/dashboard' : '/dashboard'))
</script>

<style scoped>
.plaza-nav { position: sticky; top: 0; z-index: 30; border-bottom: 1px solid var(--ui-border-soft); background: color-mix(in srgb, var(--ui-bg) 94%, transparent); backdrop-filter: blur(12px); }
.plaza-nav__inner { display: flex; max-width: 1540px; min-height: 56px; align-items: center; justify-content: space-between; gap: 16px; margin: 0 auto; padding: 10px 24px; }
.plaza-nav__brand { display: flex; min-width: 0; align-items: center; gap: 10px; color: var(--ui-text); text-decoration: none; }
.plaza-nav__logo { display: block; width: auto; max-width: 180px; height: 30px; object-fit: contain; object-position: left center; }
.plaza-nav__name { overflow: hidden; font-size: 15px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 640px) { .plaza-nav__inner { padding: 8px 12px; } .plaza-nav__logo { max-width: 140px; } }
</style>
