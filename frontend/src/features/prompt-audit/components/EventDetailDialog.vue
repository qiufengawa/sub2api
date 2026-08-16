<template>
  <UiDialog
    :show="show"
    :title="t('admin.promptAudit.events.detailTitle')"
    :close-label="t('common.close')"
    width="extra-wide"
    @close="emit('close')"
  >
    <div v-if="loading" class="prompt-detail__loading" aria-busy="true">
      <UiSkeleton v-for="index in 6" :key="index" variant="text" height="14px" />
    </div>
    <div v-else-if="event" class="prompt-detail">
      <UiTabs
        :model-value="activeTab"
        :tabs="tabOptions"
        :label="t('admin.promptAudit.events.detailTitle')"
        @update:model-value="setActiveTab"
      />

      <div class="prompt-detail__panel" data-test="event-detail-tab-panel">
        <div v-show="activeTab === 'summary'" class="prompt-detail__summary" role="tabpanel">
          <UiCodeBlock data-test="summary-prompt-full" :code="displayPrompt(event)" />
          <UiDescriptionList :items="summaryFacts" :columns="1" />
        </div>

        <div v-show="activeTab === 'risks'" class="prompt-detail__risks" role="tabpanel">
          <div class="prompt-detail__code-grid">
            <section data-test="risk-prompt-preview">
              <h4>{{ t('admin.promptAudit.events.promptFull') }}</h4>
              <p>{{ t('admin.promptAudit.events.promptFullHint') }}</p>
              <UiCodeBlock data-test="risk-prompt-full" :code="displayPrompt(event)" />
            </section>
            <section data-test="risk-guard-return">
              <h4>{{ t('admin.promptAudit.events.guardReturn') }}</h4>
              <p>{{ t('admin.promptAudit.events.guardReturnHint') }}</p>
              <UiCodeBlock :code="formatGuardReturn(event)" />
            </section>
          </div>

          <section class="prompt-detail__issues">
            <h4>{{ t('admin.promptAudit.events.riskSummaries') }}</h4>
            <article v-for="issue in event.issue_summaries" :key="`${issue.scanner_id}-${issue.code}`" data-test="risk-issue">
              <header>
                <h5>{{ issueTitle(issue) }}</h5>
                <UiBadge tone="danger">{{ issueSeverity(issue) }} · {{ issueAction(issue) }}</UiBadge>
              </header>
              <p>{{ issueDescription(issue) }}</p>
              <UiDescriptionList :items="issueFacts(issue)" :columns="1" />
            </article>
            <UiEmptyState v-if="event.issue_summaries.length === 0" :title="t('admin.promptAudit.events.noRisks')" />
          </section>
        </div>

        <UiDescriptionList v-show="activeTab === 'technical'" :items="technicalFacts" :columns="1" role="tabpanel" />
      </div>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiBadge, UiCodeBlock, UiDescriptionList, UiDialog, UiEmptyState, UiSkeleton, UiTabs } from '@/components/ui'
import type { PromptAuditEvent, PromptIssueSummary } from '../types'
import { SCANNER_CATALOG } from '../viewModel'

const props = defineProps<{ show: boolean; event: PromptAuditEvent | null; loading: boolean }>()
const emit = defineEmits<{ (event: 'close'): void }>()
const { t } = useI18n()
const tabs = ['summary', 'risks', 'technical'] as const
type DetailTab = (typeof tabs)[number]
const activeTab = ref<DetailTab>('summary')

const tabOptions = computed(() => tabs.map((tab) => ({ value: tab, label: t(`admin.promptAudit.events.tabs.${tab}`) })))
const summaryFacts = computed(() => props.event ? [
  { label: t('admin.promptAudit.events.decision'), value: formatDecisionAction(props.event.decision, props.event.action) },
  { label: t('admin.promptAudit.events.user'), value: props.event.snapshot.username || '—' },
  { label: t('admin.promptAudit.events.email'), value: props.event.snapshot.user_email || '—' },
  { label: t('admin.promptAudit.events.apiKey'), value: props.event.snapshot.api_key_name || '—' },
  { label: t('admin.promptAudit.events.group'), value: props.event.snapshot.group_name || '—' },
  { label: t('admin.promptAudit.events.model'), value: props.event.snapshot.model || '—' },
  { label: t('admin.promptAudit.events.categories'), value: formatCategories(props.event.categories) },
] : [])
const technicalFacts = computed(() => props.event ? [
  { label: t('admin.promptAudit.events.requestId'), value: props.event.snapshot.request_id || '—' },
  { label: t('admin.promptAudit.events.promptHash'), value: props.event.snapshot.prompt_hash },
  { label: t('admin.promptAudit.events.technical.scanner'), value: `${props.event.scanner_backend} · ${props.event.scanner_version}` },
  { label: t('admin.promptAudit.events.technical.policy'), value: `${props.event.policy_id} · v${props.event.policy_version}` },
  { label: t('admin.promptAudit.events.technical.guardEndpoint'), value: props.event.guard_endpoint_id },
  { label: t('admin.promptAudit.events.technical.config'), value: `v${props.event.config_version}` },
  { label: t('admin.promptAudit.events.technical.chunks'), value: props.event.chunk_total, numeric: true },
  { label: t('admin.promptAudit.events.technical.latency'), value: `${props.event.latency_ms} ms`, numeric: true },
  { label: t('admin.promptAudit.events.stage'), value: props.event.snapshot.stage || 'http' },
  { label: t('admin.promptAudit.events.technical.protocol'), value: `${props.event.snapshot.protocol} · ${props.event.snapshot.endpoint}` },
] : [])

