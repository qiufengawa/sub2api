<template>
  <div class="legal-shell">
    <header class="legal-site-header">
      <div class="legal-site-header__inner">
        <UiLink to="/home" variant="brand" class="legal-brand" :aria-label="siteName">
          <UiSkeleton v-if="loading" width="124px" height="32px" />
          <img v-else-if="siteLogo" :src="siteLogo" :alt="siteName" />
          <strong v-else>{{ siteName }}</strong>
        </UiLink>
        <AppInline :wrap="false">
          <UiLink to="/home">{{ t('common.goHome') }}</UiLink>
          <UiLink to="/login">{{ t('home.login') }}</UiLink>
        </AppInline>
      </div>
    </header>

    <AppPage width="normal" class="legal-page">
      <AppPageHeader :title="pageTitle" :description="pageDescription">
        <template v-if="currentDocument" #status>
          <UiBadge :label="documentTypeLabel" />
        </template>
        <template #actions>
          <UiLink to="/home">
            <Icon name="arrowLeft" size="sm" />
            {{ t('common.goHome') }}
          </UiLink>
        </template>
      </AppPageHeader>

      <div v-if="loading" class="legal-loading" role="status" aria-live="polite">
        <UiSkeleton height="18px" width="62%" />
        <UiSkeleton v-for="index in 8" :key="index" height="14px" :width="index % 3 === 0 ? '72%' : '100%'" />
        <span class="ui-sr-only">{{ t('common.loading') }}</span>
      </div>

      <UiErrorState
        v-else-if="loadError"
        :title="t('legal.loadFailed')"
        :description="t('legal.retryLater')"
        :retry-text="t('common.retry')"
        @retry="loadDocuments"
      />

      <UiEmptyState
        v-else-if="!currentDocument"
        icon="document"
        :title="t('legal.notFound')"
        :description="t('legal.notFoundDescription')"
      >
        <template #action>
          <UiLink to="/home">{{ t('common.goHome') }}</UiLink>
        </template>
      </UiEmptyState>

      <template v-else>
        <AppSplitPane
          v-if="documentPresentation.headings.length"
          class="legal-workspace"
          master-width="220px"
        >
          <template #master>
            <nav class="legal-toc" :aria-label="t('legal.tableOfContents')">
              <strong>{{ t('legal.tableOfContents') }}</strong>
              <UiLink
                v-for="heading in documentPresentation.headings"
                :key="heading.id"
                :href="`#${heading.id}`"
                variant="muted"
                :class="{ 'legal-toc__nested': heading.level === 3 }"
              >
                {{ heading.label }}
              </UiLink>
            </nav>
          </template>

          <article id="legal-document" :aria-label="currentDocument.title">
            <LegalDocumentContent
              v-if="hasContent"
              :html="documentPresentation.html"
            />
            <UiEmptyState v-else icon="document" :title="t('legal.empty')" />
          </article>
        </AppSplitPane>
        <article v-else id="legal-document" class="legal-document--single" :aria-label="currentDocument.title">
          <LegalDocumentContent v-if="hasContent" :html="documentPresentation.html" />
          <UiEmptyState v-else icon="document" :title="t('legal.empty')" />
        </article>

        <AppSection v-if="previousDocument || nextDocument" divided>
          <UiPageNav
            :previous="previousDocument"
            :next="nextDocument"
            :label="t('legal.documentNavigation')"
            :previous-fallback="t('legal.previousDocument')"
            :next-fallback="t('legal.nextDocument')"
            @navigate="navigateDocument"
          />
        </AppSection>
      </template>
    </AppPage>

    <UiBackToTop :label="t('common.backToTop')" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import LegalDocumentContent from '@/components/legal/LegalDocumentContent.vue'
import {
  AppInline,
  AppPage,
  AppPageHeader,
  AppSection,
  AppSplitPane,
  UiBackToTop,
  UiBadge,
  UiEmptyState,
  UiErrorState,
  UiLink,
  UiPageNav,
  UiSkeleton,
} from '@/components/ui'
import { getLocale } from '@/i18n'
import { sanitizeUrl } from '@/utils/url'
import { useAppStore } from '@/stores/app'
import type { LoginAgreementDocument } from '@/types'
import zhAdminCompliance from '../../../../docs/legal/admin-compliance.zh.md?raw'
import enAdminCompliance from '../../../../docs/legal/admin-compliance.en.md?raw'

