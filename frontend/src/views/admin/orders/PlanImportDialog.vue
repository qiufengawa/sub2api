<template>
  <UiDialog
    :show="show"
    :title="t('payment.admin.catalogImport.title')"
    width="extra-wide"
    :close-on-escape="!applying"
    :show-close-button="!applying"
    @close="handleClose"
  >
    <AppStack :gap="16">
      <UiAlert tone="info" :message="t('payment.admin.catalogImport.description')" />
      <UiAlert :message="t('payment.admin.catalogImport.securityNotice')" />

      <UiSegmentedControl
        :model-value="inputMode"
        :label="t('payment.admin.catalogImport.title')"
        :options="inputModeOptions"
        @update:model-value="updateInputMode"
      />

      <UiFileUpload
        v-if="inputMode === 'file'"
        accept="application/json,.json"
        :button-text="selectedFile?.name || t('payment.admin.catalogImport.selectFile')"
        :accept-text="selectedFile ? t('payment.admin.catalogImport.replaceFile') : t('payment.admin.catalogImport.fileHint')"
        :disabled="busy"
        @select="handleSelectedFiles"
      />

      <AppStack v-else :gap="8">
        <UiTextArea
          id="catalog-json-input"
          v-model="pastedJSON"
          :label="t('payment.admin.catalogImport.pasteMode')"
          :placeholder="t('payment.admin.catalogImport.pastePlaceholder')"
          :disabled="busy"
          :rows="9"
          monospace
          spellcheck="false"
          @update:model-value="handlePastedJSONInput"
        />
        <AppInline justify="flex-end">
          <UiButton variant="secondary" density="compact" :disabled="!canPreviewPaste || busy" @click="previewPastedJSON">
            <template #icon><Icon name="search" size="sm" /></template>
            {{ t('payment.admin.catalogImport.previewPaste') }}
          </UiButton>
        </AppInline>
      </AppStack>

      <UiAlert v-if="clientError" tone="danger" :message="clientError" />
      <UiLoadingOverlay v-if="fileProcessing || previewing" :show="true" :label="t('payment.admin.catalogImport.previewing')">
        <UiSkeleton width="100%" height="160px" />
      </UiLoadingOverlay>

      <AppSection
        v-else-if="templateMappingVisible"
        :title="t('payment.admin.catalogImport.mappingTitle')"
        :description="t('payment.admin.catalogImport.mappingDescription')"
        divided
        data-testid="catalog-template-mapping"
      >
        <AppStack :gap="14">
          <UiDescriptionList :items="templateMappingFacts" :columns="2" />
          <UiSegmentedControl
            :model-value="templateBindingMode"
            :label="t('payment.admin.catalogImport.mappingTitle')"
            :options="templateBindingOptions"
            @update:model-value="updateTemplateBindingMode"
          />
          <UiAlert
            :message="templateBindingMode === 'shared'
              ? t('payment.admin.catalogImport.bindingSharedHint')
              : t('payment.admin.catalogImport.bindingPerPlanHint')"
          />

          <UiAlert v-if="eligibleTemplateGroups.length === 0" tone="warning" :message="t('payment.admin.catalogImport.templateNoSources')" />

          <template v-else-if="templateBindingMode === 'shared'">
            <AppInline justify="space-between">
              <UiBadge :label="t('payment.admin.catalogImport.selectedGroupCount', { count: sharedTemplateGroupIDs.length })" />
              <AppInline>
                <UiButton density="mini" variant="quiet" @click="selectAllTemplateGroups()">
                  {{ t('payment.admin.catalogImport.selectAllGroups') }}
                </UiButton>
                <UiButton density="mini" variant="quiet" @click="clearTemplateGroups()">
                  {{ t('payment.admin.catalogImport.clearGroups') }}
                </UiButton>
              </AppInline>
            </AppInline>
            <AppGrid min="260px" :gap="10">
              <UiCheckbox
                v-for="group in eligibleTemplateGroups"
                :key="group.id"
                :model-value="templateGroupSelected(group.id)"
                @update:model-value="toggleTemplateGroup(group.id)"
              >
                <UiDataCell :value="group.name" :meta="`${group.platform} · ${group.rate_multiplier}x`" />
              </UiCheckbox>
            </AppGrid>
          </template>

          <AppStack v-else :gap="16">
            <AppSection
              v-for="(plan, planIndex) in templatePlans"
              :key="`${plan.name}-${planIndex}`"
              :title="plan.name"
              :description="t('payment.admin.catalogImport.selectedGroupCount', { count: selectedTemplateGroupIDs(planIndex).length })"
              divided
            >
              <template #actions>
                <AppInline>
                  <UiButton density="mini" variant="quiet" @click="selectAllTemplateGroups(planIndex)">
                    {{ t('payment.admin.catalogImport.selectAllGroups') }}
                  </UiButton>
                  <UiButton density="mini" variant="quiet" @click="clearTemplateGroups(planIndex)">
                    {{ t('payment.admin.catalogImport.clearGroups') }}
                  </UiButton>
                </AppInline>
              </template>
              <AppGrid min="260px" :gap="10">
                <UiCheckbox
                  v-for="group in eligibleTemplateGroups"
                  :key="group.id"
                  :model-value="templateGroupSelected(group.id, planIndex)"
                  @update:model-value="toggleTemplateGroup(group.id, planIndex)"
                >
                  <UiDataCell :value="group.name" :meta="`${group.platform} · ${group.rate_multiplier}x`" />
                </UiCheckbox>
              </AppGrid>
            </AppSection>
          </AppStack>

          <UiAlert
            v-if="templateSourceSelection.omittedCount > 0"
            tone="warning"
            :message="t('payment.admin.catalogImport.templateGroupsOmitted', { count: templateSourceSelection.omittedCount })"
          />
          <UiAlert
            v-if="eligibleTemplateGroups.length > 0 && !templateMappingValid"
            tone="danger"
            :message="t('payment.admin.catalogImport.mappingRequired')"
          />
        </AppStack>
      </AppSection>

      <template v-else-if="preview">
        <UiReviewSummary
          :title="t('payment.admin.catalogImport.previewTitle')"
          :description="preview.can_apply ? t('payment.admin.catalogImport.ready') : t('payment.admin.catalogImport.blocked')"
          :valid="preview.can_apply"
          :items="reviewSummaryItems"
        >
          <UiButton v-if="templateDocument" density="compact" variant="secondary" @click="editTemplateMapping">
            <template #icon><Icon name="edit" size="xs" /></template>
            {{ t('payment.admin.catalogImport.editMapping') }}
          </UiButton>
        </UiReviewSummary>

        <AppSection v-if="preview.issues.length" :title="t('payment.admin.catalogImport.validationTitle')" divided>
          <AppStack :gap="8">
            <UiAlert
              v-for="(issue, index) in preview.issues"
              :key="`${issue.code}-${issue.path}-${index}`"
              :tone="issue.severity === 'error' ? 'danger' : 'warning'"
              :title="issueMessage(issue)"
              :message="issue.path || undefined"
            />
          </AppStack>
        </AppSection>

        <AppSection
          :title="t('payment.admin.catalogImport.changesTitle')"
          :description="t('payment.admin.catalogImport.changeCount', { count: preview.changes.length })"
          divided
        >
          <AppStack v-if="preview.changes.length" :gap="10">
            <AppSection
              v-for="change in preview.changes"
              :key="`${change.kind}-${change.key}`"
              :title="change.name"
              :description="kindLabel(change.kind)"
              divided
            >
              <template #actions>
                <AppInline>
                  <UiBadge :tone="actionBadgeTone(change.action)" :label="actionLabel(change.action)" />
                  <UiBadge
                    v-if="change.affected_subscriptions"
                    tone="warning"
                    :label="t('payment.admin.catalogImport.affectedSubscriptions', { count: change.affected_subscriptions })"
                  />
                </AppInline>
              </template>
              <UiChangeSet
                v-if="change.fields?.length"
                :title="t('payment.admin.catalogImport.changesTitle')"
                :changes="change.fields.map(field => ({
                  field: field.field,
                  label: fieldLabel(field.field),
                  before: formatDiffValue(field.before),
                  after: formatDiffValue(field.after),
                }))"
              />
            </AppSection>
          </AppStack>
          <UiEmptyState v-else :title="t('payment.admin.catalogImport.noChanges')" />
        </AppSection>
      </template>
    </AppStack>

    <template #footer>
      <AppInline justify="space-between">
        <span>{{ templateMappingVisible ? t('payment.admin.catalogImport.mappingFooter') : preview ? t('payment.admin.catalogImport.atomicNotice') : '' }}</span>
        <AppInline justify="flex-end">
          <UiButton type="button" variant="secondary" :disabled="applying" @click="handleClose">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            v-if="templateMappingVisible"
            type="button"
            variant="primary"
            density="compact"
            :disabled="!templateMappingValid || busy"
            @click="previewMappedTemplate"
          >
            <template #icon><Icon name="search" size="sm" /></template>
            {{ t('payment.admin.catalogImport.previewMapped') }}
          </UiButton>
          <UiButton
            v-if="preview"
            type="button"
            variant="primary"
            density="compact"
            :loading="applying"
            :disabled="!preview.can_apply || applying || previewing"
            @click="applyImport"
          >
            <template #icon><Icon :name="applying ? 'refresh' : 'check'" size="sm" /></template>
            {{ applying
              ? t('payment.admin.catalogImport.applying')
              : t('payment.admin.catalogImport.confirmApply') }}
          </UiButton>
        </AppInline>
      </AppInline>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import {
  AppGrid,
  AppInline,
  AppSection,
  AppStack,
  UiAlert,
  UiBadge,
  UiButton,
  UiChangeSet,
  UiCheckbox,
  UiDataCell,
  UiDescriptionList,
  UiDialog,
  UiEmptyState,
  UiFileUpload,
  UiLoadingOverlay,
  UiReviewSummary,
  UiSegmentedControl,
  UiSkeleton,
  UiTextArea,
} from '@/components/ui'
import { adminPaymentAPI } from '@/api/admin/payment'
import { useAppStore } from '@/stores/app'
import { extractI18nErrorMessage } from '@/utils/apiError'
import {
  isPaymentCatalogTemplate,
  isQiuapiFiveTierTemplate,
  personalizeCatalogTemplate,
  selectCatalogTemplateSources,
} from './catalogTemplate'
import type { PaymentCatalogTemplateDocument } from './catalogTemplate'
import type { AdminGroup } from '@/types'
import type {
  PaymentCatalogImportChange,
  PaymentCatalogImportIssue,
  PaymentCatalogImportPreview,
  PaymentCatalogImportRequest,
} from '@/types/payment'

