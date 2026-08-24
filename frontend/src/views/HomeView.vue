<template>
  <!-- Advanced custom home content keeps its existing full-page contract. -->
  <div v-if="hasHomeContent" class="min-h-screen">
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      :title="siteName"
      class="h-screen w-full border-0"
      sandbox="allow-scripts allow-forms allow-popups allow-presentation"
      referrerpolicy="no-referrer"
      allowfullscreen
    ></iframe>
    <!-- SECURITY: homeContent is an administrator-controlled setting. -->
    <div v-else v-html="homeContent"></div>
  </div>

  <!-- Compact Home Page -->
  <div
    v-else-if="compactHomeEnabled"
    data-testid="compact-home"
    class="home-compact"
  >
    <HomeSiteHeader
      compact
      :site-name="siteName"
      :site-logo="siteLogo"
      :doc-url="docUrl"
      :is-dark="isDark"
      :is-authenticated="isAuthenticated"
      :dashboard-path="dashboardPath"
      :model-plaza-enabled="showModelPlazaEntry"
      :compact-brand-link="false"
      @toggle-theme="toggleTheme"
    />

    <main class="home-compact__main">
      <div class="home-compact__content">
        <img
          v-if="siteLogo"
          :src="siteLogo"
          :alt="siteName"
          class="home-compact__logo"
        />
        <h1>{{ siteName }}</h1>
        <p>{{ siteSubtitle }}</p>
        <RouterLink
          :to="isAuthenticated ? dashboardPath : '/login'"
          class="home-compact__action"
        >
          {{ isAuthenticated ? t('home.goToDashboard') : t('home.login') }}
        </RouterLink>
      </div>
    </main>

    <footer class="home-compact__footer">
      &copy; {{ currentYear }} {{ siteName }}
    </footer>
  </div>

  <div v-else id="home-top" class="qiu-home" :class="{ 'qiu-home-dark': isDark }">
    <HomeSiteHeader
      :site-name="siteName"
      :site-logo="siteLogo"
      :doc-url="docUrl"
      :is-dark="isDark"
      :is-authenticated="isAuthenticated"
      :dashboard-path="dashboardPath"
      :model-plaza-enabled="showModelPlazaEntry"
      @toggle-theme="toggleTheme"
    />

    <main class="qiu-main">
      <div class="qiu-home-inner">
        <section class="qiu-hero" aria-labelledby="home-hero-title">
          <div class="qiu-hero-earth" aria-hidden="true">
            <div class="qiu-hero-earth-inner">
              <HomeEarthAnimation />
            </div>
          </div>

          <div class="qiu-hero-content" data-cursor="hero">
            <h1 id="home-hero-title" class="qiu-hero-title">
              <span
                v-for="(character, index) in siteNameCharacters"
                :key="`${character}-${index}`"
                class="qiu-hero-char"
                :style="{ animationDelay: `${0.3 + index * 0.06}s` }"
              >{{ character === ' ' ? '\u00a0' : character }}</span>
            </h1>
            <p class="qiu-hero-subtitle">{{ siteSubtitle }}</p>
            <div class="qiu-hero-buttons" data-hero-buttons="true">
              <RouterLink class="qiu-hero-button qiu-hero-button-primary" :to="primaryEntryPath">
                <span>{{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}</span>
                <span class="qiu-hero-button-arrow" aria-hidden="true">&#8594;</span>
              </RouterLink>
              <RouterLink
                v-if="showModelPlazaEntry"
                class="qiu-hero-button qiu-hero-button-outline"
                to="/model-plaza"
              >
                <span>{{ t('home.viewModelsAndPricing') }}</span>
                <span class="qiu-hero-button-arrow" aria-hidden="true">&#8594;</span>
              </RouterLink>
              <a
                v-if="docUrl"
                class="qiu-hero-button qiu-hero-button-outline"
                :href="docUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{{ t('home.docs') }}</span>
                <span class="qiu-hero-button-arrow" aria-hidden="true">&#8594;</span>
              </a>
            </div>
          </div>
        </section>

        <div class="qiu-wrap">
        <section class="qiu-updates" :aria-label="t('home.coreCapabilities')">
          <div class="qiu-section-header">
            <h2>{{ t('home.coreCapabilities') }}</h2>
          </div>
          <div class="qiu-updates-grid">
            <article v-for="item in capabilityItems" :key="item.title" class="qiu-update-card">
              <div class="qiu-update-content">
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </div>
              <RouterLink class="qiu-update-link" :to="primaryEntryPath">
                <span>{{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}</span>
                <span aria-hidden="true">&#8594;</span>
              </RouterLink>
            </article>
          </div>
        </section>

        <section id="advantages" class="qiu-section qiu-section-clean" aria-labelledby="advantages-title">
          <div class="qiu-heading">
            <h3 id="advantages-title">{{ t('home.sections.why.title', { site: siteName }) }}</h3>
          </div>
          <div class="qiu-advantage-layout">
            <article class="qiu-feature-lead">
              <Icon name="swap" size="xl" />
              <h4>{{ t('home.sections.why.leadTitle') }}</h4>
              <p>{{ t('home.sections.why.leadDescription') }}</p>
            </article>
            <div class="qiu-feature-list">
              <article v-for="(feature, index) in advantageItems" :key="feature.title" :class="`qiu-feature-${index + 1}`">
                <Icon :name="feature.icon" size="md" />
                <div>
                  <strong>{{ feature.title }}</strong>
                  <p>{{ feature.description }}</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="qiu-section qiu-section-clean" aria-labelledby="prompts-title">
          <div class="qiu-heading">
            <h3 id="prompts-title">{{ t('home.sections.prompts.title') }}</h3>
          </div>
          <p class="qiu-intro qiu-dropcap">{{ t('home.sections.prompts.description') }}</p>
          <div class="qiu-prompts">
            <article v-for="prompt in promptItems" :key="prompt.label" class="qiu-prompt">
              <b>{{ prompt.label }}</b>
              <strong>{{ prompt.text }}</strong>
            </article>
          </div>
        </section>

        <section id="model-coverage" class="qiu-section qiu-section-clean" aria-labelledby="models-title">
          <div class="qiu-heading">
            <h3 id="models-title">{{ t('home.sections.models.title') }}</h3>
          </div>
          <p class="qiu-intro">{{ t('home.sections.models.description') }}</p>
          <div class="qiu-model-grid">
            <article v-for="provider in providerItems" :key="provider.name" class="qiu-model-item">
              <div class="qiu-model-cover" aria-hidden="true">
                <img :src="provider.image" alt="" />
              </div>
              <div class="qiu-model-body">
                <b>{{ provider.name }}</b>
                <strong>{{ provider.family }}</strong>
                <p>{{ provider.description }}</p>
                <div class="qiu-model-meta">
                  <span>{{ t('home.sections.models.openPlaza') }}</span>
                  <span aria-hidden="true">&#8594;</span>
                </div>
              </div>
            </article>
          </div>
          <RouterLink v-if="showModelPlazaEntry" to="/model-plaza" class="qiu-text-link">
            {{ t('home.sections.models.openPlaza') }}
            <Icon name="arrowRight" size="sm" />
          </RouterLink>
        </section>

        <section class="qiu-section qiu-section-clean qiu-pricing" aria-labelledby="pricing-title">
          <div class="qiu-pricing-intro">
            <h3 id="pricing-title">{{ t('home.sections.pricing.title') }}</h3>
            <p>{{ t('home.sections.pricing.description') }}</p>
            <RouterLink v-if="showModelPlazaEntry" to="/model-plaza" class="qiu-pricing-action">
              {{ t('home.viewModelsAndPricing') }}
              <span aria-hidden="true">&#8594;</span>
            </RouterLink>
          </div>
          <ol class="qiu-pricing-list">
            <li v-for="(item, index) in pricingItems" :key="item.title">
              <span class="qiu-pricing-index">0{{ index + 1 }}</span>
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </div>
            </li>
          </ol>
        </section>

        <section id="integration" class="qiu-section qiu-section-clean" aria-labelledby="integration-title">
          <div class="qiu-heading">
            <h3 id="integration-title">{{ t('home.sections.integration.title') }}</h3>
          </div>
          <div class="qiu-integration-layout">
            <div>
              <p class="qiu-intro qiu-dropcap">{{ t('home.sections.integration.description') }}</p>
              <pre class="qiu-code"><code>base_url = "{{ apiBaseUrl }}"
api_key = "sk-xxxxxxxx"
model = "{{ t('home.sections.integration.modelPlaceholder') }}"</code></pre>
            </div>
            <div class="qiu-endpoints">
              <div v-for="endpoint in endpointItems" :key="`${endpoint.method}-${endpoint.path}`" class="qiu-endpoint">
                <span class="qiu-method">{{ endpoint.method }}</span>
                <code>{{ endpoint.path }}</code>
              </div>
              <p>{{ t('home.sections.integration.capabilityNote') }}</p>
            </div>
          </div>
        </section>

        <section class="qiu-section qiu-section-clean" aria-labelledby="launch-title">
          <div class="qiu-heading">
            <h3 id="launch-title">{{ t('home.sections.launch.title') }}</h3>
          </div>
          <ol class="qiu-timeline">
            <li v-for="(step, index) in launchItems" :key="step.title">
              <span>{{ index + 1 }}</span>
              <div>
                <h4>{{ step.title }}</h4>
                <p>{{ step.description }}</p>
              </div>
            </li>
          </ol>
        </section>

        <section class="qiu-section qiu-section-clean" aria-labelledby="capabilities-title">
          <div class="qiu-capability-layout">
            <div class="qiu-capability-intro">
              <h3 id="capabilities-title">{{ t('home.sections.capabilities.title') }}</h3>
              <p>{{ t('home.sections.capabilities.description') }}</p>
              <RouterLink :to="primaryEntryPath" class="qiu-capability-action">
                {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}
                <span aria-hidden="true">&#8594;</span>
              </RouterLink>
            </div>
            <ol class="qiu-capability-list">
              <li v-for="(capability, index) in capabilityItems" :key="capability.title">
                <span class="qiu-capability-index">0{{ index + 1 }}</span>
                <div>
                  <strong>{{ capability.title }}</strong>
                  <p>{{ capability.description }}</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section class="qiu-section qiu-section-clean" aria-labelledby="use-cases-title">
          <div class="qiu-heading">
            <h3 id="use-cases-title">{{ t('home.sections.useCases.title') }}</h3>
          </div>
          <div class="qiu-usecase-layout">
            <p class="qiu-usecase-lead">{{ t('home.sections.useCases.lead') }}</p>
            <div class="qiu-usecase-list">
              <p v-for="item in useCaseItems" :key="item.title"><b>{{ item.title }}</b>{{ item.description }}</p>
            </div>
          </div>
        </section>

        <section id="faq" class="qiu-section qiu-section-clean qiu-faq-section" aria-labelledby="faq-title">
          <div class="qiu-faq-intro">
            <span>{{ t('home.sections.faq.eyebrow') }}</span>
            <h3 id="faq-title">{{ t('home.sections.faq.title') }}</h3>
            <p>{{ t('home.sections.faq.description') }}</p>
          </div>
          <div class="qiu-faq-list">
            <details v-for="(item, index) in faqItems" :key="item.question" :open="index === 0">
              <summary>
                <span>{{ item.question }}</span>
                <span class="qiu-faq-toggle" aria-hidden="true"></span>
              </summary>
              <p>{{ item.answer }}</p>
            </details>
          </div>
        </section>

        <footer class="qiu-footer">
          <span>&copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}</span>
        </footer>
      </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import HomeSiteHeader from '@/components/home/HomeSiteHeader.vue'
import HomeEarthAnimation from '@/components/home/HomeEarthAnimation.vue'
import Icon from '@/components/icons/Icon.vue'
import { sanitizeUrl } from '@/utils/url'
import type { GroupPlatform } from '@/types'

type IconName = InstanceType<typeof Icon>['$props']['name']

interface FeatureItem {
  title: string
  description: string
  icon: IconName
}

interface ProviderItem {
  name: string
  family: string
  description: string
  platform: GroupPlatform
  colorClass: string
  image: string
}

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()

const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteSubtitle = computed(() => appStore.cachedPublicSettings?.site_subtitle || t('home.heroSubtitle'))
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
const hasHomeContent = computed(() => homeContent.value.trim().length > 0)
const compactHomeEnabled = computed(() => appStore.cachedPublicSettings?.compact_home_enabled === true)
const apiBaseUrl = computed(() => {
  const value = String(appStore.cachedPublicSettings?.api_base_url || '').trim().replace(/\/+$/, '')
  return value || '/v1'
})
const modelPlazaEnabled = computed(() => appStore.cachedPublicSettings?.model_plaza_enabled === true)
const registrationEnabled = computed(() => appStore.cachedPublicSettings?.registration_enabled !== false)
const siteNameCharacters = computed(() => Array.from(siteName.value))

const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

const isDark = ref(document.documentElement.classList.contains('dark'))
const isAuthenticated = computed(() => authStore.isAuthenticated)
const modelPlazaRequiresAuth = computed(
  () => appStore.cachedPublicSettings?.model_plaza_require_auth === true,
)
const showModelPlazaEntry = computed(
  () => modelPlazaEnabled.value && (isAuthenticated.value || !modelPlazaRequiresAuth.value),
)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => isAdmin.value ? '/admin/dashboard' : '/dashboard')
const primaryEntryPath = computed(() => {
  if (isAuthenticated.value) return dashboardPath.value
  return registrationEnabled.value ? '/register' : '/login'
})
const currentYear = computed(() => new Date().getFullYear())