interface DocumentHeading {
  id: string
  label: string
  level: 2 | 3
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const appStore = useAppStore()
const settings = computed(() => appStore.cachedPublicSettings)
const loading = ref(!settings.value)
const loadError = ref(false)

marked.setOptions({
  breaks: true,
  gfm: true,
})

const documentId = computed(() => String(route.params.documentId || ''))
const isAdminComplianceDocument = computed(() => documentId.value === 'admin-compliance')
const documents = computed(() => settings.value?.login_agreement_documents ?? [])
const siteName = computed(() => settings.value?.site_name || 'Sub2API')
const siteLogo = computed(() => sanitizeUrl(settings.value?.site_logo || '', {
  allowRelative: true,
  allowDataUrl: true,
}))
const updatedAt = computed(() =>
  isAdminComplianceDocument.value ? '' : settings.value?.login_agreement_updated_at || ''
)
const documentTypeLabel = computed(() =>
  isAdminComplianceDocument.value ? t('legal.adminCompliance') : t('legal.loginAgreement')
)

const currentDocument = computed<LoginAgreementDocument | null>(() => {
  if (isAdminComplianceDocument.value) {
    return {
      id: 'admin-compliance',
      title: t('adminCompliance.title'),
      content_md: getLocale() === 'zh' ? zhAdminCompliance : enAdminCompliance,
    }
  }
  const id = documentId.value
  if (!id) return null
  return documents.value.find(document => document.id === id) ?? null
})

const hasContent = computed(() => Boolean(currentDocument.value?.content_md?.trim()))
const pageTitle = computed(() => {
  if (loading.value) return t('common.loading')
  if (loadError.value) return t('legal.loadFailed')
  return currentDocument.value?.title || t('legal.notFound')
})
const pageDescription = computed(() => {
  if (loadError.value) return t('legal.retryLater')
  if (!currentDocument.value) return t('legal.notFoundDescription')
  return updatedAt.value ? t('legal.updatedAt', { date: updatedAt.value }) : undefined
})

const documentPresentation = computed<{ html: string; headings: DocumentHeading[] }>(() => {
  const content = currentDocument.value?.content_md?.trim() || ''
  if (!content) return { html: '', headings: [] }

  const sanitized = DOMPurify.sanitize(marked.parse(content) as string)
  const container = document.createElement('div')
  container.innerHTML = sanitized
  const headings = Array.from(container.querySelectorAll<HTMLHeadingElement>('h2, h3')).map((heading, index) => {
    const id = `legal-section-${index + 1}`
    heading.id = id
    return {
      id,
      label: heading.textContent?.trim() || id,
      level: Number(heading.tagName.slice(1)) as 2 | 3,
    }
  })
  container.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
    const href = anchor.getAttribute('href') || ''
    if (/^https?:\/\//i.test(href)) {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
    }
  })
  return { html: container.innerHTML, headings }
})

const currentDocumentIndex = computed(() =>
  documents.value.findIndex(document => document.id === documentId.value)
)
const previousDocument = computed(() => {
  const previous = documents.value[currentDocumentIndex.value - 1]
  return previous ? { key: previous.id, label: previous.title } : undefined
})
const nextDocument = computed(() => {
  const next = documents.value[currentDocumentIndex.value + 1]
  return next ? { key: next.id, label: next.title } : undefined
})

function navigateDocument(id: string): void {
  void router.push({ name: 'LegalDocument', params: { documentId: id } })
}

async function loadDocuments(): Promise<void> {
  loading.value = true
  loadError.value = false
  const loadedSettings = await appStore.fetchPublicSettings()
  if (!loadedSettings && !isAdminComplianceDocument.value) {
    loadError.value = true
  }
  loading.value = false
}

onMounted(loadDocuments)
</script>

<style scoped>
.legal-shell {
  min-height: 100dvh;
  background: var(--ui-bg);
}

.legal-site-header {
  border-bottom: 1px solid var(--ui-border-soft);
  background: color-mix(in srgb, var(--ui-bg) 94%, transparent);
}

.legal-site-header__inner {
  display: flex;
  width: min(100%, 1080px);
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin: 0 auto;
  padding: 8px 20px;
}

.legal-brand {
  min-width: 0;
}

.legal-brand img {
  width: auto;
  max-width: 180px;
  height: 32px;
  object-fit: contain;
  object-position: left center;
}

.legal-brand strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legal-page {
  width: min(100%, 1080px);
  margin: 0 auto;
  padding-block: 28px 64px;
}

.legal-loading {
  display: grid;
  gap: 14px;
  min-height: 420px;
  padding-top: 32px;
}

.legal-workspace {
  padding-top: 28px;
}

.legal-toc {
  position: sticky;
  top: 20px;
  display: grid;
  gap: 9px;
  min-width: 0;
  padding-right: 20px;
  border-right: 1px solid var(--ui-border-soft);
}

.legal-toc strong {
  margin-bottom: 4px;
  color: var(--ui-text);
  font-size: 12px;
  font-weight: 600;
}

.legal-toc__nested {
  padding-left: 12px;
}

#legal-document,
.legal-document--single {
  min-width: 0;
}

.legal-document--single {
  padding-top: 28px;
}

@media (max-width: 720px) {
  .legal-site-header__inner {
    padding-inline: 16px;
  }

  .legal-page {
    padding-block: 20px 48px;
  }

}

@media (max-width: 900px) {
  .legal-toc {
    position: static;
    padding: 0 0 20px;
    border-right: 0;
    border-bottom: 1px solid var(--ui-border-soft);
  }
}
</style>