const MAX_FILE_BYTES = 1024 * 1024
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
type CatalogInputMode = 'file' | 'paste'
type TemplateBindingMode = 'shared' | 'per_plan'

const props = withDefaults(defineProps<{
  show: boolean
  groups?: AdminGroup[]
}>(), {
  groups: () => [],
})
const emit = defineEmits<{
  close: []
  imported: []
}>()

const { t, te } = useI18n()
const appStore = useAppStore()
const inputMode = ref<CatalogInputMode>('file')
const selectedFile = ref<File | null>(null)
const pastedJSON = ref('')
const catalog = ref<PaymentCatalogImportRequest | null>(null)
const templateDocument = ref<PaymentCatalogTemplateDocument | null>(null)
const templateBindingMode = ref<TemplateBindingMode>('shared')
const sharedTemplateGroupIDs = ref<number[]>([])
const perPlanTemplateGroupIDs = ref<number[][]>([])
const preview = ref<PaymentCatalogImportPreview | null>(null)
const clientError = ref('')
const fileProcessing = ref(false)
const previewing = ref(false)
const applying = ref(false)
let previewSequence = 0

const busy = computed(() => fileProcessing.value || previewing.value || applying.value)
const canPreviewPaste = computed(() => pastedJSON.value.trim().length > 0)
const templatePlans = computed(() => templateDocument.value?.plans ?? [])
const templateSourceSelection = computed(() => templateDocument.value
  ? selectCatalogTemplateSources(templateDocument.value, props.groups)
  : { sources: [], omittedCount: 0 })
