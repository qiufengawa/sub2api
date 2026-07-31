<template>
  <!-- Advanced custom home content keeps its existing full-page contract. -->
  <div v-if="homeContent" class="min-h-screen">
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <!-- SECURITY: homeContent is an administrator-controlled setting. -->
    <div v-else v-html="homeContent"></div>
  </div>

  <div v-else id="home-top" class="qiu-home" :class="{ 'qiu-home-dark': isDark }">
    <HomeSiteHeader
      :site-name="siteName"
      :site-logo="siteLogo"
      :doc-url="docUrl"
      :is-dark="isDark"
      :is-authenticated="isAuthenticated"
      :dashboard-path="dashboardPath"
      :model-plaza-enabled="modelPlazaEnabled"
      @toggle-theme="toggleTheme"
    />

    <main class="qiu-main">
      <div class="qiu-wrap">
        <section class="qiu-hero" aria-labelledby="home-hero-title">
          <div class="qiu-hero-copy">
            <h1 id="home-hero-title">{{ siteName }}</h1>
            <h2>{{ siteSubtitle }}</h2>
            <p>{{ t('home.heroDescription') }}</p>
            <div class="qiu-actions">
              <RouterLink class="qiu-btn qiu-btn-primary" :to="primaryEntryPath">
                {{ isAuthenticated ? t('home.goToDashboard') : t('home.getStarted') }}
                <Icon name="arrowRight" size="sm" />
              </RouterLink>
              <RouterLink v-if="modelPlazaEnabled" class="qiu-btn qiu-btn-blue" to="/model-plaza">
                {{ t('home.viewModelsAndPricing') }}
              </RouterLink>
              <a v-if="docUrl" class="qiu-btn qiu-btn-green" :href="docUrl" target="_blank" rel="noopener noreferrer">
                {{ t('home.docs') }}
                <Icon name="externalLink" size="xs" />
              </a>
            </div>
          </div>

          <div class="qiu-board" role="img" :aria-label="t('home.gatewayPreviewLabel', { site: siteName })">
            <div class="qiu-board-brand">
              <span class="qiu-board-logo">
                <img :src="siteLogo || '/logo.svg'" alt="" />
              </span>
              <strong>{{ siteName }}</strong>
              <code>{{ apiBaseUrl }}</code>
            </div>
            <div class="qiu-provider-doodles" aria-hidden="true">
              <span class="qiu-provider-openai"><PlatformIcon platform="openai" size="lg" /></span>
              <span class="qiu-provider-anthropic"><PlatformIcon platform="anthropic" size="lg" /></span>
              <span class="qiu-provider-gemini"><PlatformIcon platform="gemini" size="lg" /></span>
              <span class="qiu-provider-grok"><PlatformIcon platform="grok" size="lg" /></span>
            </div>
          </div>
        </section>

        <div class="qiu-strip" :aria-label="t('home.coreCapabilities')">
          <span v-for="item in coreCapabilities" :key="item">{{ item }}</span>
        </div>

        <section id="advantages" class="qiu-section" aria-labelledby="advantages-title">
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

        <section class="qiu-section" aria-labelledby="prompts-title">
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

        <section id="model-coverage" class="qiu-section" aria-labelledby="models-title">
          <div class="qiu-heading">
            <h3 id="models-title">{{ t('home.sections.models.title') }}</h3>
          </div>
          <p class="qiu-intro">{{ t('home.sections.models.description') }}</p>
          <div class="qiu-model-grid">
            <article v-for="provider in providerItems" :key="provider.name" class="qiu-model-item">
              <span class="qiu-model-icon" :class="provider.colorClass">
                <PlatformIcon :platform="provider.platform" size="lg" />
              </span>
              <div>
                <b>{{ provider.name }}</b>
                <strong>{{ provider.family }}</strong>
                <p>{{ provider.description }}</p>
              </div>
            </article>
          </div>
          <RouterLink v-if="modelPlazaEnabled" to="/model-plaza" class="qiu-text-link">
            {{ t('home.sections.models.openPlaza') }}
            <Icon name="arrowRight" size="sm" />
          </RouterLink>
        </section>

        <section class="qiu-section" aria-labelledby="pricing-title">
          <div class="qiu-heading">
            <h3 id="pricing-title">{{ t('home.sections.pricing.title') }}</h3>
          </div>
          <div class="qiu-price-line">
            <article v-for="item in pricingItems" :key="item.title">
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </article>
          </div>
        </section>

        <section id="integration" class="qiu-section" aria-labelledby="integration-title">
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

        <section class="qiu-section" aria-labelledby="launch-title">
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

        <section class="qiu-section" aria-labelledby="capabilities-title">
          <div class="qiu-heading">
            <h3 id="capabilities-title">{{ t('home.sections.capabilities.title') }}</h3>
          </div>
          <div class="qiu-ribbon">
            <article v-for="capability in capabilityItems" :key="capability.title">
              <Icon :name="capability.icon" size="md" />
              <strong>{{ capability.title }}</strong>
              <p>{{ capability.description }}</p>
            </article>
          </div>
        </section>

        <section class="qiu-section" aria-labelledby="use-cases-title">
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

        <section id="faq" class="qiu-section" aria-labelledby="faq-title">
          <div class="qiu-heading">
            <h3 id="faq-title">{{ t('home.sections.faq.title') }}</h3>
          </div>
          <div class="qiu-faq">
            <article v-for="item in faqItems" :key="item.question">
              <strong>{{ item.question }}</strong>
              <p>{{ item.answer }}</p>
            </article>
          </div>
        </section>

        <footer class="qiu-footer">
          <span>&copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}</span>
          <span>
            {{ t('home.footer.poweredBy') }}
            <a :href="githubUrl" target="_blank" rel="noopener noreferrer">Sub2API</a>
          </span>
        </footer>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import HomeSiteHeader from '@/components/home/HomeSiteHeader.vue'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
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
}

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()

