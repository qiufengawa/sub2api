<template>
  <AppLayout>
    <AppPage width="full" density="compact" class="custom-page">
      <AppPageHeader
        v-if="menuItem && !loading"
        :title="menuItem.label"
        :description="isMarkdownMode ? t('customPage.markdownMode') : t('customPage.embeddedMode')"
      >
        <template v-if="!isMarkdownMode && isValidUrl" #actions>
          <UiLink :href="embeddedUrl" external>
            {{ t('customPage.openInNewTab') }}
          </UiLink>
        </template>
      </AppPageHeader>

      <div class="custom-page-workspace">
        <div v-if="loading" class="custom-page-loading" role="status" :aria-label="t('common.loading')">
          <UiSkeleton variant="text" width="42%" />
          <UiSkeleton variant="rect" width="100%" height="320px" />
        </div>

        <UiErrorState
          v-else-if="settingsLoadError"
          :title="t('common.loadFailed')"
          :description="t('customPage.settingsLoadFailedDesc')"
          :retry-text="t('common.retry')"
          @retry="loadPublicSettings(true)"
        />

        <UiEmptyState
          v-else-if="!menuItem"
          icon="link"
          :title="t('customPage.notFoundTitle')"
          :description="t('customPage.notFoundDesc')"
        />

        <UiErrorState
          v-else-if="loadError"
          :title="t('common.loadFailed')"
          :retry-text="t('common.retry')"
          @retry="retryLoad"
        />

        <UiEmptyState
          v-else-if="isMarkdownMode && markdownEmpty"
          icon="document"
          :title="t('customPage.emptyTitle')"
          :description="t('customPage.emptyDesc')"
        />

        <div v-else-if="isMarkdownMode" class="custom-markdown-workspace">
          <aside
            v-if="!isCompactToc && tocVisible && tocItems.length > 0"
            id="custom-page-toc"
            class="custom-toc"
            :aria-label="t('customPage.tableOfContents')"
          >
            <div class="custom-toc__header">
              <strong>{{ t('customPage.tableOfContents') }}</strong>
              <UiIconButton
                icon="chevronLeft"
                variant="ghost"
                density="dense"
                :label="t('common.collapse')"
                aria-controls="custom-page-toc"
                :aria-expanded="tocVisible"
                @click="tocVisible = false"
              />
            </div>
            <nav class="custom-toc__nav">
              <a
                v-for="item in tocItems"
                :key="item.id"
                :href="'#' + item.id"
                class="custom-toc__item"
                :class="[
                  `custom-toc__item--level-${item.level}`,
                  { 'custom-toc__item--active': activeHeadingId === item.id }
                ]"
                @click.prevent="scrollToHeading(item.id)"
              >
                {{ item.text }}
              </a>
            </nav>
          </aside>

          <UiDrawer
            :show="isCompactToc && tocVisible"
            id="custom-page-toc"
            side="left"
            :title="t('customPage.tableOfContents')"
            @close="tocVisible = false"
          >
            <nav class="custom-toc__nav custom-toc__nav--drawer">
              <a
                v-for="item in tocItems"
                :key="`drawer-${item.id}`"
                :href="'#' + item.id"
                class="custom-toc__item"
                :class="[
                  `custom-toc__item--level-${item.level}`,
                  { 'custom-toc__item--active': activeHeadingId === item.id }
                ]"
                @click.prevent="scrollToHeading(item.id)"
              >
                {{ item.text }}
              </a>
            </nav>
          </UiDrawer>

          <UiButton
            v-if="!tocVisible && tocItems.length > 0"
            class="custom-toc-toggle"
            density="dense"
            variant="secondary"
            aria-controls="custom-page-toc"
            :aria-expanded="tocVisible"
            @click="tocVisible = true"
          >
            <template #icon><Icon name="menu" size="sm" /></template>
            {{ t('customPage.tableOfContents') }}
          </UiButton>

          <article
            ref="markdownContainer"
            class="markdown-page-content"
            v-html="renderedHtml"
            @scroll="onContentScroll"
          />
        </div>

        <UiEmptyState
          v-else-if="!isValidUrl"
          icon="link"
          :title="t('customPage.notConfiguredTitle')"
          :description="t('customPage.notConfiguredDesc')"
        />

        <div v-else class="custom-embed-shell">
          <iframe
            :src="embeddedUrl"
            :title="menuItem.label || t('customPage.title')"
            class="custom-embed-frame"
            allowfullscreen
          />
        </div>
      </div>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  AppPage,
  AppPageHeader,
  UiButton,
  UiDrawer,
  UiEmptyState,
  UiErrorState,
  UiIconButton,
  UiLink,
  UiSkeleton
} from '@/components/ui'
import { buildApiUrl } from '@/api/client'
import { buildEmbeddedUrl, detectTheme } from '@/utils/embedded-url'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface TocItem {
  id: string
  text: string
  level: number
}

