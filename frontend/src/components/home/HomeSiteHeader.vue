<template>
  <header class="qiu-site-header" :class="{ 'qiu-site-header--compact': compact }">
    <div class="qiu-site-nav">
      <RouterLink v-if="compact" to="/home" class="qiu-site-brand" @click="closeMenu">
        <span v-if="siteLogo" class="qiu-site-logo">
          <img :src="siteLogo" :alt="`${siteName} Logo`" />
        </span>
        <span v-else class="qiu-site-name" :title="siteName">{{ siteName }}</span>
      </RouterLink>
      <a v-else href="#home-top" class="qiu-site-brand" @click="closeMenu">
        <span v-if="siteLogo" class="qiu-site-logo">
          <img :src="siteLogo" :alt="`${siteName} Logo`" />
        </span>
        <span v-else class="qiu-site-name" :title="siteName">{{ siteName }}</span>
      </a>

      <nav v-if="!compact" class="qiu-desktop-links" :aria-label="t('home.nav.primary')">
        <a href="#advantages">{{ t('home.nav.advantages') }}</a>
        <a href="#model-coverage">{{ t('home.nav.models') }}</a>
        <a href="#integration">{{ t('home.nav.integration') }}</a>
        <a href="#faq">{{ t('home.nav.faq') }}</a>
        <RouterLink v-if="modelPlazaEnabled" to="/model-plaza">
          {{ t('home.nav.modelPlaza') }}
        </RouterLink>
      </nav>

      <div class="qiu-site-actions">
        <div class="qiu-locale-control">
          <LocaleSwitcher :compact="compact" />
        </div>
        <a
          v-if="docUrl && !compact"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="qiu-icon-button qiu-doc-button"
          :title="t('home.viewDocs')"
          :aria-label="t('home.viewDocs')"
        >
          <Icon name="book" size="sm" />
        </a>
        <button
          type="button"
          class="qiu-icon-button"
          :title="isDark ? t('home.switchToLight') : t('home.switchToDark')"
          :aria-label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
          @click="emit('toggle-theme')"
        >
          <Icon :name="isDark ? 'sun' : 'moon'" size="sm" />
        </button>
        <RouterLink
          :to="compact ? '/home' : isAuthenticated ? dashboardPath : '/login'"
          class="qiu-auth-link"
          :class="{ 'qiu-auth-link--quiet': compact }"
        >
          {{ compact ? t('common.goHome') : isAuthenticated ? t('home.dashboard') : t('home.login') }}
          <Icon name="arrowRight" size="xs" />
        </RouterLink>
        <button
          v-if="!compact"
          type="button"
          class="qiu-icon-button qiu-menu-button"
          :aria-label="t('home.nav.toggleMenu')"
          :aria-expanded="menuOpen"
          aria-controls="qiu-mobile-menu"
          @click="menuOpen = !menuOpen"
        >
          <Icon :name="menuOpen ? 'x' : 'menu'" size="md" />
        </button>
      </div>
    </div>

    <nav
      v-if="!compact"
      v-show="menuOpen"
      id="qiu-mobile-menu"
      class="qiu-mobile-menu"
      :aria-label="t('home.nav.mobile')"
    >
      <a href="#advantages" @click="closeMenu">{{ t('home.nav.advantages') }}</a>
      <a href="#model-coverage" @click="closeMenu">{{ t('home.nav.models') }}</a>
      <a href="#integration" @click="closeMenu">{{ t('home.nav.integration') }}</a>
      <a href="#faq" @click="closeMenu">{{ t('home.nav.faq') }}</a>
      <RouterLink v-if="modelPlazaEnabled" to="/model-plaza" @click="closeMenu">
        {{ t('home.nav.modelPlaza') }}
      </RouterLink>
      <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer" @click="closeMenu">
        {{ t('home.docs') }}
      </a>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'

defineProps<{
  siteName: string
  siteLogo: string
  docUrl: string
  isDark: boolean
  isAuthenticated: boolean
  dashboardPath: string
  modelPlazaEnabled: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  'toggle-theme': []
}>()

const { t } = useI18n()
const menuOpen = ref(false)

