<template>
  <BaseDialog
    :show="show"
    :title="t('payment.admin.catalogImport.title')"
    width="extra-wide"
    :close-on-escape="!applying"
    :show-close-button="!applying"
    @close="handleClose"
  >
    <div class="space-y-4">
      <div class="border-b border-gray-200 pb-4 dark:border-dark-700">
        <p class="text-sm leading-6 text-gray-600 dark:text-gray-300">
          {{ t('payment.admin.catalogImport.description') }}
        </p>
        <div class="mt-3 flex items-start gap-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
          <Icon name="shield" size="sm" class="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{{ t('payment.admin.catalogImport.securityNotice') }}</span>
        </div>
      </div>

      <div class="inline-flex rounded-[4px] border border-gray-200 bg-gray-50 p-0.5 dark:border-dark-700 dark:bg-dark-800" role="tablist">
        <button
          type="button"
          role="tab"
          class="inline-flex min-h-8 items-center rounded-[3px] px-3 text-xs font-medium transition-colors"
          :class="inputMode === 'file' ? 'bg-white text-blue-700 shadow-sm dark:bg-dark-700 dark:text-blue-300' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
          :aria-selected="inputMode === 'file'"
          :disabled="busy"
          @click="setInputMode('file')"
        >
          <Icon name="upload" size="xs" class="mr-1.5" />
          {{ t('payment.admin.catalogImport.fileMode') }}
        </button>
        <button
          type="button"
          role="tab"
          class="inline-flex min-h-8 items-center rounded-[3px] px-3 text-xs font-medium transition-colors"
          :class="inputMode === 'paste' ? 'bg-white text-blue-700 shadow-sm dark:bg-dark-700 dark:text-blue-300' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
          :aria-selected="inputMode === 'paste'"
          :disabled="busy"
          @click="setInputMode('paste')"
        >
          <Icon name="clipboard" size="xs" class="mr-1.5" />
          {{ t('payment.admin.catalogImport.pasteMode') }}
        </button>
      </div>

      <template v-if="inputMode === 'file'">
        <button
          type="button"
          class="flex min-h-28 w-full items-center justify-center border border-dashed px-4 py-5 text-left transition-colors"
          :class="dropZoneClass"
          :disabled="busy"
          @click="openFilePicker"
          @dragenter.prevent="handleDragEnter"
          @dragover.prevent
          @dragleave.prevent="handleDragLeave"
          @drop.prevent="handleDrop"
        >
          <span class="flex min-w-0 items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300">
              <Icon name="upload" size="lg" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-gray-900 dark:text-white" :title="selectedFile?.name">
                {{ selectedFile?.name || t('payment.admin.catalogImport.selectFile') }}
              </span>
              <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                {{ selectedFile
                  ? t('payment.admin.catalogImport.replaceFile')
                  : t('payment.admin.catalogImport.fileHint') }}
              </span>
            </span>
          </span>
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          :disabled="busy"
          @change="handleFileChange"
        />
      </template>

      <div v-else class="space-y-2">
        <label for="catalog-json-input" class="sr-only">{{ t('payment.admin.catalogImport.pasteMode') }}</label>
        <textarea
          id="catalog-json-input"
          v-model="pastedJSON"
          rows="9"
          class="w-full resize-y rounded-[4px] border border-gray-300 bg-white px-3 py-2.5 font-mono text-xs leading-5 text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-200 dark:placeholder:text-gray-500 dark:disabled:bg-dark-900"
          :placeholder="t('payment.admin.catalogImport.pastePlaceholder')"
          :disabled="busy"
          spellcheck="false"
          @input="handlePastedJSONInput"
        />
        <div class="flex justify-end">
          <button
            type="button"
            class="btn btn-secondary whitespace-nowrap"
            :disabled="!canPreviewPaste || busy"
            @click="previewPastedJSON"
          >
            <Icon name="search" size="sm" class="mr-1.5" />
            {{ t('payment.admin.catalogImport.previewPaste') }}
          </button>
        </div>
      </div>

      <div
        v-if="clientError"
        class="flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-900/15 dark:text-red-300"
        role="alert"
      >
        <Icon name="exclamationCircle" size="sm" class="mt-0.5 shrink-0" />
        <span class="break-words">{{ clientError }}</span>
      </div>

      <div v-if="fileProcessing || previewing" class="flex min-h-40 items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Icon name="refresh" size="md" class="animate-spin" />
        <span>{{ t('payment.admin.catalogImport.previewing') }}</span>
      </div>

      <section
        v-else-if="templateMappingVisible"
        class="border-y border-gray-200 py-4 dark:border-dark-700"
        aria-labelledby="catalog-template-groups"
        data-testid="catalog-template-mapping"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h4 id="catalog-template-groups" class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('payment.admin.catalogImport.mappingTitle') }}
            </h4>
            <p class="mt-1 max-w-3xl text-xs leading-5 text-gray-500 dark:text-gray-400">
              {{ t('payment.admin.catalogImport.mappingDescription') }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ t('payment.admin.catalogImport.templatePlanCount', { count: templatePlans.length }) }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ t('payment.admin.catalogImport.eligibleGroupCount', { count: eligibleTemplateGroups.length }) }}</span>
          </div>
        </div>

        <div class="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-dark-700 sm:flex-row sm:items-center sm:justify-between">
          <div class="inline-flex w-fit rounded-[4px] border border-gray-200 bg-gray-50 p-0.5 dark:border-dark-700 dark:bg-dark-800" role="tablist">
            <button
              type="button"
              role="tab"
              class="min-h-8 rounded-[3px] px-3 text-xs font-medium transition-colors"
              :class="templateBindingMode === 'shared' ? 'bg-white text-blue-700 shadow-sm dark:bg-dark-700 dark:text-blue-300' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
              :aria-selected="templateBindingMode === 'shared'"
              @click="setTemplateBindingMode('shared')"
            >
              {{ t('payment.admin.catalogImport.bindingShared') }}
            </button>
            <button
              type="button"
              role="tab"
              class="min-h-8 rounded-[3px] px-3 text-xs font-medium transition-colors"
              :class="templateBindingMode === 'per_plan' ? 'bg-white text-blue-700 shadow-sm dark:bg-dark-700 dark:text-blue-300' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
              :aria-selected="templateBindingMode === 'per_plan'"
              @click="setTemplateBindingMode('per_plan')"
            >
              {{ t('payment.admin.catalogImport.bindingPerPlan') }}
            </button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ templateBindingMode === 'shared'
              ? t('payment.admin.catalogImport.bindingSharedHint')
              : t('payment.admin.catalogImport.bindingPerPlanHint') }}
          </p>
        </div>

        <div
          v-if="eligibleTemplateGroups.length === 0"
          class="mt-4 flex items-start gap-2 border-l-2 border-amber-400 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-800 dark:bg-amber-900/10 dark:text-amber-200"
          role="alert"
        >
          <Icon name="exclamationTriangle" size="sm" class="mt-0.5 shrink-0" />
          <span>{{ t('payment.admin.catalogImport.templateNoSources') }}</span>
        </div>

        <template v-else-if="templateBindingMode === 'shared'">
          <div class="mt-4 flex items-center justify-between gap-3">
            <span class="text-xs font-medium text-gray-700 dark:text-gray-300">
              {{ t('payment.admin.catalogImport.selectedGroupCount', { count: sharedTemplateGroupIDs.length }) }}
            </span>
            <div class="flex items-center gap-3 text-xs">
              <button type="button" class="text-blue-600 hover:text-blue-700 dark:text-blue-400" @click="selectAllTemplateGroups()">
                {{ t('payment.admin.catalogImport.selectAllGroups') }}
              </button>
              <button type="button" class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" @click="clearTemplateGroups()">
                {{ t('payment.admin.catalogImport.clearGroups') }}
              </button>
            </div>
          </div>
          <div class="mt-2 grid max-h-60 grid-cols-1 overflow-y-auto border-y border-gray-100 dark:border-dark-700 sm:grid-cols-2">
            <label
              v-for="group in eligibleTemplateGroups"
              :key="group.id"
              class="flex min-w-0 cursor-pointer items-center gap-2 border-b border-gray-100 px-2 py-2 last:border-b-0 dark:border-dark-700"
              :title="group.name"
            >
              <input
                type="checkbox"
                class="h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                :checked="templateGroupSelected(group.id)"
                @change="toggleTemplateGroup(group.id)"
              />
              <GroupBadge class="min-w-0 max-w-full" :name="group.name" :platform="group.platform" :rate-multiplier="group.rate_multiplier" />
            </label>
          </div>
        </template>

        <div v-else class="mt-4 max-h-[30rem] divide-y divide-gray-100 overflow-y-auto border-y border-gray-100 dark:divide-dark-700 dark:border-dark-700">
          <section v-for="(plan, planIndex) in templatePlans" :key="`${plan.name}-${planIndex}`" class="py-3">
            <div class="flex flex-wrap items-center justify-between gap-2 px-2">
              <div class="min-w-0">
                <h5 class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="plan.name">{{ plan.name }}</h5>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('payment.admin.catalogImport.selectedGroupCount', { count: selectedTemplateGroupIDs(planIndex).length }) }}
                </p>
              </div>
              <div class="flex items-center gap-3 text-xs">
                <button type="button" class="text-blue-600 hover:text-blue-700 dark:text-blue-400" @click="selectAllTemplateGroups(planIndex)">
                  {{ t('payment.admin.catalogImport.selectAllGroups') }}
                </button>
                <button type="button" class="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" @click="clearTemplateGroups(planIndex)">
                  {{ t('payment.admin.catalogImport.clearGroups') }}
                </button>
              </div>
            </div>
            <div class="mt-2 grid grid-cols-1 sm:grid-cols-2">
              <label
                v-for="group in eligibleTemplateGroups"
                :key="group.id"
                class="flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1.5"
                :title="group.name"
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  :checked="templateGroupSelected(group.id, planIndex)"
                  @change="toggleTemplateGroup(group.id, planIndex)"
                />
                <GroupBadge class="min-w-0 max-w-full" :name="group.name" :platform="group.platform" :rate-multiplier="group.rate_multiplier" />
              </label>
            </div>
          </section>
        </div>

        <p v-if="templateSourceSelection.omittedCount > 0" class="mt-3 text-xs text-amber-700 dark:text-amber-300">
          {{ t('payment.admin.catalogImport.templateGroupsOmitted', { count: templateSourceSelection.omittedCount }) }}
        </p>
        <p v-if="eligibleTemplateGroups.length > 0 && !templateMappingValid" class="mt-3 text-xs text-red-600 dark:text-red-300" role="alert">
          {{ t('payment.admin.catalogImport.mappingRequired') }}
        </p>
      </section>

      <template v-else-if="preview">
        <section aria-labelledby="catalog-import-summary">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h4 id="catalog-import-summary" class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('payment.admin.catalogImport.previewTitle') }}
            </h4>
            <div class="flex items-center gap-2">
              <button v-if="templateDocument" type="button" class="btn btn-ghost min-h-8 px-2 text-xs" @click="editTemplateMapping">
                <Icon name="edit" size="xs" class="mr-1" />
                {{ t('payment.admin.catalogImport.editMapping') }}
              </button>
              <span
                class="badge"
                :class="preview.can_apply ? 'badge-success' : 'badge-danger'"
              >
                {{ preview.can_apply
                  ? t('payment.admin.catalogImport.ready')
                  : t('payment.admin.catalogImport.blocked') }}
              </span>
            </div>
          </div>
          <dl class="grid grid-cols-2 divide-x divide-y divide-gray-200 border border-gray-200 bg-white dark:divide-dark-700 dark:border-dark-700 dark:bg-dark-800 sm:grid-cols-3 lg:grid-cols-5">
            <div v-for="item in summaryItems" :key="item.key" class="min-w-0 px-3 py-3">
              <dt class="truncate text-xs text-gray-500 dark:text-gray-400" :title="item.label">{{ item.label }}</dt>
              <dd class="mt-1 text-lg font-semibold tabular-nums" :class="item.tone">{{ item.value }}</dd>
              <dd class="mt-0.5 truncate text-[11px] text-gray-400" :title="item.detail">{{ item.detail }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="preview.issues.length" aria-labelledby="catalog-import-issues">
          <h4 id="catalog-import-issues" class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('payment.admin.catalogImport.validationTitle') }}
          </h4>
          <div class="divide-y divide-gray-200 border border-gray-200 dark:divide-dark-700 dark:border-dark-700">
            <div
              v-for="(issue, index) in preview.issues"
              :key="`${issue.code}-${issue.path}-${index}`"
              class="flex items-start gap-2 px-3 py-2.5 text-sm"
              :class="issue.severity === 'error'
                ? 'bg-red-50/70 text-red-700 dark:bg-red-900/10 dark:text-red-300'
                : 'bg-amber-50/70 text-amber-700 dark:bg-amber-900/10 dark:text-amber-300'"
            >
              <Icon
                :name="issue.severity === 'error' ? 'xCircle' : 'exclamationTriangle'"
                size="sm"
                class="mt-0.5 shrink-0"
              />
              <div class="min-w-0">
                <p class="break-words">{{ issueMessage(issue) }}</p>
                <p v-if="issue.path" class="mt-0.5 break-all font-mono text-[11px] opacity-70">{{ issue.path }}</p>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="catalog-import-changes">
          <div class="mb-2 flex items-center justify-between gap-3">
            <h4 id="catalog-import-changes" class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('payment.admin.catalogImport.changesTitle') }}
            </h4>
            <span class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              {{ t('payment.admin.catalogImport.changeCount', { count: preview.changes.length }) }}
            </span>
          </div>
          <div v-if="preview.changes.length" class="max-h-72 divide-y divide-gray-200 overflow-y-auto border border-gray-200 dark:divide-dark-700 dark:border-dark-700">
            <div v-for="change in preview.changes" :key="`${change.kind}-${change.key}`" class="px-3 py-2.5">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <span class="badge" :class="actionBadgeClass(change.action)">{{ actionLabel(change.action) }}</span>
                <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ kindLabel(change.kind) }}</span>
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white" :title="change.name">
                  {{ change.name }}
                </span>
                <span v-if="change.affected_subscriptions" class="text-xs text-amber-700 dark:text-amber-300">
                  {{ t('payment.admin.catalogImport.affectedSubscriptions', { count: change.affected_subscriptions }) }}
                </span>
              </div>
              <div v-if="change.fields?.length" class="mt-2 space-y-1 border-l-2 border-gray-200 pl-2.5 text-xs dark:border-dark-600">
                <p v-for="field in change.fields" :key="field.field" class="break-words text-gray-600 dark:text-gray-300">
                  <span class="font-medium text-gray-800 dark:text-gray-200">{{ fieldLabel(field.field) }}:</span>
                  <span class="ml-1 text-gray-400">{{ formatDiffValue(field.before) }}</span>
                  <Icon name="arrowRight" size="xs" class="mx-1 inline-block align-[-2px] text-gray-400" />
                  <span>{{ formatDiffValue(field.after) }}</span>
                </p>
              </div>
            </div>
          </div>
          <p v-else class="border border-gray-200 px-3 py-5 text-center text-sm text-gray-500 dark:border-dark-700 dark:text-gray-400">
            {{ t('payment.admin.catalogImport.noChanges') }}
          </p>
        </section>
      </template>
    </div>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p v-if="templateMappingVisible" class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('payment.admin.catalogImport.mappingFooter') }}
        </p>
        <p v-else-if="preview" class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('payment.admin.catalogImport.atomicNotice') }}
        </p>
        <span v-else class="hidden sm:block" />
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="btn btn-secondary w-full sm:w-auto" :disabled="applying" @click="handleClose">
            {{ t('common.cancel') }}
          </button>
          <button
            v-if="templateMappingVisible"
            type="button"
            class="btn btn-primary w-full whitespace-nowrap sm:w-auto"
            :disabled="!templateMappingValid || busy"
            @click="previewMappedTemplate"
          >
            <Icon name="search" size="sm" class="mr-1.5" />
            {{ t('payment.admin.catalogImport.previewMapped') }}
          </button>
          <button
            v-if="preview"
            type="button"
            class="btn btn-primary w-full whitespace-nowrap sm:w-auto"
            :disabled="!preview.can_apply || applying || previewing"
            @click="applyImport"
          >
            <Icon :name="applying ? 'refresh' : 'check'" size="sm" class="mr-1.5" :class="applying ? 'animate-spin' : ''" />
            {{ applying
              ? t('payment.admin.catalogImport.applying')
              : t('payment.admin.catalogImport.confirmApply') }}
          </button>
        </div>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import GroupBadge from '@/components/common/GroupBadge.vue'