const eligibleTemplateGroups = computed(() => templateSourceSelection.value.sources)
const templateMappingVisible = computed(() => Boolean(templateDocument.value && !catalog.value))
const templateMappingValid = computed(() => {
  if (!templateDocument.value || eligibleTemplateGroups.value.length === 0) return false
  if (templateBindingMode.value === 'shared') return sharedTemplateGroupIDs.value.length > 0
  return templatePlans.value.every((_, index) => (perPlanTemplateGroupIDs.value[index]?.length ?? 0) > 0)
})
const inputModeOptions = computed(() => [
  { value: 'file', label: t('payment.admin.catalogImport.fileMode'), disabled: busy.value },
  { value: 'paste', label: t('payment.admin.catalogImport.pasteMode'), disabled: busy.value },
])
const templateBindingOptions = computed(() => [
  { value: 'shared', label: t('payment.admin.catalogImport.bindingShared'), disabled: busy.value },
  { value: 'per_plan', label: t('payment.admin.catalogImport.bindingPerPlan'), disabled: busy.value },
])
const templateMappingFacts = computed(() => [
  {
    label: t('payment.admin.catalogImport.templatePlanCount', { count: templatePlans.value.length }),
    value: templatePlans.value.length,
    numeric: true,
  },
  {
    label: t('payment.admin.catalogImport.eligibleGroupCount', { count: eligibleTemplateGroups.value.length }),
    value: eligibleTemplateGroups.value.length,
    numeric: true,
  },
])