const { t, locale } = useI18n()
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const adminSettingsStore = useAdminSettingsStore()

const loading = ref(false)
const loadError = ref(false)
const settingsLoadError = ref(false)
const markdownEmpty = ref(false)
const pageTheme = ref<'light' | 'dark'>('light')
const renderedHtml = ref('')
const markdownContainer = ref<HTMLElement | null>(null)
const tocItems = ref<TocItem[]>([])
const isCompactToc = ref(typeof window !== 'undefined' ? window.innerWidth <= 640 : false)
const tocVisible = ref(!isCompactToc.value)
const activeHeadingId = ref('')
let themeObserver: MutationObserver | null = null
let markdownRequestController: AbortController | null = null
let markdownRequestSeq = 0

const menuItemId = computed(() => route.params.id as string)

const menuItem = computed(() => {
  const id = menuItemId.value
  const publicItems = appStore.cachedPublicSettings?.custom_menu_items ?? []
  const found = publicItems.find((item) => item.id === id) ?? null
  if (found) return found
  if (authStore.isAdmin) {
    return adminSettingsStore.customMenuItems.find((item) => item.id === id) ?? null
  }
  return null
})

const markdownSlug = computed(() => {
  const item = menuItem.value
  if (!item) return ''
  if (item.page_slug) return item.page_slug
  if (item.url?.startsWith('md:')) return item.url.slice(3)
  return ''
})

const isMarkdownMode = computed(() => !!markdownSlug.value)

const embeddedUrl = computed(() => {
  if (!menuItem.value || isMarkdownMode.value) return ''
  return buildEmbeddedUrl(
    menuItem.value.url,
    authStore.user?.id,
    null,
    pageTheme.value,
    locale.value,
  )
})

const isValidUrl = computed(() => {
  if (isMarkdownMode.value) return false
  const url = embeddedUrl.value
  return url.startsWith('http://') || url.startsWith('https://')
})

function generateHeadingId(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base ? `${base}-${index}` : `heading-${index}`
}

