<template>
  <header class="qiu-site-header" :class="{ 'qiu-site-header--compact': compact }">
    <div class="qiu-site-nav">
      <RouterLink v-if="compact && compactBrandLink" to="/home" class="qiu-site-brand ui-focus-ring" @click="closeMenu()">
        <span v-if="siteLogo" class="qiu-site-logo">
          <img :src="siteLogo" :alt="`${siteName} Logo`" />
        </span>
        <span v-else class="qiu-site-name" :title="siteName">{{ siteName }}</span>
      </RouterLink>
      <a v-else :href="compact ? '/home' : '#home-top'" class="qiu-site-brand ui-focus-ring" @click="closeMenu()">
        <span v-if="siteLogo" class="qiu-site-logo">
          <img :src="siteLogo" :alt="`${siteName} Logo`" />
        </span>
        <span v-else class="qiu-site-name" :title="siteName">{{ siteName }}</span>
      </a>

      <nav v-if="!compact" class="qiu-desktop-links" :aria-label="t('home.nav.primary')">
        <a class="ui-focus-ring" href="#advantages">{{ t('home.nav.advantages') }}</a>
        <a class="ui-focus-ring" href="#model-coverage">{{ t('home.nav.models') }}</a>
        <a class="ui-focus-ring" href="#integration">{{ t('home.nav.integration') }}</a>
        <a class="ui-focus-ring" href="#faq">{{ t('home.nav.faq') }}</a>
        <RouterLink v-if="modelPlazaEnabled" class="ui-focus-ring" to="/model-plaza">
          {{ t('home.nav.modelPlaza') }}
        </RouterLink>
      </nav>

      <div class="qiu-site-actions">
        <div class="qiu-locale-control">
          <LocaleSwitcher :compact="compact" />
        </div>
        <RouterLink
          v-if="compact && modelPlazaEnabled"
          to="/model-plaza"
          class="qiu-model-plaza-link ui-focus-ring ui-motion"
        >
          {{ t('home.nav.modelPlaza') }}
          <Icon name="arrowRight" size="xs" />
        </RouterLink>
        <a
          v-if="docUrl && !compact"
          :href="docUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="qiu-icon-button qiu-doc-button ui-focus-ring ui-motion"
          :title="t('home.viewDocs')"
          :aria-label="t('home.viewDocs')"
        >
          <Icon name="book" size="sm" />
        </a>
        <UiIconButton
          type="button"
          variant="ghost"
          density="default"
          class="qiu-icon-button ui-motion"
          :label="isDark ? t('home.switchToLight') : t('home.switchToDark')"
          :tooltip="isDark ? t('home.switchToLight') : t('home.switchToDark')"
          @click="emit('toggle-theme')"
        >
          <Icon :name="isDark ? 'sun' : 'moon'" size="sm" />
        </UiIconButton>
        <RouterLink
          v-if="!compact"
          :to="isAuthenticated ? dashboardPath : '/login'"
          class="qiu-auth-link ui-focus-ring ui-motion"
        >
          {{ isAuthenticated ? t('home.dashboard') : t('home.login') }}
          <Icon name="arrowRight" size="xs" />
        </RouterLink>
        <a v-else href="/home" class="qiu-auth-link qiu-auth-link--quiet ui-focus-ring ui-motion">
          {{ t('common.goHome') }}
          <Icon name="arrowRight" size="xs" />
        </a>
        <UiIconButton
          v-if="!compact"
          ref="menuButton"
          type="button"
          variant="ghost"
          density="default"
          class="qiu-icon-button qiu-menu-button ui-motion"
          :label="t('home.nav.toggleMenu')"
          :tooltip="t('home.nav.toggleMenu')"
          :aria-expanded="menuOpen"
          aria-controls="qiu-mobile-menu"
          @click="menuOpen = !menuOpen"
        >
          <Icon :name="menuOpen ? 'x' : 'menu'" size="md" />
        </UiIconButton>
      </div>
    </div>

    <nav
      v-if="!compact"
      v-show="menuOpen"
      id="qiu-mobile-menu"
      class="qiu-mobile-menu"
      :aria-label="t('home.nav.mobile')"
    >
      <a class="ui-focus-ring" href="#advantages" @click="closeMenu()">{{ t('home.nav.advantages') }}</a>
      <a class="ui-focus-ring" href="#model-coverage" @click="closeMenu()">{{ t('home.nav.models') }}</a>
      <a class="ui-focus-ring" href="#integration" @click="closeMenu()">{{ t('home.nav.integration') }}</a>
      <a class="ui-focus-ring" href="#faq" @click="closeMenu()">{{ t('home.nav.faq') }}</a>
      <RouterLink v-if="modelPlazaEnabled" class="ui-focus-ring" to="/model-plaza" @click="closeMenu()">
        {{ t('home.nav.modelPlaza') }}
      </RouterLink>
      <a v-if="docUrl" class="ui-focus-ring" :href="docUrl" target="_blank" rel="noopener noreferrer" @click="closeMenu()">
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
import { UiIconButton } from '@/components/ui'

withDefaults(defineProps<{
  siteName: string
  siteLogo: string
  docUrl: string
  isDark: boolean
  isAuthenticated: boolean
  dashboardPath: string
  modelPlazaEnabled: boolean
  compact?: boolean
  compactBrandLink?: boolean
}>(), { compactBrandLink: true })

const emit = defineEmits<{
  'toggle-theme': []
}>()

const { t } = useI18n()
const menuOpen = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)

function closeMenu(restoreFocus = false): void {
  menuOpen.value = false
  if (restoreFocus) {
    menuButton.value?.focus()
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && menuOpen.value) {
    event.preventDefault()
    closeMenu(true)
  }
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
  color: var(--ui-text);
  background: color-mix(in srgb, var(--ui-bg) 94%, transparent);
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
  color: var(--ui-text);
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
  color: var(--ui-text);
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
  color: var(--ui-text);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  text-decoration: none;
  white-space: nowrap;
}

.qiu-desktop-links a:hover {
  color: var(--ui-text);
  background: var(--ui-surface-muted);
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
  color: var(--ui-text);
  background: transparent;
  cursor: pointer;
}

.qiu-icon-button:hover {
  color: var(--ui-text);
  background: var(--ui-surface-muted);
}

.qiu-auth-link {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 17px;
  border: 1px solid var(--ui-text);
  border-radius: 6px;
  color: var(--ui-inverse);
  background: var(--ui-text);
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
  border-color: var(--ui-border);
  color: var(--ui-text);
  background: var(--ui-surface);
}

.qiu-auth-link--quiet:hover {
  border-color: var(--ui-text-muted);
  background: var(--ui-surface-muted);
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
  border-color: var(--ui-border);
  background: var(--ui-surface-muted);
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
    background: color-mix(in srgb, var(--ui-bg) 97%, transparent);
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
    border: 1px solid var(--ui-border-soft);
    border-radius: 6px;
    color: var(--ui-text);
    background: var(--ui-surface);
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
    width: clamp(96px, 28vw, 132px);
    height: 28px;
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

  .qiu-mobile-menu {
    padding-bottom: 12px;
  }
}

</style>