import Icon from '@/components/icons/Icon.vue'
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
const fileInput = ref<HTMLInputElement | null>(null)
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
const dragDepth = ref(0)
let previewSequence = 0

const busy = computed(() => fileProcessing.value || previewing.value || applying.value)
const canPreviewPaste = computed(() => pastedJSON.value.trim().length > 0)
const dragActive = computed(() => dragDepth.value > 0)
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
const dropZoneClass = computed(() => {
  if (busy.value) return 'cursor-wait border-gray-200 bg-gray-50 opacity-70 dark:border-dark-700 dark:bg-dark-800'
  if (dragActive.value) return 'border-blue-400 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-900/15'
  return 'cursor-pointer border-gray-300 bg-gray-50/60 hover:border-blue-400 hover:bg-blue-50/50 dark:border-dark-600 dark:bg-dark-800/60 dark:hover:border-blue-500 dark:hover:bg-blue-900/10'
})

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
      tone: 'text-blue-600 dark:text-blue-300',
    },
    {
      key: 'plans',
      label: t('payment.admin.catalogImport.summaryPlans'),
      value: summary.plans_created + summary.plans_updated,
      detail: detail(summary.plans_created, summary.plans_updated, summary.plans_unchanged),
      tone: 'text-violet-600 dark:text-violet-300',
    },
    {
      key: 'routes',
      label: t('payment.admin.catalogImport.summaryRoutes'),
      value: summary.routes_created + summary.routes_updated,
      detail: detail(summary.routes_created, summary.routes_updated, summary.routes_unchanged),
      tone: 'text-cyan-600 dark:text-cyan-300',
    },
    {
      key: 'bindings',
      label: t('payment.admin.catalogImport.summaryBindings'),
      value: summary.bindings_added,
      detail: t('payment.admin.catalogImport.summaryBindingsDetail'),
      tone: 'text-emerald-600 dark:text-emerald-300',
    },
    {
      key: 'settings',
      label: t('payment.admin.catalogImport.summarySettings'),
      value: summary.settings_updated,
      detail: t('payment.admin.catalogImport.summarySettingsDetail'),
      tone: 'text-amber-600 dark:text-amber-300',
    },
  ]
})

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
  dragDepth.value = 0
  if (fileInput.value) fileInput.value.value = ''
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
  dragDepth.value = 0
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

function openFilePicker() {
  if (!busy.value) fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void selectFile(file)
}

function handleDragEnter() {
  if (!busy.value) dragDepth.value += 1
}

function handleDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function handleDrop(event: DragEvent) {
  dragDepth.value = 0
  if (busy.value) return
  const files = Array.from(event.dataTransfer?.files || [])
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

function actionBadgeClass(action: PaymentCatalogImportChange['action']): string {
  if (action === 'create') return 'badge-success'
  if (action === 'update') return 'badge-primary'
  return 'badge-gray'
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