const summaryItems = computed(() => {
  const summary = preview.value?.summary
  if (!summary) return []
  const detail = (created: number, updated: number, unchanged: number) =>
    t('payment.admin.catalogImport.summaryDetail', { created, updated, unchanged })
  return [
    {
      key: 'groups',
      label: t('payment.admin.catalogImport.summaryGroups'),
      value: summary.groups_created + summary.groups_updated,
      detail: detail(summary.groups_created, summary.groups_updated, summary.groups_unchanged),
    },
    {
      key: 'plans',
      label: t('payment.admin.catalogImport.summaryPlans'),
      value: summary.plans_created + summary.plans_updated,
      detail: detail(summary.plans_created, summary.plans_updated, summary.plans_unchanged),
    },
    {
      key: 'routes',
      label: t('payment.admin.catalogImport.summaryRoutes'),
      value: summary.routes_created + summary.routes_updated,
      detail: detail(summary.routes_created, summary.routes_updated, summary.routes_unchanged),
    },
    {
      key: 'bindings',
      label: t('payment.admin.catalogImport.summaryBindings'),
      value: summary.bindings_added,
      detail: t('payment.admin.catalogImport.summaryBindingsDetail'),
    },
    {
      key: 'settings',
      label: t('payment.admin.catalogImport.summarySettings'),
      value: summary.settings_updated,
      detail: t('payment.admin.catalogImport.summarySettingsDetail'),
    },
  ]
})
const reviewSummaryItems = computed(() => summaryItems.value.map(item => ({
  label: item.label,
  value: `${item.value} · ${item.detail}`,
})))

watch(
  () => props.show,
  (visible) => {
    if (visible) resetDialog()
  },
)

function resetDialog() {
  previewSequence += 1
  inputMode.value = 'file'
  selectedFile.value = null
  pastedJSON.value = ''
  catalog.value = null
  resetTemplateMapping()
  preview.value = null
  clientError.value = ''
  fileProcessing.value = false
  previewing.value = false
  applying.value = false
}

function resetTemplateMapping() {
  templateDocument.value = null
  templateBindingMode.value = 'shared'
  sharedTemplateGroupIDs.value = []
  perPlanTemplateGroupIDs.value = []
}

function initializeTemplateMapping(document: PaymentCatalogTemplateDocument) {
  templateDocument.value = document
  templateBindingMode.value = 'shared'
  const groupIDs = selectCatalogTemplateSources(document, props.groups).sources.map(group => group.id)
  sharedTemplateGroupIDs.value = [...groupIDs]
  perPlanTemplateGroupIDs.value = document.plans.map(() => [...groupIDs])
  catalog.value = null
  preview.value = null
  clientError.value = ''
}

function setTemplateBindingMode(mode: TemplateBindingMode) {
  if (busy.value || templateBindingMode.value === mode) return
  templateBindingMode.value = mode
}

function updateTemplateBindingMode(value: string | number) {
  if (value === 'shared' || value === 'per_plan') setTemplateBindingMode(value)
}

function selectedTemplateGroupIDs(planIndex?: number): number[] {
  if (planIndex === undefined) return sharedTemplateGroupIDs.value
  return perPlanTemplateGroupIDs.value[planIndex] ?? []
}