const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const siteSubtitle = computed(() => appStore.cachedPublicSettings?.site_subtitle || t('home.heroSubtitle'))
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')
const apiBaseUrl = computed(() => {
  const value = String(appStore.cachedPublicSettings?.api_base_url || '').trim().replace(/\/+$/, '')
  return value || '/v1'
})
const modelPlazaEnabled = computed(() => appStore.cachedPublicSettings?.model_plaza_enabled === true)
const registrationEnabled = computed(() => appStore.cachedPublicSettings?.registration_enabled !== false)

const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

const isDark = ref(document.documentElement.classList.contains('dark'))
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => isAdmin.value ? '/admin/dashboard' : '/dashboard')
const primaryEntryPath = computed(() => {
  if (isAuthenticated.value) return dashboardPath.value
  return registrationEnabled.value ? '/register' : '/login'
})
const currentYear = computed(() => new Date().getFullYear())
const githubUrl = 'https://github.com/qiufengawa/sub2api'

const coreCapabilities = computed(() => [
  t('home.core.unifiedBaseUrl'),
  t('home.core.multiModelRelay'),
  t('home.core.pricingReference'),
  t('home.core.usageAnalytics'),
])

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
  { name: 'OpenAI', family: t('home.sections.models.items.openai.family'), description: t('home.sections.models.items.openai.description'), platform: 'openai', colorClass: 'qiu-model-openai' },
  { name: 'Anthropic', family: t('home.sections.models.items.anthropic.family'), description: t('home.sections.models.items.anthropic.description'), platform: 'anthropic', colorClass: 'qiu-model-anthropic' },
  { name: 'Google', family: t('home.sections.models.items.gemini.family'), description: t('home.sections.models.items.gemini.description'), platform: 'gemini', colorClass: 'qiu-model-gemini' },
  { name: 'xAI', family: t('home.sections.models.items.grok.family'), description: t('home.sections.models.items.grok.description'), platform: 'grok', colorClass: 'qiu-model-grok' },
  { name: 'DeepSeek', family: t('home.sections.models.items.deepseek.family'), description: t('home.sections.models.items.deepseek.description'), platform: 'composite', colorClass: 'qiu-model-deepseek' },
  { name: t('home.sections.models.items.more.name'), family: t('home.sections.models.items.more.family'), description: t('home.sections.models.items.more.description'), platform: 'composite', colorClass: 'qiu-model-more' },
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
  min-height: 100vh;
  color: var(--qiu-ink);
  background-color: var(--qiu-paper);
  background-image:
    linear-gradient(90deg, rgba(36, 30, 22, 0.055) 1px, transparent 1px),
    linear-gradient(0deg, rgba(36, 30, 22, 0.045) 1px, transparent 1px);
  background-size: 22px 22px;
  font-family: "Comic Sans MS", "Comic Neue", "Avenir Next Rounded", "PingFang SC", "Microsoft YaHei", sans-serif;
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
  background-image:
    linear-gradient(90deg, rgba(255, 248, 231, 0.045) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255, 248, 231, 0.035) 1px, transparent 1px);
}