function isRelativeMarkdownAsset(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('/')) {
    return false
  }
  const [pathPart] = trimmed.split(/([?#].*)/, 2)
  return pathPart
    .split('/')
    .filter((part) => part && part !== '.')
    .every((part) => part !== '..' && !part.includes('\\'))
}

function buildPageImageUrl(slug: string, src: string): string {
  const trimmed = src.trim()
  const [pathPart, suffix = ''] = trimmed.split(/([?#].*)/, 2)
  const encodedPath = pathPart
    .split('/')
    .filter((part) => part && part !== '.')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return buildApiUrl(`/pages/${encodeURIComponent(slug)}/images/${encodedPath}${suffix}`)
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function fetchAndRenderMarkdown(slug: string) {
  const requestId = ++markdownRequestSeq
  markdownRequestController?.abort()
  const controller = new AbortController()
  markdownRequestController = controller
  loading.value = true
  loadError.value = false
  markdownEmpty.value = false
  tocItems.value = []
  activeHeadingId.value = ''
  try {
    const resp = await fetch(buildApiUrl(`/pages/${encodeURIComponent(slug)}`), {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
      signal: controller.signal,
    })
    if (requestId !== markdownRequestSeq) return
    if (!resp.ok) {
      renderedHtml.value = ''
      loadError.value = true
      return
    }
    let raw = await resp.text()
    if (requestId !== markdownRequestSeq) return

    raw = raw.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, src) => isRelativeMarkdownAsset(src) ? `![${alt}](${buildPageImageUrl(slug, src)})` : match
    )

    const html = marked.parse(raw) as string
    const sanitized = DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allowfullscreen', 'frameborder', 'src'],
    })

    const tableLabel = escapeHtmlAttribute(t('customPage.scrollableTable'))
    const withTableScroll = sanitized
      .replace(
        /<table([^>]*)>/gi,
        `<div class="markdown-table-scroll" role="region" aria-label="${tableLabel}" tabindex="0"><table$1>`
      )
      .replace(/<\/table>/gi, '</table></div>')

    // Inject IDs into headings and build TOC
    const toc: TocItem[] = []
    let headingIndex = 0
    const withIds = withTableScroll.replace(
      /<(h[1-4])[^>]*>(.*?)<\/h[1-4]>/gi,
      (_, tag: string, content: string) => {
        const level = parseInt(tag[1])
        const text = content.replace(/<[^>]+>/g, '').trim()
        const id = generateHeadingId(text, headingIndex++)
        toc.push({ id, text, level })
        return `<${tag} id="${id}">${content}</${tag}>`
      }
    )

    renderedHtml.value = withIds
    const parsed = new DOMParser().parseFromString(withIds, 'text/html')
    const meaningfulSource = raw.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>/gi, '').trim()
    markdownEmpty.value = !meaningfulSource || (!parsed.body.textContent?.trim() && !parsed.body.querySelector('img, iframe, table, hr, video, audio, svg, canvas, picture, div, pre, code, blockquote, ul, ol'))
    tocItems.value = toc
  } catch (error) {
    if (controller.signal.aborted || requestId !== markdownRequestSeq) return
    renderedHtml.value = ''
    markdownEmpty.value = false
    loadError.value = true
  } finally {
    if (requestId === markdownRequestSeq) {
      markdownRequestController = null
      loading.value = false
      await nextTick()
      await nextTick()
      injectCopyButtons()
    }
  }
}

function retryLoad() {
  if (markdownSlug.value) {
    void fetchAndRenderMarkdown(markdownSlug.value)
    return
  }
  loadError.value = false
}

async function loadPublicSettings(force = false) {
  loading.value = true
  settingsLoadError.value = false
  const result = await appStore.fetchPublicSettings(force)
  settingsLoadError.value = result == null
  if (!markdownSlug.value) {
    loading.value = false
  }
}

function scrollToHeading(id: string) {
  const container = markdownContainer.value
  if (!container) return
  const el = container.querySelector(`#${CSS.escape(id)}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeHeadingId.value = id
    if (window.innerWidth <= 640) {
      tocVisible.value = false
    }
  }
}

let scrollRafId = 0
function onContentScroll() {
  if (scrollRafId) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = 0
    const container = markdownContainer.value
    if (!container || tocItems.value.length === 0) return

    const containerRect = container.getBoundingClientRect()
    let current = ''

    for (const item of tocItems.value) {
      const el = container.querySelector(`#${CSS.escape(item.id)}`) as HTMLElement | null
      if (el) {
        const elRect = el.getBoundingClientRect()
        if (elRect.top - containerRect.top <= 100) {
          current = item.id
        }
      }
    }
    activeHeadingId.value = current
  })
}