const advantageItems = computed<FeatureItem[]>(() => [
  { title: t('home.sections.why.items.pricing.title'), description: t('home.sections.why.items.pricing.description'), icon: 'dollar' },
  { title: t('home.sections.why.items.coverage.title'), description: t('home.sections.why.items.coverage.description'), icon: 'grid' },
  { title: t('home.sections.why.items.migration.title'), description: t('home.sections.why.items.migration.description'), icon: 'arrowRight' },
])

const promptItems = computed(() => ['integration', 'migration', 'selection', 'schema', 'benchmark', 'streaming'].map((key) => ({
  label: t(`home.sections.prompts.items.${key}.label`),
  text: t(`home.sections.prompts.items.${key}.text`, { site: siteName.value }),
})))

const providerItems = computed<ProviderItem[]>(() => [
  { name: 'OpenAI', family: t('home.sections.models.items.openai.family'), description: t('home.sections.models.items.openai.description'), platform: 'openai', colorClass: 'qiu-model-openai', image: '/animations/home-earth/model-1.png' },
  { name: 'Anthropic', family: t('home.sections.models.items.anthropic.family'), description: t('home.sections.models.items.anthropic.description'), platform: 'anthropic', colorClass: 'qiu-model-anthropic', image: '/animations/home-earth/model-2.png' },
  { name: 'Google', family: t('home.sections.models.items.gemini.family'), description: t('home.sections.models.items.gemini.description'), platform: 'gemini', colorClass: 'qiu-model-gemini', image: '/animations/home-earth/model-3.png' },
  { name: 'xAI', family: t('home.sections.models.items.grok.family'), description: t('home.sections.models.items.grok.description'), platform: 'grok', colorClass: 'qiu-model-grok', image: '/animations/home-earth/model-4.png' },
  { name: 'DeepSeek', family: t('home.sections.models.items.deepseek.family'), description: t('home.sections.models.items.deepseek.description'), platform: 'composite', colorClass: 'qiu-model-deepseek', image: '/animations/home-earth/model-5.png' },
  { name: t('home.sections.models.items.more.name'), family: t('home.sections.models.items.more.family'), description: t('home.sections.models.items.more.description'), platform: 'composite', colorClass: 'qiu-model-more', image: '/animations/home-earth/model-1.png' },
])