function closeMenu(): void {
  menuOpen.value = false
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.qiu-site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  width: 100%;
  background: color-mix(in srgb, #fcfaf8 94%, transparent);
  backdrop-filter: blur(16px);
}

.qiu-site-nav {
  display: flex;
  width: calc(100% - 56px);
  max-width: 1260px;
  min-height: 54px;
  margin: 0 auto;
  padding: 4px 0;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.qiu-site-brand,
.qiu-site-actions,
.qiu-desktop-links {
  display: flex;
  align-items: center;
}

.qiu-site-brand {
  min-width: 0;
  max-width: 250px;
  gap: 8px;
  color: #000;
  text-decoration: none;
}

.qiu-site-logo {
  display: block;
  width: clamp(112px, 11vw, 160px);
  height: 32px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.qiu-site-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

.qiu-site-name {
  overflow: hidden;
  color: #000;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qiu-desktop-links {
  gap: 6px;
}

.qiu-desktop-links a {
  display: inline-flex;
  height: 36px;
  padding: 8px 16px;
  align-items: center;
  border-radius: 6px;
  color: #000;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  text-decoration: none;
  white-space: nowrap;
}

.qiu-desktop-links a:hover {
  color: #000;
  background: #f0ebe5;
}

.qiu-site-actions {
  flex: 0 0 auto;
  gap: 6px;
}

.qiu-icon-button {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  color: #1f2329;
  background: transparent;
  cursor: pointer;
}

.qiu-icon-button:hover {
  color: #000;
  background: #f5f5f5;
}

.qiu-auth-link {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 17px;
  border: 1px solid #000;
  border-radius: 6px;
  color: #fff;
  background: #000;
  box-shadow: none;
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  text-decoration: none;
}

.qiu-auth-link:active {
  transform: none;
  box-shadow: none;
}

.qiu-auth-link--quiet {
  border-color: #ded8d2;
  color: #000;
  background: #fff;
}

.qiu-auth-link--quiet:hover {
  border-color: #aaa39c;
  background: #f5f1ed;
}

.qiu-site-header--compact .qiu-site-nav {
  min-height: 52px;
}

.qiu-site-header--compact .qiu-site-actions {
  gap: 4px;
}

.qiu-site-header--compact .qiu-icon-button,
.qiu-site-header--compact .qiu-auth-link {
  height: 32px;
  min-height: 32px;
  border-radius: 5px;
}

.qiu-site-header--compact .qiu-icon-button {
  width: 32px;
  border: 1px solid transparent;
}

.qiu-site-header--compact .qiu-icon-button:hover {
  border-color: #e6e0da;
  background: #f5f1ed;
}

.qiu-site-header--compact .qiu-auth-link {
  gap: 5px;
  padding: 0 11px;
  font-size: 12px;
  line-height: 1;
}

.qiu-menu-button {
  display: none;
}

.qiu-mobile-menu {
  display: none;
}

@media (min-width: 1440px) {
  .qiu-site-nav {
    width: 100%;
  }
}

@media (max-width: 767px) {
  .qiu-site-header {
    position: sticky;
    background: color-mix(in srgb, #fcfaf8 97%, transparent);
  }

  .qiu-site-nav {
    width: 100%;
    min-height: 52px;
    padding: 8px 28px;
  }

  .qiu-desktop-links {
    display: none;
  }

  .qiu-menu-button {
    display: inline-flex;
  }

  .qiu-mobile-menu {
    display: grid;
    width: calc(100% - 56px);
    max-width: 1260px;
    margin: 0 auto;
    padding: 8px 0 16px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .qiu-mobile-menu a {
    min-width: 0;
    min-height: 36px;
    padding: 7px 12px;
    border: 1px solid #f0ebe5;
    border-radius: 6px;
    color: #000;
    background: #fff;
    font-size: 13px;
    font-weight: 400;
    text-align: center;
    text-decoration: none;
  }
}

@media (max-width: 640px) {
  .qiu-site-brand {
    max-width: min(46vw, 170px);
  }

  .qiu-site-logo {
    width: 22px;
    height: 22px;
  }

  .qiu-site-name {
    font-size: 13px;
  }

  .qiu-doc-button {
    display: none;
  }

  .qiu-site-header:not(.qiu-site-header--compact) .qiu-locale-control {
    display: none;
  }

  .qiu-auth-link {
    min-height: 32px;
    height: 32px;
    padding: 5px 12px;
    font-size: 12px;
  }

  .qiu-site-header--compact .qiu-site-nav {
    min-height: 52px;
    padding: 8px 20px;
  }

  .qiu-site-header--compact .qiu-site-brand {
    max-width: min(36vw, 150px);
  }

  .qiu-site-header--compact .qiu-locale-control :deep(.locale-switcher__code),
  .qiu-site-header--compact .qiu-locale-control :deep(.locale-switcher__chevron) {
    display: none;
  }

  .qiu-site-header--compact .qiu-locale-control :deep(.locale-switcher__trigger) {
    width: 32px;
    padding: 0;
    justify-content: center;
  }

  .qiu-mobile-menu {
    padding-bottom: 12px;
  }
}

:global(.qiu-home-dark) .qiu-site-header {
  background: color-mix(in srgb, #0a0a0a 94%, transparent);
}

:global(.qiu-home-dark) .qiu-site-brand,
:global(.qiu-home-dark) .qiu-site-name,
:global(.qiu-home-dark) .qiu-desktop-links a,
:global(.qiu-home-dark) .qiu-icon-button {
  color: #fff;
}

:global(.qiu-home-dark) .qiu-desktop-links a:hover,
:global(.qiu-home-dark) .qiu-icon-button:hover {
  color: #fff;
  background: #1a1a1a;
}

:global(.qiu-home-dark) .qiu-auth-link {
  border-color: #fff;
  color: #000;
  background: #fff;
}

:global(.qiu-home-dark) .qiu-auth-link--quiet {
  border-color: #34302c;
  color: #fff;
  background: #111;
}
</style>
