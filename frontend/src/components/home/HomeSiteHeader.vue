<template>
  <header class="qiu-site-header">
    <div class="qiu-site-nav">
      <a href="#home-top" class="qiu-site-brand" @click="closeMenu">
        <span class="qiu-site-logo">
          <img :src="siteLogo || '/logo.svg'" :alt="`${siteName} Logo`" />
        </span>
        <span class="qiu-site-name" :title="siteName">{{ siteName }}</span>
      </a>

      <nav class="qiu-desktop-links" :aria-label="t('home.nav.primary')">
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
          <LocaleSwitcher />
        </div>
        <a
          v-if="docUrl"
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
        <RouterLink :to="isAuthenticated ? dashboardPath : '/login'" class="qiu-auth-link">
          {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
          <Icon name="arrowRight" size="xs" />
        </RouterLink>
        <button
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
  border-bottom: 2px solid var(--qiu-ink);
  background: color-mix(in srgb, var(--qiu-paper) 94%, transparent);
  backdrop-filter: blur(12px);
}

.qiu-site-nav {
  display: flex;
  min-height: 58px;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 24px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
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
  gap: 10px;
  color: var(--qiu-ink);
  text-decoration: none;
}

.qiu-site-logo {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 2px solid var(--qiu-ink);
  border-radius: 4px;
  background: var(--qiu-surface);
  box-shadow: 3px 3px 0 var(--qiu-shadow);
}

.qiu-site-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qiu-site-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qiu-desktop-links {
  gap: 22px;
}

.qiu-desktop-links a {
  color: var(--qiu-muted);
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}

.qiu-desktop-links a:hover {
  color: var(--qiu-ink);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 5px;
}

.qiu-site-actions {
  flex: 0 0 auto;
  gap: 6px;
}

.qiu-icon-button {
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 4px;
  color: var(--qiu-muted);
  background: transparent;
  cursor: pointer;
}

.qiu-icon-button:hover {
  color: var(--qiu-ink);
  background: var(--qiu-surface);
}

.qiu-auth-link {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: 2px solid var(--qiu-ink);
  border-radius: 4px;
  color: var(--qiu-ink);
  background: var(--qiu-pink);
  box-shadow: 3px 3px 0 var(--qiu-shadow);
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
}

.qiu-auth-link:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--qiu-shadow);
}

.qiu-menu-button {
  display: none;
}

.qiu-mobile-menu {
  display: none;
}

@media (max-width: 980px) {
  .qiu-desktop-links {
    display: none;
  }

  .qiu-menu-button {
    display: inline-flex;
  }

  .qiu-mobile-menu {
    display: grid;
    max-width: 1180px;
    margin: 0 auto;
    padding: 6px 24px 14px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .qiu-mobile-menu a {
    min-width: 0;
    padding: 9px 10px;
    border: 1px solid color-mix(in srgb, var(--qiu-ink) 24%, transparent);
    border-radius: 4px;
    color: var(--qiu-ink);
    background: var(--qiu-surface);
    font-size: 12px;
    font-weight: 800;
    text-align: center;
    text-decoration: none;
  }
}

@media (max-width: 640px) {
  .qiu-site-nav {
    min-height: 54px;
    padding: 0 14px;
    gap: 8px;
  }

  .qiu-site-brand {
    max-width: min(46vw, 170px);
  }

  .qiu-site-logo {
    width: 30px;
    height: 30px;
  }

  .qiu-site-name {
    font-size: 13px;
  }

  .qiu-locale-control,
  .qiu-doc-button {
    display: none;
  }

  .qiu-auth-link {
    min-height: 32px;
    padding: 0 9px;
  }

  .qiu-mobile-menu {
    padding: 4px 14px 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