const pricingItems = computed(() => ['models', 'usage', 'live'].map((key) => ({
  title: t(`home.sections.pricing.items.${key}.title`),
  description: t(`home.sections.pricing.items.${key}.description`),
})))

const endpointItems = computed(() => [
  { method: 'GET', path: `${apiBaseUrl.value}/models` },
  { method: 'POST', path: `${apiBaseUrl.value}/chat/completions` },
  { method: 'POST', path: `${apiBaseUrl.value}/responses` },
])

const launchItems = computed(() => ['key', 'endpoint', 'model', 'monitor'].map((key) => ({
  title: t(`home.sections.launch.items.${key}.title`),
  description: t(`home.sections.launch.items.${key}.description`),
})))

const capabilityItems = computed<FeatureItem[]>(() => [
  { title: t('home.sections.capabilities.items.sdk.title'), description: t('home.sections.capabilities.items.sdk.description'), icon: 'cube' },
  { title: t('home.sections.capabilities.items.streaming.title'), description: t('home.sections.capabilities.items.streaming.description'), icon: 'bolt' },
  { title: t('home.sections.capabilities.items.structured.title'), description: t('home.sections.capabilities.items.structured.description'), icon: 'terminal' },
  { title: t('home.sections.capabilities.items.tracking.title'), description: t('home.sections.capabilities.items.tracking.description'), icon: 'chart' },
])

const useCaseItems = computed(() => ['experiments', 'business', 'agents', 'rag'].map((key) => ({
  title: t(`home.sections.useCases.items.${key}.title`),
  description: t(`home.sections.useCases.items.${key}.description`),
})))

const faqItems = computed(() => ['official', 'sdk', 'models', 'production'].map((key) => ({
  question: t(`home.sections.faq.items.${key}.question`, { site: siteName.value }),
  answer: t(`home.sections.faq.items.${key}.answer`, { site: siteName.value }),
})))

function toggleTheme(): void {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function initTheme(): void {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    isDark.value = true
    document.documentElement.classList.add('dark')
  }
}