function injectCopyButtons() {
  const container = markdownContainer.value
  if (!container) return

  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.copy-btn')) return
    const btn = document.createElement('button')
    btn.className = 'copy-btn'
    btn.textContent = t('customPage.copyCode')
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
      try {
        await navigator.clipboard.writeText(code)
        btn.textContent = t('customPage.copiedCode')
        setTimeout(() => { btn.textContent = t('customPage.copyCode') }, 2000)
      } catch {
        btn.textContent = t('customPage.copyCodeFailed')
        setTimeout(() => { btn.textContent = t('customPage.copyCode') }, 2000)
      }
    })
    pre.style.position = 'relative'
    pre.appendChild(btn)
  })
}

watch(markdownSlug, (slug) => {
  if (slug) {
    if (isCompactToc.value) {
      tocVisible.value = false
    }
    fetchAndRenderMarkdown(slug)
  } else {
    markdownRequestSeq += 1
    markdownRequestController?.abort()
    markdownRequestController = null
    renderedHtml.value = ''
    tocItems.value = []
    markdownEmpty.value = false
    loadError.value = false
    loading.value = false
  }
}, { immediate: true })

function syncTocLayout() {
  const nextCompact = window.innerWidth <= 640
  if (nextCompact === isCompactToc.value) return
  isCompactToc.value = nextCompact
  tocVisible.value = !nextCompact
}

function onPageKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isCompactToc.value && tocVisible.value) {
    tocVisible.value = false
  }
}

onMounted(async () => {
  pageTheme.value = detectTheme()
  syncTocLayout()
  window.addEventListener('resize', syncTocLayout, { passive: true })
  window.addEventListener('keydown', onPageKeydown)

  if (typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      pageTheme.value = detectTheme()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  }

  if (appStore.publicSettingsLoaded) return
  await loadPublicSettings()
})

onUnmounted(() => {
  markdownRequestSeq += 1
  markdownRequestController?.abort()
  markdownRequestController = null
  if (scrollRafId) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = 0
  }
  window.removeEventListener('resize', syncTocLayout)
  window.removeEventListener('keydown', onPageKeydown)
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
})
</script>

<style scoped>
.custom-page {
  display: flex;
  height: calc(100dvh - var(--app-header-height, 4rem));
  min-height: 20rem;
  flex-direction: column;
}