function templateGroupSelected(groupID: number, planIndex?: number): boolean {
  return selectedTemplateGroupIDs(planIndex).includes(groupID)
}

function setTemplateGroupSelection(groupIDs: number[], planIndex?: number) {
  const next = [...new Set(groupIDs)]
  if (planIndex === undefined) {
    sharedTemplateGroupIDs.value = next
    return
  }
  perPlanTemplateGroupIDs.value = perPlanTemplateGroupIDs.value.map((current, index) => (
    index === planIndex ? next : current
  ))
}

function toggleTemplateGroup(groupID: number, planIndex?: number) {
  const selected = selectedTemplateGroupIDs(planIndex)
  setTemplateGroupSelection(
    selected.includes(groupID)
      ? selected.filter(id => id !== groupID)
      : [...selected, groupID],
    planIndex,
  )
}

function selectAllTemplateGroups(planIndex?: number) {
  setTemplateGroupSelection(eligibleTemplateGroups.value.map(group => group.id), planIndex)
}

function clearTemplateGroups(planIndex?: number) {
  setTemplateGroupSelection([], planIndex)
}

async function previewMappedTemplate() {
  if (!templateDocument.value || !templateMappingValid.value || busy.value) return
  const shared = [...sharedTemplateGroupIDs.value]
  const groupIDsByPlan = templateDocument.value.plans.map((_, index) => (
    templateBindingMode.value === 'shared'
      ? shared
      : [...(perPlanTemplateGroupIDs.value[index] ?? [])]
  ))
  catalog.value = personalizeCatalogTemplate(
    templateDocument.value,
    props.groups,
    { groupIDsByPlan },
  ).catalog
  preview.value = null
  await requestPreview()
}

function editTemplateMapping() {
  if (!templateDocument.value || applying.value) return
  previewSequence += 1
  catalog.value = null
  preview.value = null
  clientError.value = ''
  previewing.value = false
}

function setInputMode(mode: CatalogInputMode) {
  if (busy.value || inputMode.value === mode) return
  previewSequence += 1
  inputMode.value = mode
  selectedFile.value = null
  catalog.value = null
  resetTemplateMapping()
  preview.value = null
  clientError.value = ''
  fileProcessing.value = false
  previewing.value = false
}

function updateInputMode(value: string | number) {
  if (value === 'file' || value === 'paste') setInputMode(value)
}

function handlePastedJSONInput() {
  previewSequence += 1
  selectedFile.value = null
  catalog.value = null
  resetTemplateMapping()
  preview.value = null
  clientError.value = ''
  fileProcessing.value = false
  previewing.value = false
}

function handleClose() {
  if (applying.value) return
  emit('close')
}

function handleSelectedFiles(files: File[]) {
  if (busy.value) return
  if (files.length !== 1) {
    clientError.value = t('payment.admin.catalogImport.singleFileOnly')
    return
  }
  const file = files[0]
  if (file) void selectFile(file)
}

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  if (typeof file.arrayBuffer === 'function') {
    return new TextDecoder().decode(await file.arrayBuffer())
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

function dangerousJSONPath(value: unknown): string | null {
  const stack: Array<{ value: unknown; path: string }> = [{ value, path: '$' }]
  let visited = 0
  while (stack.length) {
    const current = stack.pop()
    if (!current || current.value === null || typeof current.value !== 'object') continue
    visited += 1
    if (visited > 50_000) return '$'
    for (const key of Object.keys(current.value as Record<string, unknown>)) {
      const path = `${current.path}.${key}`
      if (FORBIDDEN_KEYS.has(key)) return path
      stack.push({ value: (current.value as Record<string, unknown>)[key], path })
    }
  }
  return null
}

async function parseAndPreviewCatalogText(text: string, selection: number, file: File | null) {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    if (selection === previewSequence) clientError.value = t('payment.admin.catalogImport.invalidJSON')
    return
  }
  if (selection !== previewSequence) return
  const dangerousPath = dangerousJSONPath(parsed)
  if (dangerousPath) {
    clientError.value = t('payment.admin.catalogImport.dangerousField', { path: dangerousPath })
    return
  }
  if (!isPaymentCatalogTemplate(parsed)) {
    clientError.value = t('payment.admin.catalogImport.invalidStructure')
    return
  }

  if (isQiuapiFiveTierTemplate(parsed)) {
    selectedFile.value = file
    initializeTemplateMapping(parsed)
    fileProcessing.value = false
    return
  }

  selectedFile.value = file
  resetTemplateMapping()
  catalog.value = parsed
  fileProcessing.value = false
  await requestPreview()
}