onMounted(() => {
  initTheme()
  authStore.checkAuth()
  if (!appStore.publicSettingsLoaded) void appStore.fetchPublicSettings()
})
</script>

<style scoped>
.home-compact {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  color: var(--ui-text);
  background: var(--ui-bg);
}

.home-compact__main {
  display: grid;
  min-width: 0;
  flex: 1;
  place-items: center;
  padding: 72px 20px;
}

.home-compact__content {
  display: grid;
  width: min(100%, 640px);
  justify-items: center;
  gap: 16px;
  text-align: center;
}

.home-compact__logo {
  width: auto;
  max-width: min(280px, 80vw);
  height: 64px;
  object-fit: contain;
}

.home-compact__content h1 {
  margin: 0;
  color: var(--ui-text);
  font-size: 36px;
  font-weight: 600;
  line-height: 44px;
  overflow-wrap: anywhere;
}

.home-compact__content p {
  max-width: 580px;
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 16px;
  line-height: 26px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.home-compact__action {
  display: inline-flex;
  min-height: var(--ui-control-default);
  align-items: center;
  justify-content: center;
  margin-top: 16px;
  padding: 0 20px;
  border: 1px solid var(--ui-text);
  border-radius: var(--ui-radius);
  color: var(--ui-inverse);
  background: var(--ui-text);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: opacity var(--ui-motion-fast), transform var(--ui-motion-fast);
}

.home-compact__action:hover {
  opacity: .84;
  transform: translateY(-1px);
}

.home-compact__footer {
  padding: 18px 20px;
  border-top: 1px solid var(--ui-border-soft);
  color: var(--ui-text-soft);
  font-size: 12px;
  text-align: center;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .home-compact__main { padding: 56px 16px; }
  .home-compact__content h1 { font-size: 30px; line-height: 38px; }
  .home-compact__content p { font-size: 14px; line-height: 23px; }
}

@media (prefers-reduced-motion: reduce) {
  .home-compact__action { transition: none; }
}

.qiu-home {
  --qiu-ink: #241e16;
  --qiu-muted: #6b604e;
  --qiu-paper: #fff8e7;
  --qiu-surface: #fffdf3;
  --qiu-yellow: #ffd85a;
  --qiu-pink: #ff9fc7;
  --qiu-blue: #8fd3ff;
  --qiu-green: #9ee6a8;
  --qiu-red: #d94a38;
  --qiu-shadow: rgba(36, 30, 22, 0.18);
  --qiu-rule: #f0ebe5;
  --qiu-muted-strong: #666;
  --qiu-index: #999;
  --qiu-action-border: #000;
  --qiu-hero-bg: #fcfaf8;
  --qiu-hero-text: #000;
  --qiu-hero-font: "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  min-height: 100vh;
  color: var(--qiu-ink);
  background: var(--qiu-hero-bg);
  font-family: var(--qiu-hero-font);
  isolation: isolate;
}

.qiu-home-dark {
  --qiu-ink: #f8edcf;
  --qiu-muted: #b9aa8d;
  --qiu-paper: #191713;
  --qiu-surface: #24211b;
  --qiu-yellow: #cda832;
  --qiu-pink: #c56c96;
  --qiu-blue: #4d9bc9;
  --qiu-green: #67ad72;
  --qiu-red: #ef7b68;
  --qiu-shadow: rgba(0, 0, 0, 0.42);
  --qiu-rule: #333;
  --qiu-muted-strong: #b8b8b8;
  --qiu-index: #9b9b9b;
  --qiu-action-border: #fff;
  --qiu-hero-bg: #0a0a0a;
  --qiu-hero-text: #fff;
}

@media (prefers-reduced-motion: reduce) {
  .qiu-home *,
  .qiu-home *::before,
  .qiu-home *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }

  .qiu-hero-earth:hover .qiu-hero-earth-inner {
    transform: none;
  }
}

.qiu-main {
  position: relative;
  overflow: hidden;
}

.qiu-main::before {
  display: none;
}

.qiu-home-inner {
  max-width: 1275px;
  margin: 0 auto;
  overflow-x: clip;
  color: var(--qiu-hero-text);
  background: var(--qiu-hero-bg);
  font-family: var(--qiu-hero-font);
}

.qiu-hero {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  display: flex;
  width: calc(100% - 56px);
  max-width: 1260px;
  height: 100vh;
  margin: -48px auto 0;
  padding: 0;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  overflow: visible;
  text-align: left;
  pointer-events: none;
}

.qiu-hero-content {
  position: relative;
  z-index: 2;
  display: flex;
  width: auto;
  max-width: none;
  padding: 0;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  pointer-events: auto;
}

.qiu-hero-title {
  max-width: 660px;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--qiu-hero-text);
  font-family: var(--qiu-hero-font);
  font-size: 120px;
  font-style: normal;
  font-weight: 400;
  line-height: 120px;
  letter-spacing: 0;
}

.qiu-hero-char {
  display: inline-block;
  opacity: 0;
  transform: translateY(40px);
  animation: qiu-hero-char-reveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.qiu-hero-subtitle {
  display: inline-block;
  max-width: min(100%, 760px);
  margin: 0;
  overflow: visible;
  color: var(--qiu-hero-text);
  font-family: var(--qiu-hero-font);
  font-size: 48px;
  font-style: normal;
  font-weight: 400;
  line-height: 60px;
  letter-spacing: 0;
  white-space: normal;
  opacity: 0;
  animation: qiu-hero-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards;
}

.qiu-hero-buttons {
  display: flex;
  margin: 0;
  flex-wrap: wrap;
  gap: 16px;
  opacity: 0;
  animation: qiu-hero-fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards;
}

.qiu-hero-button {
  box-sizing: border-box;
  display: inline-flex;
  width: 160px;
  height: 36px;
  padding: 5px 16px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--qiu-hero-text);
  border-radius: 6px;
  font-family: var(--qiu-hero-font);
  font-size: 14px;
  font-weight: 400;
  line-height: 22px;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
}

.qiu-hero-button-primary {
  color: var(--qiu-hero-bg);
  background: var(--qiu-hero-text);
}

