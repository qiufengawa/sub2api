<template>
  <div v-if="mode === 'checkbox' && documents.length > 0" class="agreement-consent">
    <UiCheckbox
      id="login-agreement-consent"
      :model-value="accepted"
      @update:model-value="handleCheckboxChange"
    >
      <span class="agreement-consent__copy">
        {{ t('legal.loginAgreementPrompt.checkboxPrefix') }}
        <template v-for="(doc, index) in documents" :key="doc.id || doc.title">
          <RouterLink
            :to="documentRoute(doc)"
            target="_blank"
            rel="noopener noreferrer"
            class="agreement-link"
            @click.stop
          >
            {{ doc.title }}
          </RouterLink>
          <span v-if="index < documents.length - 1">
            {{ t('legal.loginAgreementPrompt.documentSeparator') }}
          </span>
        </template>
      </span>
    </UiCheckbox>
  </div>

  <UiAlert
    v-else-if="!accepted && documents.length > 0"
    class="agreement-notice"
    tone="info"
    :title="t('legal.loginAgreementPrompt.noticeTitle')"
    :message="t('legal.loginAgreementPrompt.noticeDescription')"
  >
    <template #default>
      <div class="agreement-notice__content">
        <span>{{ t('legal.loginAgreementPrompt.noticeDescription') }}</span>
        <UiButton density="mini" variant="secondary" @click="emit('open')">
          {{ t('legal.loginAgreementPrompt.viewTerms') }}
        </UiButton>
      </div>
    </template>
  </UiAlert>

  <UiDialog
    :show="dialogVisible"
    :title="t('legal.loginAgreementPrompt.dialogTitle')"
    width="wide"
    :close-on-click-outside="false"
    :close-label="t('legal.loginAgreementPrompt.reject')"
    @close="emit('reject')"
  >
    <div class="agreement-dialog">
      <div class="agreement-dialog__intro">
        <Icon class="agreement-dialog__icon" name="shield" size="md" aria-hidden="true" />
        <div>
          <p class="agreement-dialog__description">
            {{
              t('legal.loginAgreementPrompt.dialogDescription', {
                date: updatedAt || t('legal.loginAgreementPrompt.recently'),
              })
            }}
          </p>
          <span v-if="updatedAt" class="agreement-dialog__date">{{ updatedAt }}</span>
        </div>
      </div>

      <div class="agreement-dialog__documents">
        <h3>{{ t('legal.loginAgreementPrompt.relatedDocuments') }}</h3>
        <div class="agreement-document-list">
          <RouterLink
            v-for="(doc, index) in documents"
            :key="doc.id || doc.title"
            :to="documentRoute(doc)"
            target="_blank"
            rel="noopener noreferrer"
            class="agreement-document"
          >
            <span class="agreement-document__icon" aria-hidden="true">
              <Icon :name="documentIcon(index, doc.title)" size="sm" />
            </span>
            <span class="agreement-document__title">{{ doc.title }}</span>
            <Icon name="externalLink" size="sm" class="agreement-document__arrow" />
          </RouterLink>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton density="compact" variant="secondary" @click="emit('reject')">
        {{ t('legal.loginAgreementPrompt.reject') }}
      </UiButton>
      <UiButton density="compact" variant="primary" @click="emit('accept')">
        <template #icon><Icon name="check" size="sm" /></template>
        {{ t('legal.loginAgreementPrompt.accept') }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'
import { UiAlert, UiButton, UiCheckbox, UiDialog } from '@/components/ui'
import type { LoginAgreementDocument } from '@/types'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  accepted: boolean
  documents: LoginAgreementDocument[]
  mode: 'modal' | 'checkbox' | string
  updatedAt?: string
  visible: boolean
}>(), {
  updatedAt: ''
})

const emit = defineEmits<{
  accept: []
  reject: []
  open: []
}>()

const documents = computed(() => props.documents.filter((doc) => doc.title.trim()))
const dialogVisible = computed(() => props.visible && documents.value.length > 0)
const accepted = computed(() => props.accepted)
const mode = computed(() => (props.mode === 'checkbox' ? 'checkbox' : 'modal'))
const updatedAt = computed(() => props.updatedAt || '')

function documentRoute(doc: LoginAgreementDocument) {
  return {
    name: 'LegalDocument',
    params: { documentId: doc.id || doc.title },
  }
}

function handleCheckboxChange(value: boolean): void {
  if (value) {
    emit('accept')
  } else {
    emit('reject')
  }
}

function documentIcon(index: number, title: string): 'document' | 'shield' | 'globe' | 'cog' {
  const normalizedTitle = title.toLowerCase()
  if (
    normalizedTitle.includes('policy') ||
    normalizedTitle.includes('privacy') ||
    title.includes('政策') ||
    title.includes('隐私')
  ) {
    return 'shield'
  }
  if (
    normalizedTitle.includes('country') ||
    normalizedTitle.includes('region') ||
    title.includes('国家') ||
    title.includes('地区')
  ) {
    return 'globe'
  }
  if (index === 3) return 'cog'
  return 'document'
}
</script>

<style scoped>
.agreement-consent { padding-block: 2px; }
.agreement-consent__copy { color: var(--ui-text-muted); font-size: 13px; line-height: 22px; }
.agreement-link { color: var(--ui-text); font-weight: 600; text-decoration: underline; text-decoration-color: var(--ui-border); text-underline-offset: 3px; }
.agreement-link:hover { text-decoration-color: currentColor; }
.agreement-notice { margin-top: 4px; }
.agreement-notice__content { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.agreement-dialog { display: grid; gap: 24px; }
.agreement-dialog__intro { display: grid; grid-template-columns: 36px minmax(0, 1fr); align-items: start; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--ui-border-soft); }
.agreement-dialog__icon { margin: 4px auto 0; color: var(--ui-info); }
.agreement-dialog__description { margin: 0; color: var(--ui-text-muted); font-size: 13px; line-height: 22px; }
.agreement-dialog__date { display: inline-block; margin-top: 6px; color: var(--ui-text-soft); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }
.agreement-dialog__documents { display: grid; gap: 10px; }
.agreement-dialog__documents h3 { margin: 0; color: var(--ui-text); font-size: 13px; font-weight: 600; line-height: 20px; }
.agreement-document-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.agreement-document { display: flex; min-width: 0; align-items: center; gap: 10px; min-height: 48px; padding: 8px 10px; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); color: var(--ui-text); background: var(--ui-surface); text-decoration: none; transition: border-color var(--ui-motion-fast), background var(--ui-motion-fast), transform var(--ui-motion-fast); }
.agreement-document:hover { border-color: var(--ui-text-soft); background: var(--ui-surface-muted); transform: translateY(-1px); }
.agreement-document__icon { display: grid; width: 28px; height: 28px; flex: 0 0 28px; place-items: center; border: 1px solid var(--ui-border-soft); border-radius: var(--ui-radius-sm); color: var(--ui-text-muted); background: var(--ui-surface-muted); }
.agreement-document__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.agreement-document__arrow { flex: 0 0 auto; color: var(--ui-text-soft); }
@media (max-width: 640px) {
  .agreement-notice__content { align-items: flex-start; flex-direction: column; }
  .agreement-document-list { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .agreement-document { transition: none; } }
</style>
