<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import Icon from '@/components/icons/Icon.vue'
import {
  UiAlert,
  UiBadge,
  UiButton,
  UiConfirmDialog,
  UiDataTable,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiNumberStepper,
  UiSelect,
  UiSpinner,
  UiSwitch,
  UiTextField,
  type Column,
  type SelectOption,
} from '@/components/ui'
import { adminAPI } from '@/api'
import { opsAPI } from '@/api/admin/ops'
import type { AlertRule, MetricType, Operator } from '../types'
import type { OpsSeverity } from '@/api/admin/ops'
import { formatDateTime } from '../utils/opsFormatters'

const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(false)
const rules = ref<AlertRule[]>([])
let loadRequestId = 0

async function load() {
  const requestId = ++loadRequestId
  loading.value = true
  try {
    const data = await opsAPI.listAlertRules()
    if (requestId !== loadRequestId) return
    rules.value = data
  } catch (err: any) {
    if (requestId !== loadRequestId) return
    console.error('[OpsAlertRulesCard] Failed to load rules', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.alertRules.loadFailed'))
    rules.value = []
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

onMounted(() => {
  load()
  loadGroups()
})

const sortedRules = computed(() => {
  return [...rules.value].sort((a, b) => (b.id || 0) - (a.id || 0))
})

const columns = computed<Column[]>(() => [
  { key: 'name', label: t('admin.ops.alertRules.table.name') },
  { key: 'metric', label: t('admin.ops.alertRules.table.metric') },
  { key: 'severity', label: t('admin.ops.alertRules.table.severity') },
  { key: 'enabled', label: t('admin.ops.alertRules.table.enabled') },
  { key: 'actions', label: t('admin.ops.alertRules.table.actions') },
])

function severityTone(value: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (value === 'P0') return 'danger'
  if (value === 'P1') return 'warning'
  if (value === 'P2') return 'info'
  return 'neutral'
}

const showEditor = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const draft = ref<AlertRule | null>(null)

type MetricGroup = 'system' | 'group' | 'account'

interface MetricDefinition {
  type: MetricType
  group: MetricGroup
  label: string
  description: string
  recommendedOperator: Operator
  recommendedThreshold: number
  unit?: string
}

const groupMetricTypes = new Set<MetricType>([
  'group_available_accounts',
  'group_available_ratio',
  'group_rate_limit_ratio'
])

function parsePositiveInt(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'boolean') return null
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

const groupOptionsBase = ref<SelectOption[]>([])

async function loadGroups() {
  try {
    const list = await adminAPI.groups.getAll()
    groupOptionsBase.value = list.map((g) => ({ value: g.id, label: g.name }))
  } catch (err) {
    console.error('[OpsAlertRulesCard] Failed to load groups', err)
    groupOptionsBase.value = []
  }
}

const isGroupMetricSelected = computed(() => {
  const metricType = draft.value?.metric_type
  return metricType ? groupMetricTypes.has(metricType) : false
})

const draftGroupId = computed<number | null>({
  get() {
    return parsePositiveInt(draft.value?.filters?.group_id)
  },
  set(value) {
    if (!draft.value) return
    if (value == null) {
      if (!draft.value.filters) return
      delete draft.value.filters.group_id
      if (Object.keys(draft.value.filters).length === 0) {
        delete draft.value.filters
      }
      return
    }
    if (!draft.value.filters) draft.value.filters = {}
    draft.value.filters.group_id = value
  }
})

const groupOptions = computed<SelectOption[]>(() => {
  if (isGroupMetricSelected.value) return groupOptionsBase.value
  return [{ value: null, label: t('admin.ops.alertRules.form.allGroups') }, ...groupOptionsBase.value]
})

const metricDefinitions = computed(() => {
  return [
    // System-level metrics
    {
      type: 'success_rate',
      group: 'system',
      label: t('admin.ops.alertRules.metrics.successRate'),
      description: t('admin.ops.alertRules.metricDescriptions.successRate'),
      recommendedOperator: '<',
      recommendedThreshold: 99,
      unit: '%'
    },
    {
      type: 'error_rate',
      group: 'system',
      label: t('admin.ops.alertRules.metrics.errorRate'),
      description: t('admin.ops.alertRules.metricDescriptions.errorRate'),
      recommendedOperator: '>',
      recommendedThreshold: 1,
      unit: '%'
    },
    {
      type: 'upstream_error_rate',
      group: 'system',
      label: t('admin.ops.alertRules.metrics.upstreamErrorRate'),
      description: t('admin.ops.alertRules.metricDescriptions.upstreamErrorRate'),
      recommendedOperator: '>',
      recommendedThreshold: 1,
      unit: '%'
    },
    {
      type: 'cpu_usage_percent',
      group: 'system',
      label: t('admin.ops.alertRules.metrics.cpu'),
      description: t('admin.ops.alertRules.metricDescriptions.cpu'),
      recommendedOperator: '>',
      recommendedThreshold: 80,
      unit: '%'
    },
    {
      type: 'memory_usage_percent',
      group: 'system',
      label: t('admin.ops.alertRules.metrics.memory'),
      description: t('admin.ops.alertRules.metricDescriptions.memory'),
      recommendedOperator: '>',
      recommendedThreshold: 80,
      unit: '%'
    },
    {
      type: 'concurrency_queue_depth',
      group: 'system',
      label: t('admin.ops.alertRules.metrics.queueDepth'),
      description: t('admin.ops.alertRules.metricDescriptions.queueDepth'),
      recommendedOperator: '>',
      recommendedThreshold: 10
    },

    // Group-level metrics (requires group_id filter)
    {
      type: 'group_available_accounts',
      group: 'group',
      label: t('admin.ops.alertRules.metrics.groupAvailableAccounts'),
      description: t('admin.ops.alertRules.metricDescriptions.groupAvailableAccounts'),
      recommendedOperator: '<',
      recommendedThreshold: 1
    },
    {
      type: 'group_available_ratio',
      group: 'group',
      label: t('admin.ops.alertRules.metrics.groupAvailableRatio'),
      description: t('admin.ops.alertRules.metricDescriptions.groupAvailableRatio'),
      recommendedOperator: '<',
      recommendedThreshold: 50,
      unit: '%'
    },
    {
      type: 'group_rate_limit_ratio',
      group: 'group',
      label: t('admin.ops.alertRules.metrics.groupRateLimitRatio'),
      description: t('admin.ops.alertRules.metricDescriptions.groupRateLimitRatio'),
      recommendedOperator: '>',
      recommendedThreshold: 10,
      unit: '%'
    },

    // Account-level metrics
    {
      type: 'account_rate_limited_count',
      group: 'account',
      label: t('admin.ops.alertRules.metrics.accountRateLimitedCount'),
      description: t('admin.ops.alertRules.metricDescriptions.accountRateLimitedCount'),
      recommendedOperator: '>',
      recommendedThreshold: 0
    },
    {
      type: 'account_error_count',
      group: 'account',
      label: t('admin.ops.alertRules.metrics.accountErrorCount'),
      description: t('admin.ops.alertRules.metricDescriptions.accountErrorCount'),
      recommendedOperator: '>',
      recommendedThreshold: 0
    },
    {
      type: 'account_error_ratio',
      group: 'account',
      label: t('admin.ops.alertRules.metrics.accountErrorRatio'),
      description: t('admin.ops.alertRules.metricDescriptions.accountErrorRatio'),
      recommendedOperator: '>',
      recommendedThreshold: 5,
      unit: '%'
    },
    {
      type: 'account_temp_unscheduled_count',
      group: 'account',
      label: t('admin.ops.alertRules.metrics.accountTempUnscheduledCount'),
      description: t('admin.ops.alertRules.metricDescriptions.accountTempUnscheduledCount'),
      recommendedOperator: '>',
      recommendedThreshold: 0
    },
    {
      type: 'overload_account_count',
      group: 'account',
      label: t('admin.ops.alertRules.metrics.overloadAccountCount'),
      description: t('admin.ops.alertRules.metricDescriptions.overloadAccountCount'),
      recommendedOperator: '>',
      recommendedThreshold: 0
    }
  ] satisfies MetricDefinition[]
})

const selectedMetricDefinition = computed(() => {
  const metricType = draft.value?.metric_type
  if (!metricType) return null
  return metricDefinitions.value.find((m) => m.type === metricType) ?? null
})

const metricOptions = computed(() => {
  const buildGroup = (group: MetricGroup): SelectOption[] => {
    const items = metricDefinitions.value.filter((m) => m.group === group)
    if (items.length === 0) return []
    const headerValue = `__group__${group}`
    return [
      {
        value: headerValue,
        label: t(`admin.ops.alertRules.metricGroups.${group}`),
        disabled: true,
        kind: 'group'
      },
      ...items.map((m) => ({ value: m.type, label: m.label }))
    ]
  }

  return [...buildGroup('system'), ...buildGroup('group'), ...buildGroup('account')]
})

const operatorOptions = computed(() => {
  const ops: Operator[] = ['>', '>=', '<', '<=', '==', '!=']
  return ops.map((o) => ({ value: o, label: o }))
})

const severityOptions = computed(() => {
  const sev: OpsSeverity[] = ['P0', 'P1', 'P2', 'P3']
  return sev.map((s) => ({ value: s, label: s }))
})

const windowOptions = computed(() => {
  const windows = [1, 5, 60]
  return windows.map((m) => ({ value: m, label: `${m}m` }))
})

function newRuleDraft(): AlertRule {
  return {
    name: '',
    description: '',
    enabled: true,
    metric_type: 'error_rate',
    operator: '>',
    threshold: 1,
    window_minutes: 1,
    sustained_minutes: 2,
    severity: 'P1',
    cooldown_minutes: 10,
    notify_email: true
  }
}

function openCreate() {
  editingId.value = null
  draft.value = newRuleDraft()
  showEditor.value = true
}

function openEdit(rule: AlertRule) {
  editingId.value = rule.id ?? null
  draft.value = JSON.parse(JSON.stringify(rule))
  showEditor.value = true
}

const editorValidation = computed(() => {
  const errors: string[] = []
  const r = draft.value
  if (!r) return { valid: true, errors }
  if (!r.name || !r.name.trim()) errors.push(t('admin.ops.alertRules.validation.nameRequired'))
  if (!r.metric_type) errors.push(t('admin.ops.alertRules.validation.metricRequired'))
  if (groupMetricTypes.has(r.metric_type) && !parsePositiveInt(r.filters?.group_id)) {
    errors.push(t('admin.ops.alertRules.validation.groupIdRequired'))
  }
  if (!r.operator) errors.push(t('admin.ops.alertRules.validation.operatorRequired'))
  if (!(typeof r.threshold === 'number' && Number.isFinite(r.threshold)))
    errors.push(t('admin.ops.alertRules.validation.thresholdRequired'))
  if (!(typeof r.window_minutes === 'number' && Number.isFinite(r.window_minutes) && [1, 5, 60].includes(r.window_minutes))) {
    errors.push(t('admin.ops.alertRules.validation.windowRange'))
  }
  if (!(typeof r.sustained_minutes === 'number' && Number.isFinite(r.sustained_minutes) && r.sustained_minutes >= 1 && r.sustained_minutes <= 1440)) {
    errors.push(t('admin.ops.alertRules.validation.sustainedRange'))
  }
  if (!(typeof r.cooldown_minutes === 'number' && Number.isFinite(r.cooldown_minutes) && r.cooldown_minutes >= 0 && r.cooldown_minutes <= 1440)) {
    errors.push(t('admin.ops.alertRules.validation.cooldownRange'))
  }
  return { valid: errors.length === 0, errors }
})

async function save() {
  if (!draft.value) return
  if (!editorValidation.value.valid) {
    appStore.showError(editorValidation.value.errors[0] || t('admin.ops.alertRules.validation.invalid'))
    return
  }
  saving.value = true
  try {
    if (editingId.value) {
      await opsAPI.updateAlertRule(editingId.value, draft.value)
    } else {
      await opsAPI.createAlertRule(draft.value)
    }
    showEditor.value = false
    draft.value = null
    editingId.value = null
    await load()
    appStore.showSuccess(t('admin.ops.alertRules.saveSuccess'))
  } catch (err: any) {
    console.error('[OpsAlertRulesCard] Failed to save rule', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.alertRules.saveFailed'))
  } finally {
    saving.value = false
  }
}

const showDeleteConfirm = ref(false)
const pendingDelete = ref<AlertRule | null>(null)
const deleting = ref(false)

function requestDelete(rule: AlertRule) {
  pendingDelete.value = rule
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!pendingDelete.value?.id || deleting.value) return
  const deleteId = pendingDelete.value.id
  deleting.value = true
  try {
    await opsAPI.deleteAlertRule(deleteId)
    showDeleteConfirm.value = false
    pendingDelete.value = null
    await load()
    appStore.showSuccess(t('admin.ops.alertRules.deleteSuccess'))
  } catch (err: any) {
    console.error('[OpsAlertRulesCard] Failed to delete rule', err)
    appStore.showError(err?.response?.data?.detail || t('admin.ops.alertRules.deleteFailed'))
  } finally {
    deleting.value = false
  }
}

function cancelDelete() {
  if (deleting.value) return
  showDeleteConfirm.value = false
  pendingDelete.value = null
}

onBeforeUnmount(() => {
  loadRequestId += 1
})
</script>

<template>
  <section class="ops-alert-rules">
    <header class="ops-alert-rules__header">
      <div class="ops-alert-rules__heading">
        <h3>{{ t('admin.ops.alertRules.title') }}</h3>
        <p>{{ t('admin.ops.alertRules.description') }}</p>
      </div>

      <div class="ops-alert-rules__actions">
        <UiButton variant="primary" density="dense" :disabled="loading" @click="openCreate">
          <template #icon><Icon name="plus" size="sm" /></template>
          {{ t('admin.ops.alertRules.create') }}
        </UiButton>
        <UiIconButton
          icon="refresh"
          density="dense"
          variant="ghost"
          :disabled="loading"
          :label="t('common.refresh')"
          @click="load"
        />
      </div>
    </header>

    <div v-if="loading" class="ops-alert-rules__state"><UiSpinner :label="t('admin.ops.alertRules.loading')" /></div>

    <UiEmptyState v-else-if="sortedRules.length === 0" :title="t('admin.ops.alertRules.empty')" />

    <UiDataTable v-else class="ops-alert-rules__table" :columns="columns" :data="sortedRules" :mobile-table="true" :aria-label="t('admin.ops.alertRules.title')">
      <template #cell-name="{ row }"><span class="ops-alert-rules__name"><strong>{{ row.name }}</strong><small v-if="row.description">{{ row.description }}</small><small v-if="row.updated_at">{{ formatDateTime(row.updated_at) }}</small></span></template>
      <template #cell-metric="{ row }"><span class="ops-alert-rules__metric">{{ row.metric_type }} {{ row.operator }} {{ row.threshold }}</span></template>
      <template #cell-severity="{ row }"><UiBadge :tone="severityTone(row.severity)" :label="row.severity" /></template>
      <template #cell-enabled="{ row }"><UiBadge :tone="row.enabled ? 'success' : 'neutral'" :label="row.enabled ? t('common.enabled') : t('common.disabled')" /></template>
      <template #cell-actions="{ row }"><span class="ops-alert-rules__row-actions"><UiButton density="mini" @click="openEdit(row)">{{ t('common.edit') }}</UiButton><UiButton density="mini" variant="danger" @click="requestDelete(row)">{{ t('common.delete') }}</UiButton></span></template>
    </UiDataTable>

    <UiDialog
      :show="showEditor"
      :title="editingId ? t('admin.ops.alertRules.editTitle') : t('admin.ops.alertRules.createTitle')"
      width="wide"
      @close="showEditor = false"
    >
      <div class="ops-alert-rules__editor">
        <UiAlert v-if="!editorValidation.valid" tone="danger" :title="t('admin.ops.alertRules.validation.title')">
          <ul class="ops-alert-rules__errors">
            <li v-for="e in editorValidation.errors" :key="e">{{ e }}</li>
          </ul>
        </UiAlert>

        <div class="ops-alert-rules__form">
          <UiTextField id="ops-alert-rule-name" v-model="draft!.name" class="ops-alert-rules__wide" density="compact" :label="t('admin.ops.alertRules.form.name')" />

          <UiTextField id="ops-alert-rule-description" v-model="draft!.description" class="ops-alert-rules__wide" density="compact" :label="t('admin.ops.alertRules.form.description')" />

          <div>
            <UiSelect id="ops-alert-rule-metric" v-model="draft!.metric_type" density="compact" :label="t('admin.ops.alertRules.form.metric')" :options="metricOptions" />
            <div v-if="selectedMetricDefinition" class="ops-alert-rules__metric-hint">
              <p>{{ selectedMetricDefinition.description }}</p>
              <p>
                {{
                  t('admin.ops.alertRules.hints.recommended', {
                    operator: selectedMetricDefinition.recommendedOperator,
                    threshold: selectedMetricDefinition.recommendedThreshold,
                    unit: selectedMetricDefinition.unit || ''
                  })
                }}
              </p>
            </div>
          </div>

          <div>
            <UiSelect id="ops-alert-rule-operator" v-model="draft!.operator" density="compact" :label="t('admin.ops.alertRules.form.operator')" :options="operatorOptions" />
          </div>

          <div class="ops-alert-rules__wide">
            <UiSelect
              id="ops-alert-rule-group"
              v-model="draftGroupId"
              density="compact"
              :label="t('admin.ops.alertRules.form.groupId')"
              :required="isGroupMetricSelected"
              :options="groupOptions"
              searchable
              :placeholder="t('admin.ops.alertRules.form.groupPlaceholder')"
              :error="isGroupMetricSelected && !draftGroupId ? t('admin.ops.alertRules.validation.groupIdRequired') : undefined"
            />
            <p class="ops-alert-rules__hint">
              {{ isGroupMetricSelected ? t('admin.ops.alertRules.hints.groupRequired') : t('admin.ops.alertRules.hints.groupOptional') }}
            </p>
          </div>

          <div>
            <UiNumberStepper id="ops-alert-rule-threshold" v-model="draft!.threshold" :label="t('admin.ops.alertRules.form.threshold')" :min="-1000000" />
          </div>

          <div>
            <UiSelect id="ops-alert-rule-severity" v-model="draft!.severity" density="compact" :label="t('admin.ops.alertRules.form.severity')" :options="severityOptions" />
          </div>

          <div>
            <UiSelect id="ops-alert-rule-window" v-model="draft!.window_minutes" density="compact" :label="t('admin.ops.alertRules.form.window')" :options="windowOptions" />
          </div>

          <div>
            <UiNumberStepper id="ops-alert-rule-sustained" v-model="draft!.sustained_minutes" :label="t('admin.ops.alertRules.form.sustained')" :min="1" :max="1440" />
          </div>

          <div>
            <UiNumberStepper id="ops-alert-rule-cooldown" v-model="draft!.cooldown_minutes" :label="t('admin.ops.alertRules.form.cooldown')" :min="0" :max="1440" />
          </div>

          <label class="ops-alert-rules__switch ops-alert-rules__wide">
            <span>{{ t('admin.ops.alertRules.form.enabled') }}</span>
            <UiSwitch v-model="draft!.enabled" :label="t('admin.ops.alertRules.form.enabled')" />
          </label>

          <label class="ops-alert-rules__switch ops-alert-rules__wide">
            <span>{{ t('admin.ops.alertRules.form.notifyEmail') }}</span>
            <UiSwitch v-model="draft!.notify_email" :label="t('admin.ops.alertRules.form.notifyEmail')" />
          </label>
        </div>
      </div>

      <template #footer>
        <div class="ops-alert-rules__footer">
          <UiButton :disabled="saving" @click="showEditor = false">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton variant="primary" :loading="saving" @click="save">{{ t('common.save') }}</UiButton>
        </div>
      </template>
    </UiDialog>

    <UiConfirmDialog
      :show="showDeleteConfirm"
      :title="t('admin.ops.alertRules.deleteConfirmTitle')"
      :message="t('admin.ops.alertRules.deleteConfirmMessage')"
      :confirm-text="t('common.delete')"
      :cancel-text="t('common.cancel')"
      :pending="deleting"
      danger
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </section>
</template>

<style scoped>
.ops-alert-rules { overflow: hidden; border: 1px solid var(--ui-border); border-radius: var(--ui-radius-panel); background: var(--ui-surface); }
.ops-alert-rules__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 14px 16px; border-bottom: 1px solid var(--ui-border-soft); }.ops-alert-rules__heading h3 { margin: 0; color: var(--ui-text); font-size: 14px; line-height: 22px; }.ops-alert-rules__heading p { margin: 2px 0 0; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }.ops-alert-rules__actions,.ops-alert-rules__row-actions,.ops-alert-rules__footer { display: flex; align-items: center; gap: 6px; }.ops-alert-rules__state { display: grid; min-height: 160px; place-items: center; }.ops-alert-rules__table { max-height: 520px; overflow: auto; }.ops-alert-rules__name { display: grid; min-width: 220px; max-width: 380px; gap: 2px; }.ops-alert-rules__name strong,.ops-alert-rules__name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.ops-alert-rules__name strong { color: var(--ui-text); font-size: 12px; }.ops-alert-rules__name small { color: var(--ui-text-muted); font-size: 11px; }.ops-alert-rules__metric { color: var(--ui-text-muted); font-family: var(--ui-font-mono); font-size: 11px; white-space: nowrap; }.ops-alert-rules__row-actions { justify-content: flex-end; white-space: nowrap; }
.ops-alert-rules__editor { display: grid; gap: 14px; }.ops-alert-rules__errors { margin: 0; padding-left: 18px; }.ops-alert-rules__form { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }.ops-alert-rules__wide { grid-column: 1 / -1; }.ops-alert-rules__metric-hint,.ops-alert-rules__hint { margin: 4px 0 0; color: var(--ui-text-muted); font-size: 11px; line-height: 17px; }.ops-alert-rules__metric-hint p { margin: 0; }.ops-alert-rules__switch { display: flex; min-height: 40px; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--ui-border-soft); color: var(--ui-text-muted); font-size: 12px; }.ops-alert-rules__footer { width: 100%; justify-content: flex-end; }
@media(max-width:640px){.ops-alert-rules__header{align-items:stretch;flex-direction:column}.ops-alert-rules__actions{justify-content:flex-end}.ops-alert-rules__form{grid-template-columns:1fr}.ops-alert-rules__wide{grid-column:auto}}
</style>