.qiu-hero-button-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.qiu-hero-button-outline {
  color: var(--qiu-hero-text);
  background: transparent;
}

.qiu-hero-button-outline:hover {
  background: rgba(0, 0, 0, 0.04);
  transform: translateY(-1px);
}

.qiu-hero-button-arrow {
  display: inline-flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  line-height: 16px;
}

.qiu-hero-earth {
  position: absolute;
  top: 50%;
  right: 0;
  z-index: 1;
  width: 600px;
  height: 428px;
  transform: translateY(-50%);
  pointer-events: auto;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.qiu-hero-earth-inner {
  width: 100%;
  height: 100%;
  pointer-events: none;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.qiu-hero-earth:hover .qiu-hero-earth-inner {
  transform: translateY(-60px);
}

.qiu-wrap {
  box-sizing: border-box;
  width: calc(100% - 56px);
  max-width: 1260px;
  margin: 0 auto;
  padding: 72px 0 56px;
}

@keyframes qiu-hero-char-reveal {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes qiu-hero-fade-in {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}


.qiu-updates {
  position: relative;
  width: 100%;
  padding: 0 0 72px;
}

.qiu-section-header {
  margin-bottom: 48px;
}

.qiu-section-header h2 {
  margin: 0;
  color: var(--qiu-hero-text);
  font-size: 40px;
  font-weight: 400;
  line-height: normal;
  letter-spacing: 0;
}

.qiu-updates-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
}

.qiu-update-card {
  display: flex;
  min-width: 0;
  min-height: 224px;
  padding: 20px;
  flex-direction: column;
  align-items: flex-start;
  gap: 24px;
  border: 1px solid #f0ebe5;
  border-radius: 6px;
  background: linear-gradient(#fbfbfb, #fff);
  transition: transform 0.3s, box-shadow 0.3s;
}

.qiu-update-card:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
}

.qiu-update-content {
  display: flex;
  width: 100%;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

.qiu-update-content h3 {
  margin: 0;
  color: var(--qiu-hero-text);
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  letter-spacing: 0;
}

.qiu-update-content p {
  margin: 0;
  color: #666;
  font-size: 14px;
  line-height: 22px;
}

.qiu-update-link {
  display: flex;
  width: 100%;
  height: 44px;
  margin-top: auto;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 6px;
  color: var(--qiu-hero-bg);
  background: var(--qiu-hero-text);
  font-size: 14px;
  text-decoration: none;
  transition: box-shadow 0.2s;
}

.qiu-update-link:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.qiu-home-dark .qiu-update-card {
  border-color: #333;
  background: linear-gradient(#1a1a1a, #111);
}

.qiu-home-dark .qiu-update-content p {
  color: #999;
}

.qiu-section {
  padding: 52px 0;
  border-bottom: 3px dashed color-mix(in srgb, var(--qiu-ink) 38%, transparent);
  scroll-margin-top: 80px;
}

.qiu-section-clean {
  border-bottom: 0;
}

.qiu-section-clean .qiu-heading {
  margin-bottom: 48px;
}

.qiu-section-clean .qiu-heading h3 {
  color: var(--qiu-hero-text);
  font-family: var(--qiu-hero-font);
  font-size: 40px;
  font-weight: 400;
  line-height: normal;
  text-shadow: none;
}

.qiu-section-clean article,
.qiu-section-clean .qiu-feature-lead,
.qiu-section-clean .qiu-feature-list article,
.qiu-section-clean .qiu-prompt,
.qiu-section-clean .qiu-model-item,
.qiu-section-clean .qiu-code,
.qiu-section-clean .qiu-endpoints {
  border-color: color-mix(in srgb, var(--qiu-ink) 12%, transparent);
  border-radius: 6px;
  background: var(--qiu-surface);
  box-shadow: none;
  transform: none;
}

.qiu-section-clean p,
.qiu-section-clean .qiu-intro {
  color: var(--qiu-muted);
  font-family: var(--qiu-hero-font);
}

.qiu-section-clean .qiu-feature-lead h4,
.qiu-section-clean .qiu-usecase-lead {
  text-shadow: none;
}

.qiu-section-clean .qiu-feature-lead,
.qiu-section-clean .qiu-feature-list article,
.qiu-section-clean .qiu-prompt,
.qiu-section-clean .qiu-code,
.qiu-section-clean .qiu-endpoints,
.qiu-section-clean .qiu-ribbon article {
  border: 1px solid color-mix(in srgb, var(--qiu-ink) 12%, transparent);
  color: var(--qiu-hero-text);
  background: var(--qiu-surface);
  box-shadow: none;
}

.qiu-section-clean .qiu-feature-lead > svg,
.qiu-section-clean .qiu-prompt b,
.qiu-section-clean .qiu-method,
.qiu-section-clean .qiu-text-link {
  color: var(--qiu-hero-text);
}

.qiu-section-clean .qiu-dropcap::first-letter {
  float: none;
  margin: 0;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
  font-weight: inherit;
  text-shadow: none;
}

.qiu-section-clean .qiu-timeline::before {
  border-left: 1px solid var(--qiu-rule);
}

.qiu-section-clean .qiu-timeline > li > span {
  border: 1px solid var(--qiu-action-border);
  color: var(--qiu-hero-bg);
  background: var(--qiu-action-border);
  box-shadow: none;
}

.qiu-section-clean .qiu-usecase-list p {
  border-color: var(--qiu-rule);
}

.qiu-home-dark .qiu-section-clean .qiu-feature-lead,
.qiu-home-dark .qiu-section-clean .qiu-feature-list article,
.qiu-home-dark .qiu-section-clean .qiu-prompt,
.qiu-home-dark .qiu-section-clean .qiu-code,
.qiu-home-dark .qiu-section-clean .qiu-endpoints,
.qiu-home-dark .qiu-section-clean .qiu-ribbon article,
.qiu-home-dark .qiu-model-item {
  border-color: #333;
  background: var(--qiu-surface);
}

.qiu-home-dark .qiu-pricing-list li,
.qiu-home-dark .qiu-faq-list,
.qiu-home-dark .qiu-faq-list details {
  border-color: #333;
}

.qiu-home-dark .qiu-pricing-intro p,
.qiu-home-dark .qiu-pricing-list p,
.qiu-home-dark .qiu-faq-intro p,
.qiu-home-dark .qiu-faq-list details > p {
  color: #999;
}

.qiu-home-dark .qiu-pricing-action {
  border-color: #fff;
  color: #fff;
}

.qiu-home-dark .qiu-pricing-action:hover {
  background: rgba(255, 255, 255, 0.08);
}

.qiu-heading {
  margin-bottom: 24px;
}

.qiu-heading h3 {
  margin: 0;
  font-size: 42px;
  line-height: 1;
  font-weight: 900;
  text-shadow: 3px 3px 0 color-mix(in srgb, var(--qiu-blue) 74%, transparent);
}

.qiu-intro {
  max-width: 830px;
  margin: -8px 0 24px;
  color: var(--qiu-muted);
  font-size: 15px;
  line-height: 1.72;
}

.qiu-dropcap::first-letter {
  float: left;
  margin: 0.04em 0.12em 0 0;
  color: var(--qiu-red);
  font-size: 4.5em;
  line-height: 0.72;
  font-weight: 900;
  text-shadow: 2px 2px 0 var(--qiu-yellow);
}

.qiu-advantage-layout {
  display: grid;
  grid-template-columns: 1.12fr 0.88fr;
  gap: 18px;
}

.qiu-feature-lead,
.qiu-feature-list article,
.qiu-prompt,
.qiu-model-item {
  border: 3px solid var(--qiu-ink);
  border-radius: 4px;
  box-shadow: 6px 6px 0 var(--qiu-shadow);
}

.qiu-feature-lead {
  min-height: 286px;
  padding: 22px;
  background: color-mix(in srgb, var(--qiu-yellow) 34%, var(--qiu-surface));
}

.qiu-feature-lead > svg { color: var(--qiu-red); }

.qiu-feature-lead h4 {
  margin: 44px 0 12px;
  font-size: 34px;
  line-height: 1.05;
}

.qiu-feature-lead p,
.qiu-feature-list p,
.qiu-model-item p,
.qiu-timeline p,
.qiu-usecase-list,
.qiu-faq-list p {
  color: var(--qiu-muted);
  font-size: 14px;
  line-height: 1.62;
}

.qiu-feature-list {
  display: grid;
  gap: 13px;
}

.qiu-feature-list article {
  display: flex;
  padding: 16px;
  align-items: flex-start;
  gap: 13px;
  background: var(--qiu-surface);
}

.qiu-feature-list article:nth-child(1) { background: color-mix(in srgb, var(--qiu-blue) 22%, var(--qiu-surface)); }
.qiu-feature-list article:nth-child(2) { background: color-mix(in srgb, var(--qiu-pink) 20%, var(--qiu-surface)); }
.qiu-feature-list article:nth-child(3) { background: color-mix(in srgb, var(--qiu-green) 22%, var(--qiu-surface)); }
.qiu-feature-list strong { display: block; margin-bottom: 5px; font-size: 19px; }
.qiu-feature-list p { margin: 0; }

.qiu-prompts,
.qiu-model-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.qiu-model-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
}

.qiu-prompt {
  min-height: 145px;
  padding: 16px;
  transform: rotate(-0.7deg);
  background: var(--qiu-surface);
}

.qiu-prompt:nth-child(2n) { transform: rotate(0.7deg); background: color-mix(in srgb, var(--qiu-pink) 18%, var(--qiu-surface)); }
.qiu-prompt:nth-child(3n) { transform: rotate(-0.3deg); background: color-mix(in srgb, var(--qiu-blue) 18%, var(--qiu-surface)); }
.qiu-prompt:nth-child(4n) { transform: rotate(0.8deg); background: color-mix(in srgb, var(--qiu-green) 18%, var(--qiu-surface)); }
.qiu-prompt b { display: block; margin-bottom: 10px; color: var(--qiu-red); font-family: Arial, sans-serif; font-size: 10px; text-transform: uppercase; }
.qiu-prompt strong { display: block; font-size: 19px; line-height: 1.34; }

.qiu-model-item {
  display: flex;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid #f0ebe5;
  border-radius: 6px;
  background: #fff;
  transition: transform 0.3s, box-shadow 0.3s;
}

.qiu-model-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
}

.qiu-model-cover {
  width: 100%;
  height: 200px;
  flex: 0 0 auto;
  overflow: hidden;
}

.qiu-model-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }

.qiu-model-body {
  display: flex;
  min-height: 260px;
  padding: 20px;
  flex: 1;
  flex-direction: column;
}

.qiu-model-item b { display: block; color: #999; font-family: var(--qiu-hero-font); font-size: 14px; font-weight: 400; }
.qiu-model-item strong { display: block; margin: 8px 0; color: var(--qiu-hero-text); font-size: 16px; font-weight: 600; line-height: 24px; }
.qiu-model-item p { margin: 0 0 24px; white-space: pre-line; }

.qiu-model-meta {
  display: flex;
  margin-top: auto;
  padding-top: 16px;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #f0ebe5;
  color: #999;
  font-size: 14px;
}

.qiu-text-link {
  display: inline-flex;
  margin-top: 22px;
  align-items: center;
  gap: 7px;
  color: var(--qiu-red);
  font-weight: 900;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}

.qiu-pricing {
  display: grid;
  grid-template-columns: minmax(300px, 0.82fr) minmax(0, 1.18fr);
  gap: 72px;
  align-items: start;
}

.qiu-pricing-intro {
  position: sticky;
  top: 86px;
}

.qiu-pricing-intro h3 {
  margin: 0 0 20px;
  color: var(--qiu-hero-text);
  font-size: 40px;
  font-weight: 400;
  line-height: normal;
}

.qiu-pricing-intro p {
  max-width: 460px;
  margin: 0;
  color: var(--qiu-muted-strong);
  font-size: 16px;
  line-height: 1.75;
}

.qiu-pricing-action {
  display: inline-flex;
  min-height: 40px;
  margin-top: 28px;
  padding: 8px 18px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--qiu-action-border);
  border-radius: 6px;
  color: var(--qiu-action-border);
  font-size: 14px;
  text-decoration: none;
}

.qiu-pricing-action:hover {
  background: color-mix(in srgb, var(--qiu-action-border) 4%, transparent);
}

.qiu-pricing-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.qiu-pricing-list li {
  display: grid;
  min-height: 132px;
  padding: 26px 0;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 20px;
  border-top: 1px solid var(--qiu-rule);
}

.qiu-pricing-list li:last-child {
  border-bottom: 1px solid var(--qiu-rule);
}

.qiu-pricing-index {
  color: var(--qiu-index);
  font: 13px/22px Consolas, monospace;
}

.qiu-pricing-list strong {
  display: block;
  margin-bottom: 8px;
  color: var(--qiu-hero-text);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.qiu-pricing-list p {
  max-width: 620px;
  margin: 0;
  color: var(--qiu-muted-strong);
  font-size: 14px;
  line-height: 1.72;
}

.qiu-integration-layout,
.qiu-usecase-layout {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  align-items: start;
  gap: 32px;
}

.qiu-code {
  margin: 18px 0 0;
  padding: 16px;
  overflow-x: auto;
  border: 3px solid var(--qiu-ink);
  border-radius: 4px;
  background: color-mix(in srgb, var(--qiu-green) 17%, var(--qiu-surface));
  box-shadow: 5px 5px 0 var(--qiu-shadow);
  font: 13px/1.7 Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.qiu-endpoints { padding-left: 22px; border-left: 4px solid var(--qiu-ink); }
.qiu-endpoint { display: grid; padding: 13px 0; grid-template-columns: 70px minmax(0, 1fr); gap: 12px; border-bottom: 2px dashed color-mix(in srgb, var(--qiu-ink) 32%, transparent); }
.qiu-method { color: var(--qiu-red); font-family: Arial, sans-serif; font-size: 11px; font-weight: 900; }
.qiu-endpoint code { overflow-wrap: anywhere; font: 12px/1.5 Consolas, monospace; }
.qiu-endpoints > p { margin: 14px 0 0; color: var(--qiu-muted); font-size: 12px; line-height: 1.6; }

.qiu-timeline { position: relative; display: grid; max-width: 820px; margin: 0; padding: 0; gap: 19px; list-style: none; }
.qiu-timeline::before { position: absolute; top: 12px; bottom: 12px; left: 21px; border-left: 4px solid var(--qiu-ink); content: ""; }
.qiu-timeline li { position: relative; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 14px; }
.qiu-timeline li > span { z-index: 1; display: grid; width: 42px; height: 42px; place-items: center; border: 3px solid var(--qiu-ink); border-radius: 50%; background: var(--qiu-yellow); box-shadow: 4px 4px 0 var(--qiu-shadow); font: 900 17px Arial, sans-serif; }
.qiu-timeline h4 { margin: 0 0 5px; font-size: 20px; }
.qiu-timeline p { margin: 0; }

.qiu-capability-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  gap: 72px;
  align-items: start;
}

.qiu-capability-intro {
  position: sticky;
  top: 86px;
}

.qiu-capability-intro h3 {
  margin: 0 0 20px;
  color: var(--qiu-hero-text);
  font-size: 40px;
  font-weight: 400;
  line-height: normal;
}

.qiu-capability-intro p {
  max-width: 460px;
  margin: 0;
  color: var(--qiu-muted-strong);
  font-size: 16px;
  line-height: 1.75;
}

.qiu-capability-action {
  display: inline-flex;
  height: 40px;
  margin-top: 28px;
  padding: 8px 18px;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--qiu-action-border);
  border-radius: 6px;
  color: var(--qiu-action-border);
  font-size: 14px;
  text-decoration: none;
}

.qiu-capability-action:hover {
  background: color-mix(in srgb, var(--qiu-action-border) 4%, transparent);
}

.qiu-capability-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.qiu-capability-list li {
  display: grid;
  min-height: 124px;
  padding: 24px 0;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 20px;
  border-top: 1px solid var(--qiu-rule);
}

.qiu-capability-list li:last-child {
  border-bottom: 1px solid var(--qiu-rule);
}

.qiu-capability-index {
  color: var(--qiu-index);
  font: 13px/22px Consolas, monospace;
}

.qiu-capability-list strong {
  display: block;
  margin-bottom: 8px;
  color: var(--qiu-hero-text);
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.qiu-capability-list p {
  max-width: 620px;
  margin: 0;
  color: var(--qiu-muted-strong);
  font-size: 14px;
  line-height: 1.72;
}

.qiu-usecase-layout { grid-template-columns: 1.1fr 0.9fr; }
.qiu-usecase-lead { margin: 0; font-size: 42px; line-height: 1.02; font-weight: 900; text-shadow: 3px 3px 0 var(--qiu-pink); }
.qiu-usecase-list { display: grid; }
.qiu-usecase-list p { margin: 0; padding: 0 0 12px; border-bottom: 2px dashed color-mix(in srgb, var(--qiu-ink) 32%, transparent); }
.qiu-usecase-list p + p { padding-top: 12px; }
.qiu-usecase-list b { margin-right: 4px; color: var(--qiu-ink); font-size: 17px; }

.qiu-faq-section {
  display: grid;
  grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.28fr);
  gap: 84px;
  align-items: start;
}

.qiu-faq-intro > span {
  display: block;
  margin-bottom: 16px;
  color: var(--qiu-index);
  font-size: 12px;
  line-height: 20px;
  text-transform: uppercase;
}

.qiu-faq-intro h3 {
  margin: 0 0 20px;
  color: var(--qiu-hero-text);
  font-size: 40px;
  font-weight: 400;
  line-height: normal;
}

.qiu-faq-intro p {
  max-width: 420px;
  margin: 0;
  color: var(--qiu-muted-strong);
  font-size: 15px;
  line-height: 1.75;
}

.qiu-faq-list {
  border-top: 1px solid var(--qiu-rule);
}

.qiu-faq-list details {
  border-bottom: 1px solid var(--qiu-rule);
}

.qiu-faq-list summary {
  display: grid;
  min-height: 76px;
  padding: 22px 0;
  grid-template-columns: minmax(0, 1fr) 24px;
  align-items: center;
  gap: 24px;
  color: var(--qiu-hero-text);
  font-size: 18px;
  font-weight: 500;
  line-height: 26px;
  list-style: none;
  cursor: pointer;
}

.qiu-faq-list summary::-webkit-details-marker { display: none; }

.qiu-faq-toggle {
  position: relative;
  width: 18px;
  height: 18px;
}

.qiu-faq-toggle::before,
.qiu-faq-toggle::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 1px;
  background: currentColor;
  content: "";
  transform: translate(-50%, -50%);
  transition: transform 0.2s;
}

