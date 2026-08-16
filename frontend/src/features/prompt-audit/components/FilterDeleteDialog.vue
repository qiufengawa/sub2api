<template>
  <UiDialog
    :show="show"
    :title="t('admin.promptAudit.events.filterDeleteDialogTitle')"
    :close-label="t('common.close')"
    width="wide"
    @close="emit('close')"
  >
    <div class="prompt-delete">
      <p class="prompt-delete__description">{{ t('admin.promptAudit.events.filterDeleteDialogDesc') }}</p>

      <div class="prompt-delete__range">
        <UiRadioGroup
          name="prompt-delete-range"
          layout="grid"
          :model-value="preset"
          :label="t('admin.promptAudit.events.filterTimeRange')"
          :options="rangeOptions"
          @update:model-value="updatePreset"
        />
        <p>{{ t('admin.promptAudit.events.filterTimeRangeHint') }}</p>
        <div v-if="preset === 'custom'" class="prompt-delete__custom" data-test="custom-range">
          <UiTextField
            v-model="local.start_at"
            type="datetime-local"
            density="compact"
            :label="t('admin.promptAudit.events.startAt')"
            :input-attrs="{ 'aria-label': t('admin.promptAudit.events.startAt') }"
            @change="criteriaChanged"
          />
          <UiTextField
            v-model="local.end_at"
            type="datetime-local"
            density="compact"
            :label="t('admin.promptAudit.events.endAt')"
            :input-attrs="{ 'aria-label': t('admin.promptAudit.events.endAt') }"
            @change="criteriaChanged"
          />
          <UiAlert v-if="!canPreview" class="prompt-delete__custom-error" tone="danger" :message="t('admin.promptAudit.events.customRangeInvalid')" />
        </div>
      </div>

      <div class="prompt-delete__selectors">
        <UiSelect v-model="local.decision" data-test="delete-decision" density="compact" :label="t('admin.promptAudit.events.decision')" :options="decisionOptions" @change="criteriaChanged" />
        <UiSelect v-model="local.risk_level" data-test="delete-risk" density="compact" :label="t('admin.promptAudit.events.risk')" :options="riskOptions" @change="criteriaChanged" />
      </div>

      <UiAccordion data-test="more-conditions" :items="moreConditionItems">
        <template #conditions>
          <div class="prompt-delete__conditions">
            <UiTextField v-model="local.endpoint" density="compact" :label="t('admin.promptAudit.events.endpoint')" :input-attrs="{ 'aria-label': t('admin.promptAudit.events.endpoint') }" @input="criteriaChanged" />
            <UiTextField v-model="local.keyword" density="compact" :label="t('admin.promptAudit.events.keyword')" :input-attrs="{ 'aria-label': t('admin.promptAudit.events.keyword') }" @input="criteriaChanged" />
            <UiTextField v-model="local.group_id" type="number" density="compact" :label="t('admin.promptAudit.events.groupId')" :input-attrs="{ 'aria-label': t('admin.promptAudit.events.groupId') }" @input="criteriaChanged" />
            <UiTextField v-model="local.user_id" type="number" density="compact" :label="t('admin.promptAudit.events.userId')" :input-attrs="{ 'aria-label': t('admin.promptAudit.events.userId') }" @input="criteriaChanged" />
          </div>
        </template>
      </UiAccordion>

      <div v-if="preview" class="prompt-delete__preview" data-test="delete-preview-result">
        <UiAlert tone="danger" :message="t('admin.promptAudit.events.filterDeleteCount', { count: preview.matched_count })" />
        <UiDescriptionList :items="previewFacts" :columns="1" />
        <UiAlert tone="warning" :message="t('admin.promptAudit.events.filterDeleteWarning')" />
      </div>
      <UiEmptyState v-else data-test="delete-preview-empty" :title="t('admin.promptAudit.events.filterDeleteNeedPreview')" />
    </div>

    <template #footer>
      <div class="prompt-delete__footer">
        <p v-if="confirmDisabledReason" data-test="confirm-disabled-reason">{{ t(confirmDisabledReason) }}</p>
        <UiButton @click="emit('close')">{{ t('common.cancel') }}</UiButton>
        <UiButton
          :disabled="!canPreview || deleting"
          :loading="previewing"
          data-test="run-delete-preview"
          @click="requestPreview"
        >
          {{ previewing ? t('admin.promptAudit.events.filterDeletePreviewing') : t('admin.promptAudit.events.filterDeletePreviewAction') }}
        </UiButton>
        <UiButton
          variant="danger"
          :disabled="confirmDisabled"
          :loading="deleting"
          :title="confirmDisabledReason ? t(confirmDisabledReason) : undefined"
          data-test="confirm-filter-delete"
          @click="requestConfirm"
        >
          {{ deleting ? t('common.submitting') : t('admin.promptAudit.events.confirmFilterDelete') }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiAccordion, UiAlert, UiButton, UiDescriptionList, UiDialog, UiEmptyState, UiRadioGroup, UiSelect, UiTextField } from '@/components/ui'