watch(() => props.event?.id, () => { activeTab.value = 'summary' })

const DECISIONS = new Set(['pass', 'flag', 'critical'])
const ACTIONS = new Set(['Allow', 'Warn', 'Block'])
const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical'])

function setActiveTab(value: string | number) {
  if (tabs.includes(value as DetailTab)) activeTab.value = value as DetailTab
}
function displayPrompt(event: PromptAuditEvent): string {
  return event.snapshot.full_prompt || event.snapshot.redacted_preview || '—'
}
function formatDecisionAction(decision: string, action: string): string {
  const decisionLabel = DECISIONS.has(decision) ? t(`admin.promptAudit.decisions.${decision}`) : decision
  const actionLabel = ACTIONS.has(action) ? t(`admin.promptAudit.actions.${action}`) : action
  return `${decisionLabel} · ${actionLabel}`
}
function translateCategory(category: string): string {
  return SCANNER_CATALOG.some((scanner) => scanner.id === category) ? t(`admin.promptAudit.scanners.${category}`) : category
}
function formatCategories(categories: string[]): string {
  return categories.length ? categories.map(translateCategory).join(', ') : '—'
}
function translateEvidence(value: string): string {
  const byId = SCANNER_CATALOG.find((scanner) => scanner.id === value)
  if (byId) return t(`admin.promptAudit.scanners.${byId.id}`)
  const byLabel = SCANNER_CATALOG.find((scanner) => scanner.label === value)
  if (byLabel) return t(`admin.promptAudit.scanners.${byLabel.id}`)
  return value
}
function formatGuardReturn(event: PromptAuditEvent): string {
  const evidence: Record<string, string> = {}
  for (const [key, value] of Object.entries(event.scanner_evidence || {})) evidence[key] = translateEvidence(value)
  return JSON.stringify({
    decision: DECISIONS.has(event.decision) ? t(`admin.promptAudit.decisions.${event.decision}`) : event.decision,
    risk_level: RISK_LEVELS.has(event.risk_level) ? t(`admin.promptAudit.riskLevels.${event.risk_level}`) : event.risk_level,
    action: ACTIONS.has(event.action) ? t(`admin.promptAudit.actions.${event.action}`) : event.action,
    categories: event.categories.map(translateCategory),
    matched_scanners: event.matched_scanners.map(translateCategory),
    scanner_scores: event.scanner_scores,
    scanner_evidence: evidence,
    scanner_backend: event.scanner_backend,
    scanner_version: event.scanner_version,
    guard_endpoint_id: event.guard_endpoint_id,
    chunk_total: event.chunk_total,
    latency_ms: event.latency_ms,
  }, null, 2)
}
function issueTitle(issue: PromptIssueSummary): string {
  return translateCategory(issue.category || issue.scanner_id) || issue.title
}
function issueDescription(issue: PromptIssueSummary): string {
  const key = `admin.promptAudit.scannerDescriptions.${issue.category || issue.scanner_id}`
  const label = t(key)
  return label === key ? issue.description : label
}
function issueSeverity(issue: PromptIssueSummary): string {
  return RISK_LEVELS.has(issue.severity) ? t(`admin.promptAudit.riskLevels.${issue.severity}`) : issue.severity_label || issue.severity
}
function issueAction(issue: PromptIssueSummary): string {
  return ACTIONS.has(issue.action) ? t(`admin.promptAudit.actions.${issue.action}`) : issue.action_label || issue.action
}
function issueFacts(issue: PromptIssueSummary) {
  return [
    { label: t('admin.promptAudit.events.categories'), value: translateCategory(issue.category || issue.scanner_id) },
    { label: t('admin.promptAudit.events.score'), value: issue.score, numeric: true },
    { label: t('admin.promptAudit.events.evidence'), value: issue.evidence ? translateEvidence(issue.evidence) : '—' },
  ]
}
</script>

<style scoped>
.prompt-detail{display:flex;min-height:0;flex-direction:column}.prompt-detail__loading{display:grid;gap:12px;padding:28px 8px}
.prompt-detail__panel{height:min(62vh,36rem);margin-top:16px;overflow-y:auto}.prompt-detail__summary{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(260px,.85fr);gap:20px}
.prompt-detail__risks{display:grid;gap:22px}.prompt-detail__code-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.prompt-detail__code-grid section{min-width:0}.prompt-detail__code-grid h4,.prompt-detail__issues>h4{margin:0;color:var(--ui-text);font-size:13px;font-weight:600}.prompt-detail__code-grid p{margin:3px 0 9px;color:var(--ui-text-muted);font-size:11px;line-height:18px}
.prompt-detail__issues{display:grid;gap:10px}.prompt-detail__issues article{padding:12px;border:1px solid var(--ui-border-soft);border-left:2px solid var(--ui-danger);border-radius:var(--ui-radius)}.prompt-detail__issues article header{display:flex;align-items:center;justify-content:space-between;gap:10px}.prompt-detail__issues h5{margin:0;font-size:13px;font-weight:600}.prompt-detail__issues article>p{margin:5px 0 10px;color:var(--ui-text-muted);font-size:12px;line-height:19px}
@media(max-width:760px){.prompt-detail__summary,.prompt-detail__code-grid{grid-template-columns:1fr}}
</style>