.qiu-faq-toggle::after { transform: translate(-50%, -50%) rotate(90deg); }
.qiu-faq-list details[open] .qiu-faq-toggle::after { transform: translate(-50%, -50%) rotate(0); }

.qiu-faq-list details > p {
  max-width: 720px;
  margin: -4px 48px 0 0;
  padding: 0 0 24px;
  color: #666;
  font-size: 14px;
  line-height: 1.75;
}
.qiu-footer {
  display: flex;
  padding-top: 21px;
  justify-content: flex-start;
  gap: 18px;
  color: var(--qiu-muted);
  font-family: Arial, sans-serif;
  font-size: 11px;
  font-weight: 400;
}

@media (max-width: 980px) {
  .qiu-wrap { padding: 72px 0 48px; }
  .qiu-advantage-layout,
  .qiu-integration-layout,
  .qiu-usecase-layout,
  .qiu-capability-layout,
  .qiu-pricing,
  .qiu-faq-section { grid-template-columns: 1fr; }
  .qiu-capability-layout,
  .qiu-pricing,
  .qiu-faq-section { gap: 32px; }
  .qiu-capability-intro,
  .qiu-pricing-intro { position: static; }
  .qiu-prompts,
  .qiu-model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 1279px) {
  .qiu-updates-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .qiu-model-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1440px) {
  .qiu-hero {
    width: 100%;
    padding: 0;
  }
}