async function selectFile(file: File) {
  const selection = ++previewSequence
  selectedFile.value = null
  clientError.value = ''
  preview.value = null
  catalog.value = null
  previewing.value = false
  fileProcessing.value = true
  try {
    const isJSON = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json'
    if (!isJSON) {
      clientError.value = t('payment.admin.catalogImport.invalidType')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      clientError.value = t('payment.admin.catalogImport.fileTooLarge')
      return
    }

    await parseAndPreviewCatalogText(await readFileAsText(file), selection, file)
  } finally {
    if (selection === previewSequence) fileProcessing.value = false
  }
}

async function previewPastedJSON() {
  const text = pastedJSON.value
  const selection = ++previewSequence
  selectedFile.value = null
  clientError.value = ''
  preview.value = null
  catalog.value = null
  previewing.value = false
  fileProcessing.value = true
  try {
    if (text.trim() === '') {
      clientError.value = t('payment.admin.catalogImport.pasteRequired')
      return
    }
    if (new Blob([text]).size > MAX_FILE_BYTES) {
      clientError.value = t('payment.admin.catalogImport.fileTooLarge')
      return
    }
    await parseAndPreviewCatalogText(text, selection, null)
  } finally {
    if (selection === previewSequence) fileProcessing.value = false
  }
}

async function requestPreview() {
  if (!catalog.value) return
  const sequence = ++previewSequence
  previewing.value = true
  clientError.value = ''
  try {
    const response = await adminPaymentAPI.previewCatalogImport(catalog.value)
    if (sequence === previewSequence) {
      const rawPreview = response.data as PaymentCatalogImportPreview & {
        issues?: PaymentCatalogImportIssue[] | null
        changes?: PaymentCatalogImportChange[] | null
      }
      preview.value = {
        ...rawPreview,
        issues: rawPreview.issues ?? [],
        changes: rawPreview.changes ?? [],
      }
    }
  } catch (error: unknown) {
    if (sequence === previewSequence) {
      preview.value = null
      if (templateDocument.value) catalog.value = null
      clientError.value = extractI18nErrorMessage(
        error,
        t,
        'payment.admin.catalogImport.errors',
        t('payment.admin.catalogImport.previewFailed'),
      )
    }
  } finally {
    if (sequence === previewSequence) previewing.value = false
  }
}

async function applyImport() {
  if (!catalog.value || !preview.value?.can_apply || applying.value) return
  applying.value = true
  try {
    await adminPaymentAPI.applyCatalogImport(catalog.value, preview.value.preview_token)
    appStore.showSuccess(t('payment.admin.catalogImport.success'))
    emit('imported')
    emit('close')
  } catch (error: unknown) {
    appStore.showError(extractI18nErrorMessage(
      error,
      t,
      'payment.admin.catalogImport.errors',
      t('payment.admin.catalogImport.applyFailed'),
    ))
    await requestPreview()
  } finally {
    applying.value = false
  }
}

function issueMessage(issue: PaymentCatalogImportIssue): string {
  const key = `payment.admin.catalogImport.issueCodes.${issue.code}`
  return te(key) ? t(key) : issue.message
}

function actionBadgeTone(action: PaymentCatalogImportChange['action']): 'success' | 'info' | 'neutral' {
  if (action === 'create') return 'success'
  if (action === 'update') return 'info'
  return 'neutral'
}

function actionLabel(action: PaymentCatalogImportChange['action']): string {
  return t(`payment.admin.catalogImport.actions.${action}`)
}

function kindLabel(kind: PaymentCatalogImportChange['kind']): string {
  return t(`payment.admin.catalogImport.kinds.${kind}`)
}

function fieldLabel(field: string): string {
  const key = `payment.admin.catalogImport.fields.${field}`
  return te(key) ? t(key) : field
}

function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return t('payment.admin.catalogImport.emptyValue')
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : t('payment.admin.catalogImport.emptyValue')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
</script>