.qiu-main {
  position: relative;
  overflow: hidden;
}

.qiu-main::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image:
    linear-gradient(-7deg, transparent 0 18px, color-mix(in srgb, var(--qiu-ink) 3.5%, transparent) 19px 20px);
  content: "";
  pointer-events: none;
}

.qiu-wrap {
  width: min(100%, 1180px);
  margin: 0 auto;
  padding: 24px 32px 56px;
}

.qiu-hero {
  display: grid;
  padding: 46px 0 54px;
  grid-template-columns: minmax(0, 1.06fr) minmax(380px, 0.94fr);
  align-items: center;
  gap: 46px;
}

.qiu-hero-copy {
  min-width: 0;
}

.qiu-hero h1,
.qiu-hero h2,
.qiu-heading h3,
.qiu-feature-lead h4,
.qiu-usecase-lead {
  overflow-wrap: anywhere;
}

.qiu-hero h1 {
  margin: 0;
  font-size: 88px;
  line-height: 0.9;
  font-weight: 900;
  text-shadow: 4px 4px 0 var(--qiu-blue);
}

.qiu-hero h2 {
  margin: 19px 0 0;
  font-size: 42px;
  line-height: 1.05;
  font-weight: 900;
}

.qiu-hero p {
  max-width: 650px;
  margin: 18px 0 0;
  color: var(--qiu-muted);
  font-size: 18px;
  line-height: 1.6;
}

.qiu-actions {
  display: flex;
  margin-top: 26px;
  flex-wrap: wrap;
  gap: 12px;
}

.qiu-btn {
  display: inline-flex;
  min-height: 44px;
  padding: 0 18px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 3px solid var(--qiu-ink);
  border-radius: 4px;
  color: var(--qiu-ink);
  background: var(--qiu-surface);
  box-shadow: 5px 5px 0 var(--qiu-shadow);
  font-family: Arial, sans-serif;
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
}

.qiu-btn-primary { background: var(--qiu-pink); transform: rotate(-1deg); }
.qiu-btn-blue { background: var(--qiu-blue); transform: rotate(1deg); }
.qiu-btn-green { background: var(--qiu-green); transform: rotate(-0.5deg); }

.qiu-btn:active {
  transform: translate(3px, 3px);
  box-shadow: 2px 2px 0 var(--qiu-shadow);
}

.qiu-board {
  position: relative;
  min-height: 430px;
  overflow: hidden;
  transform: rotate(1deg);
  border: 4px solid var(--qiu-ink);
  border-radius: 4px;
  background: var(--qiu-blue);
  box-shadow: 12px 14px 0 var(--qiu-shadow);
}

.qiu-board::before,
.qiu-board::after {
  position: absolute;
  width: 54%;
  height: 48%;
  border: 3px solid var(--qiu-ink);
  background: var(--qiu-pink);
  content: "";
}

.qiu-board::before { right: -14%; top: 23%; transform: rotate(-12deg); }
.qiu-board::after { left: -20%; bottom: -22%; background: var(--qiu-yellow); transform: rotate(9deg); }

.qiu-board-brand,
.qiu-provider-doodles {
  position: relative;
  z-index: 2;
}

.qiu-board-brand {
  display: flex;
  min-width: 0;
  padding: 48px 28px 0;
  flex-direction: column;
  align-items: flex-start;
}

.qiu-board-logo {
  display: grid;
  width: 58px;
  height: 58px;
  margin-bottom: 18px;
  place-items: center;
  overflow: hidden;
  border: 3px solid #241e16;
  border-radius: 4px;
  background: #fff8e7;
  box-shadow: 5px 5px 0 rgba(36, 30, 22, 0.2);
}