@media (min-width: 901px) and (max-width: 1280px) {
  .qiu-hero-title {
    max-width: 560px;
    font-size: 96px;
    line-height: 100px;
  }

  .qiu-hero-subtitle {
    font-size: 36px;
    line-height: 48px;
  }

  .qiu-hero-earth {
    width: 480px;
    height: 342px;
  }
}

@media (max-width: 900px) {
  .qiu-hero {
    width: calc(100% - 56px);
    height: auto;
    min-height: 0;
    margin-top: 0;
    padding-top: 100px;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .qiu-hero-content {
    gap: 8px;
  }

  .qiu-hero-title {
    max-width: 100%;
    font-size: 24px;
    font-weight: 500;
    line-height: 32px;
  }

  .qiu-hero-subtitle {
    max-width: 100%;
    font-size: 18px;
    line-height: 28px;
    white-space: normal;
  }

  .qiu-hero-buttons {
    gap: 8px;
  }

  .qiu-hero-button {
    width: auto;
    height: 32px;
    padding: 5px 12px;
    font-size: 12px;
    line-height: 22px;
  }

  .qiu-hero-button-arrow {
    display: none;
  }

  .qiu-hero-earth {
    position: static;
    width: 100%;
    height: auto;
    aspect-ratio: 1200 / 855;
    order: 1;
    margin-top: 24px;
    transform: none;
  }

  .qiu-hero-earth:hover {
    transform: translateY(-60px);
  }
}

@media (max-width: 640px) {
  .qiu-wrap { width: calc(100% - 28px); padding: 32px 0 42px; }
  .qiu-updates { padding-bottom: 16px; }
  .qiu-section-header { margin-bottom: 12px; }
  .qiu-section-header h2 { font-size: 20px; font-weight: 500; }
  .qiu-updates-grid { grid-template-columns: 1fr; }
  .qiu-update-card { min-height: 0; }
  .qiu-update-content h3 { font-size: 20px; font-weight: 600; }
  .qiu-section { padding: 42px 0; }
  .qiu-heading h3 { font-size: 32px; }
  .qiu-feature-lead { min-height: 0; }
  .qiu-feature-lead h4 { margin-top: 30px; font-size: 28px; }
  .qiu-prompts,
  .qiu-model-grid { grid-template-columns: 1fr; }
  .qiu-prompt { min-height: 0; }
  .qiu-pricing-intro h3,
  .qiu-faq-intro h3 { font-size: 32px; }
  .qiu-pricing-list li { grid-template-columns: 42px minmax(0, 1fr); min-height: 0; padding: 20px 0; gap: 12px; }
  .qiu-faq-list summary { min-height: 68px; padding: 18px 0; gap: 16px; font-size: 16px; line-height: 24px; }
  .qiu-faq-list details > p { margin-right: 36px; padding-bottom: 20px; }
  .qiu-endpoints { padding-left: 14px; }
  .qiu-endpoint { grid-template-columns: 1fr; gap: 4px; }
  .qiu-capability-intro h3 { font-size: 32px; }
  .qiu-capability-list li { grid-template-columns: 42px minmax(0, 1fr); padding: 20px 0; gap: 12px; }
  .qiu-usecase-lead { font-size: 31px; }
  .qiu-footer { flex-direction: column; }
}

@media (max-width: 375px) {
  .qiu-hero-subtitle {
    font-size: 16px;
    line-height: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .qiu-home { scroll-behavior: auto; }
  .qiu-hero-char,
  .qiu-hero-subtitle,
  .qiu-hero-buttons {
    opacity: 1;
    transform: none;
    animation: none;
  }

  .qiu-hero-button,
  .qiu-hero-earth,
  .qiu-hero-earth-inner,
  .qiu-prompt {
    transform: none;
    transition: none;
  }
}
</style>