import type { PromptDeletePreview, PromptEventFilters } from '../types'
import {
  DELETE_RANGE_PRESETS,
  cloneData,
  emptyEventFilters,
  hasExplicitDeleteRange,
  resolveDeleteRangeFilters,
  type DeleteRangePreset,
} from '../viewModel'

const props = defineProps<{
  show: boolean
  initialFilters: PromptEventFilters
  preview: PromptDeletePreview | null
  previewing: boolean
  deleting: boolean
}>()
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'preview', value: PromptEventFilters): void
  (event: 'confirm', value: PromptEventFilters): void
  (event: 'criteria-change'): void
}>()
const { t, locale } = useI18n()
const preset = ref<DeleteRangePreset>('7d')
const local = reactive<PromptEventFilters>(emptyEventFilters())

const rangeOptions = computed(() => DELETE_RANGE_PRESETS.map((option) => ({
  value: option.id,
  label: t(`admin.promptAudit.events.timePresets.${option.id}`),
  dataTest: `range-preset-${option.id}`,
})))
const decisionOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'pass', label: t('admin.promptAudit.decisions.pass') },
  { value: 'flag', label: t('admin.promptAudit.decisions.flag') },
  { value: 'critical', label: t('admin.promptAudit.decisions.critical') },
])
const riskOptions = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'low', label: t('admin.promptAudit.riskLevels.low') },
  { value: 'medium', label: t('admin.promptAudit.riskLevels.medium') },
  { value: 'high', label: t('admin.promptAudit.riskLevels.high') },
  { value: 'critical', label: t('admin.promptAudit.riskLevels.critical') },
])
const moreConditionItems = computed(() => [{ key: 'conditions', title: t('admin.promptAudit.events.moreConditions') }])
const previewFacts = computed(() => props.preview ? [
  { label: t('admin.promptAudit.events.snapshotMax'), value: props.preview.snapshot_max_id, numeric: true },
  { label: 'Filter SHA-256', value: props.preview.filter_hash },
  { label: t('admin.promptAudit.events.expiresAt'), value: formatDate(props.preview.expires_at) },
] : [])

watch(() => props.show, (visible) => {
  if (!visible) return
  const initial = cloneData(props.initialFilters)
  preset.value = hasExplicitDeleteRange(initial) ? 'custom' : '7d'
  Object.assign(local, initial)
}, { immediate: true })

const canPreview = computed(() => preset.value !== 'custom' || hasExplicitDeleteRange(local))
const confirmDisabled = computed(() => !canPreview.value || props.previewing || props.deleting || (props.preview !== null && props.preview.matched_count === 0))
const confirmDisabledReason = computed(() => {
  if (props.previewing || props.deleting) return ''
  if (!canPreview.value) return 'admin.promptAudit.events.filterDeleteConfirmInvalidRange'
  if (props.preview && props.preview.matched_count === 0) return 'admin.promptAudit.events.filterDeleteConfirmNoMatches'
  return ''
})

function updatePreset(value: string | number) {
  preset.value = value as DeleteRangePreset
  criteriaChanged()
}
function criteriaChanged() { emit('criteria-change') }
function requestPreview() {
  if (canPreview.value) emit('preview', resolveDeleteRangeFilters(local, preset.value))
}
function requestConfirm() {
  if (!confirmDisabled.value) emit('confirm', resolveDeleteRangeFilters(local, preset.value))
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}
</script>

<style scoped>
.prompt-delete{display:grid;gap:18px}.prompt-delete__description{margin:0;color:var(--ui-text-muted);font-size:12px;line-height:20px}.prompt-delete__range>p{margin:8px 0 0;color:var(--ui-text-soft);font-size:11px}.prompt-delete__custom,.prompt-delete__selectors,.prompt-delete__conditions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.prompt-delete__custom{margin-top:12px}.prompt-delete__custom-error{grid-column:1/-1}.prompt-delete__preview{display:grid;gap:10px;padding:12px;border:1px solid color-mix(in srgb,var(--ui-danger) 24%,var(--ui-border));border-radius:var(--ui-radius-panel)}
.prompt-delete__footer{display:flex;width:100%;align-items:center;justify-content:flex-end;gap:8px}.prompt-delete__footer>p{margin:0 auto 0 0;color:var(--ui-text-muted);font-size:11px}
@media(max-width:640px){.prompt-delete__custom,.prompt-delete__selectors,.prompt-delete__conditions{grid-template-columns:1fr}.prompt-delete__footer{display:grid;grid-template-columns:1fr 1fr}.prompt-delete__footer>p{grid-column:1/-1;margin:0}.prompt-delete__footer>*:last-child{grid-column:1/-1}}
</style>