.qiu-board-logo img { width: 100%; height: 100%; object-fit: contain; }

.qiu-board-brand strong {
  max-width: 90%;
  overflow-wrap: anywhere;
  color: #fff8e7;
  font-size: 54px;
  line-height: 0.95;
  text-shadow: 3px 3px 0 #241e16;
}

.qiu-board-brand code {
  max-width: 80%;
  margin-top: 15px;
  overflow: hidden;
  color: #241e16;
  font-family: Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qiu-provider-doodles {
  position: absolute;
  right: 24px;
  bottom: 24px;
  display: grid;
  grid-template-columns: repeat(2, 52px);
  gap: 11px;
}

.qiu-provider-doodles span {
  display: grid;
  height: 52px;
  place-items: center;
  border: 3px solid #241e16;
  border-radius: 4px;
  color: #241e16;
  background: #fff8e7;
  box-shadow: 4px 4px 0 rgba(36, 30, 22, 0.18);
}

.qiu-provider-openai { transform: rotate(7deg); }
.qiu-provider-anthropic { transform: rotate(-5deg); background: var(--qiu-yellow) !important; }
.qiu-provider-gemini { transform: rotate(-8deg); background: var(--qiu-green) !important; }
.qiu-provider-grok { transform: rotate(4deg); background: var(--qiu-pink) !important; }

.qiu-strip {
  display: grid;
  overflow: hidden;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 3px solid var(--qiu-ink);
  border-radius: 4px;
  background: var(--qiu-surface);
  box-shadow: 8px 8px 0 var(--qiu-shadow);
}

.qiu-strip span {
  padding: 14px 10px;
  border-right: 3px solid var(--qiu-ink);
  font-family: Arial, sans-serif;
  font-size: 11px;
  font-weight: 900;
  text-align: center;
}

.qiu-strip span:last-child { border-right: 0; }

.qiu-section {
  padding: 52px 0;
  border-bottom: 3px dashed color-mix(in srgb, var(--qiu-ink) 38%, transparent);
  scroll-margin-top: 80px;
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
.qiu-price-line p,
.qiu-ribbon p,
.qiu-timeline p,
.qiu-usecase-list,
.qiu-faq p {
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
  padding: 17px;
  gap: 14px;
  background: var(--qiu-surface);
}

.qiu-model-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border: 2px solid var(--qiu-ink);
  border-radius: 4px;
  color: #241e16;
}

.qiu-model-openai { background: var(--qiu-green); }
.qiu-model-anthropic { background: var(--qiu-yellow); }
.qiu-model-gemini { background: var(--qiu-blue); }
.qiu-model-grok { background: var(--qiu-pink); }
.qiu-model-deepseek { background: color-mix(in srgb, var(--qiu-blue) 72%, var(--qiu-surface)); }
.qiu-model-more { background: var(--qiu-surface); }
.qiu-model-item b { display: block; color: var(--qiu-red); font-family: Arial, sans-serif; font-size: 10px; text-transform: uppercase; }
.qiu-model-item strong { display: block; margin: 5px 0; font-size: 20px; line-height: 1.1; }
.qiu-model-item p { margin: 0; }

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

.qiu-price-line {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}

.qiu-price-line article { padding-top: 13px; border-top: 4px solid var(--qiu-ink); }
.qiu-price-line strong { display: block; margin-bottom: 8px; font-size: 25px; line-height: 1.05; }
.qiu-price-line p { margin: 0; }

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

.qiu-ribbon { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 4px solid var(--qiu-ink); border-bottom: 4px solid var(--qiu-ink); background: color-mix(in srgb, var(--qiu-surface) 72%, transparent); box-shadow: 7px 7px 0 var(--qiu-shadow); }
.qiu-ribbon article { padding: 20px 17px; border-right: 3px solid var(--qiu-ink); }
.qiu-ribbon article:last-child { border-right: 0; }
.qiu-ribbon svg { margin-bottom: 12px; color: var(--qiu-red); }
.qiu-ribbon strong { display: block; margin-bottom: 8px; font-size: 20px; line-height: 1.1; }
.qiu-ribbon p { margin: 0; }

.qiu-usecase-layout { grid-template-columns: 1.1fr 0.9fr; }
.qiu-usecase-lead { margin: 0; font-size: 42px; line-height: 1.02; font-weight: 900; text-shadow: 3px 3px 0 var(--qiu-pink); }
.qiu-usecase-list { display: grid; }
.qiu-usecase-list p { margin: 0; padding: 0 0 12px; border-bottom: 2px dashed color-mix(in srgb, var(--qiu-ink) 32%, transparent); }
.qiu-usecase-list p + p { padding-top: 12px; }
.qiu-usecase-list b { margin-right: 4px; color: var(--qiu-ink); font-size: 17px; }

.qiu-faq { columns: 2 320px; column-gap: 34px; }
.qiu-faq article { break-inside: avoid; margin: 0 0 18px; padding-bottom: 16px; border-bottom: 2px dashed color-mix(in srgb, var(--qiu-ink) 34%, transparent); }
.qiu-faq strong { display: block; margin-bottom: 8px; font-size: 19px; }
.qiu-faq p { margin: 0; }
.qiu-footer {
  display: flex;
  padding-top: 21px;
  justify-content: space-between;
  gap: 18px;
  color: var(--qiu-muted);
  font-family: Arial, sans-serif;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.qiu-footer a { color: var(--qiu-red); text-underline-offset: 3px; }

@media (max-width: 980px) {
  .qiu-wrap { padding: 20px 20px 48px; }
  .qiu-hero { grid-template-columns: 1fr; gap: 34px; padding: 38px 0 46px; }
  .qiu-hero h1 { font-size: 72px; }
  .qiu-hero h2 { max-width: 720px; font-size: 36px; }
  .qiu-board { min-height: 360px; }
  .qiu-advantage-layout,
  .qiu-integration-layout,
  .qiu-usecase-layout { grid-template-columns: 1fr; }
  .qiu-prompts,
  .qiu-model-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .qiu-ribbon { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .qiu-ribbon article:nth-child(2) { border-right: 0; }
  .qiu-ribbon article:nth-child(-n + 2) { border-bottom: 3px solid var(--qiu-ink); }
}

@media (max-width: 640px) {
  .qiu-wrap { padding: 14px 14px 42px; }
  .qiu-hero { padding: 30px 0 38px; }
  .qiu-hero h1 { font-size: 54px; }
  .qiu-hero h2 { margin-top: 16px; font-size: 30px; }
  .qiu-hero p { font-size: 16px; }
  .qiu-actions { display: grid; grid-template-columns: 1fr; }
  .qiu-btn { width: 100%; }
  .qiu-board { min-height: 310px; }
  .qiu-board-brand { padding: 30px 18px 0; }
  .qiu-board-brand strong { font-size: 40px; }
  .qiu-board-brand code { max-width: 72%; }
  .qiu-provider-doodles { right: 16px; bottom: 16px; grid-template-columns: repeat(2, 44px); gap: 8px; }
  .qiu-provider-doodles span { height: 44px; }
  .qiu-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .qiu-strip span:nth-child(2) { border-right: 0; }
  .qiu-strip span:nth-child(-n + 2) { border-bottom: 3px solid var(--qiu-ink); }
  .qiu-section { padding: 42px 0; }
  .qiu-heading h3 { font-size: 32px; }
  .qiu-feature-lead { min-height: 0; }
  .qiu-feature-lead h4 { margin-top: 30px; font-size: 28px; }
  .qiu-prompts,
  .qiu-model-grid,
  .qiu-price-line { grid-template-columns: 1fr; }
  .qiu-prompt { min-height: 0; }
  .qiu-price-line { gap: 18px; }
  .qiu-endpoints { padding-left: 14px; }
  .qiu-endpoint { grid-template-columns: 1fr; gap: 4px; }
  .qiu-ribbon { grid-template-columns: 1fr; }
  .qiu-ribbon article { border-right: 0; border-bottom: 3px solid var(--qiu-ink); }
  .qiu-ribbon article:last-child { border-bottom: 0; }
  .qiu-usecase-lead { font-size: 31px; }
  .qiu-faq { columns: 1; }
  .qiu-footer { flex-direction: column; }
}

@media (prefers-reduced-motion: reduce) {
  .qiu-home { scroll-behavior: auto; }
  .qiu-btn,
  .qiu-board,
  .qiu-prompt { transform: none; }
}
</style>