.custom-page-workspace {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.custom-page-loading {
  display: grid;
  width: 100%;
  align-content: start;
  gap: 16px;
  padding: 24px 0;
}

.custom-markdown-workspace {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.custom-toc {
  display: flex;
  width: clamp(180px, 24%, 260px);
  min-width: 180px;
  min-height: 0;
  flex-direction: column;
  border-right: 1px solid var(--ui-border-soft);
  background: var(--ui-surface-muted);
}

.custom-toc__header {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px 6px 14px;
  border-bottom: 1px solid var(--ui-border-soft);
}

.custom-toc__header strong {
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 600;
}

.custom-toc__nav {
  min-height: 0;
  padding: 8px;
  overflow-y: auto;
}

.custom-toc__nav--drawer {
  padding: 0;
}

.custom-toc__item {
  display: block;
  min-height: 30px;
  padding: 6px 8px;
  overflow: hidden;
  border-radius: var(--ui-radius);
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--ui-motion-fast), background var(--ui-motion-fast);
}

.custom-toc__item:hover {
  color: var(--ui-text);
  background: var(--ui-surface-strong);
}

.custom-toc__item--active {
  color: var(--ui-text-strong);
  background: var(--ui-surface-strong);
  font-weight: 600;
}

.custom-toc__item--level-1 { padding-left: 8px; }
.custom-toc__item--level-2 { padding-left: 20px; }
.custom-toc__item--level-3 { padding-left: 32px; }
.custom-toc__item--level-4 { padding-left: 44px; }

.custom-toc-toggle {
  position: absolute;
  z-index: 5;
  top: 10px;
  left: 10px;
}

.custom-embed-shell {
  position: relative;
  width: 100%;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  background: var(--ui-surface-muted);
}

.custom-embed-frame {
  display: block;
  margin: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
}

@media (max-width: 640px) {
  .custom-page {
    height: calc(100dvh - var(--app-header-height, 3.5rem));
  }
}

@media (prefers-reduced-motion: reduce) {
  .custom-toc__item {
    transition: none;
  }
}
</style>

<style>
.markdown-page-content {
  min-width: 0;
  min-height: 0;
  flex: 1;
  padding: 24px;
  overflow: auto;
  color: var(--ui-text);
  font-size: 14px;
  line-height: 1.75;
}

.markdown-page-content h1,
.markdown-page-content h2,
.markdown-page-content h3,
.markdown-page-content h4 {
  color: var(--ui-text-strong);
  font-weight: 650;
}

.markdown-page-content h1 { margin: 24px 0 14px; padding-bottom: 10px; border-bottom: 1px solid var(--ui-border-soft); font-size: 26px; line-height: 36px; }
.markdown-page-content h2 { margin: 24px 0 12px; font-size: 21px; line-height: 30px; }
.markdown-page-content h3 { margin: 20px 0 10px; font-size: 17px; line-height: 26px; }
.markdown-page-content h4 { margin: 18px 0 8px; font-size: 15px; line-height: 24px; }
.markdown-page-content p { margin: 0 0 14px; }
.markdown-page-content ul,
.markdown-page-content ol { margin: 0 0 14px; padding-left: 24px; }
.markdown-page-content li { margin-bottom: 4px; }
.markdown-page-content a { color: var(--ui-text); text-decoration: underline; text-decoration-color: var(--ui-border); text-underline-offset: 3px; }
.markdown-page-content a:hover { text-decoration-color: currentColor; }
.markdown-page-content blockquote { margin: 16px 0; padding-left: 14px; border-left: 2px solid var(--ui-border); color: var(--ui-text-muted); }
.markdown-page-content img { max-width: 100%; height: auto; margin: 16px 0; border-radius: var(--ui-radius); user-select: none; -webkit-user-drag: none; }
.markdown-table-scroll { max-width: 100%; margin: 16px 0; overflow-x: auto; }
.markdown-table-scroll:focus-visible { outline: 2px solid color-mix(in srgb, var(--ui-focus) 24%, transparent); outline-offset: 2px; }
.markdown-page-content table { width: 100%; min-width: 640px; border-collapse: collapse; }
.markdown-page-content th,
.markdown-page-content td { padding: 8px 10px; border: 1px solid var(--ui-border); text-align: left; }
.markdown-page-content th { color: var(--ui-text-muted); background: var(--ui-surface-muted); font-size: 12px; font-weight: 600; }
.markdown-page-content code { padding: 2px 4px; border-radius: 3px; background: var(--ui-surface-strong); font-family: var(--ui-font-mono); font-size: .92em; }
.markdown-page-content pre { position: relative; margin: 16px 0; padding: 16px; overflow-x: auto; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); background: var(--ui-surface-muted); }
.markdown-page-content pre code { padding: 0; color: inherit; background: transparent; }
.markdown-page-content hr { margin: 24px 0; border: 0; border-top: 1px solid var(--ui-border-soft); }

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  height: var(--ui-control-dense);
  padding: 0 9px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  color: var(--ui-text-muted);
  background: var(--ui-surface);
  font-family: var(--ui-font-sans);
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--ui-motion-fast), background var(--ui-motion-fast);
}
.copy-btn:hover { color: var(--ui-text); background: var(--ui-surface-strong); }
pre:hover .copy-btn { opacity: 1; }
.copy-btn:focus-visible { opacity: 1; outline: 2px solid color-mix(in srgb, var(--ui-focus) 24%, transparent); outline-offset: 2px; }

@media (max-width: 640px) {
  .markdown-page-content { padding: 18px 14px; }
  .markdown-page-content h1 { font-size: 22px; line-height: 31px; }
}

@media (hover: none) {
  .copy-btn { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .copy-btn { transition: none; }
}
</style>
