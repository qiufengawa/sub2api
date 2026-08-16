<template>
  <AppSection :title="t('admin.promptAudit.policy.title')" :description="t('admin.promptAudit.policy.description')">
    <div class="prompt-policy">
      <div class="prompt-policy__scope">
        <UiRadioGroup
          name="prompt-audit-scope"
          :model-value="scopeValue"
          :label="t('admin.promptAudit.policy.scope')"
          :options="scopeOptions"
          @update:model-value="updateScope"
        />

        <div v-if="!draft.all_groups" class="prompt-policy__groups">
          <UiSearchInput
            v-model="groupSearch"
            density="compact"
            :placeholder="t('admin.promptAudit.policy.searchGroups')"
            :aria-label="t('admin.promptAudit.policy.searchGroups')"
          />
          <div class="prompt-policy__group-list">
            <div v-for="group in filteredGroups" :key="group.id" class="prompt-policy__group-row">
              <UiCheckbox
                :model-value="draft.group_ids.includes(group.id)"
                @update:model-value="toggleGroup(group.id)"
              >
                {{ group.name }}
              </UiCheckbox>
              <span>{{ group.platform }} · {{ group.status }}</span>
            </div>
            <UiEmptyState v-if="filteredGroups.length === 0" :title="t('admin.promptAudit.policy.noGroups')" />
          </div>
          <UiAlert
            v-if="missingGroupIds.length"
            tone="warning"
            :message="`${t('admin.promptAudit.policy.missingGroups')}: ${missingGroupIds.join(', ')}`"
          />
          <p class="prompt-policy__count">{{ t('admin.promptAudit.policy.selectedCount', { count: draft.group_ids.length }) }}</p>
        </div>

        <fieldset class="prompt-policy__scanners">
          <legend>{{ t('admin.promptAudit.policy.scanners') }}</legend>
          <div>
            <UiCheckbox
              v-for="scanner in SCANNER_CATALOG"
              :key="scanner.id"
              :model-value="draft.scanners.includes(scanner.id)"
              :aria-label="scannerLabel(scanner.id)"
              @update:model-value="toggleScanner(scanner.id)"
            >
              {{ scannerLabel(scanner.id) }}
            </UiCheckbox>
          </div>
        </fieldset>
      </div>

      <aside class="prompt-policy__limits">
        <UiNumberStepper
          :model-value="draft.worker_count"
          :min="1"
          :max="32"
          :label="t('admin.promptAudit.policy.workerCount')"
          :aria-label="t('admin.promptAudit.policy.workerCount')"
          @update:model-value="patch({ worker_count: $event })"
        />
        <UiNumberStepper
          :model-value="draft.queue_capacity"
          :min="1"
          :max="100000"
          :label="t('admin.promptAudit.policy.queueCapacity')"
          :aria-label="t('admin.promptAudit.policy.queueCapacity')"
          @update:model-value="patch({ queue_capacity: $event })"
        />
        <div class="prompt-policy__strategy">
          <strong>{{ t('admin.promptAudit.policy.strategy') }}</strong>
          <p>priority · {{ t('admin.promptAudit.policy.strategyHint') }}</p>
        </div>
      </aside>
    </div>
  </AppSection>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AppSection,
  UiAlert,
  UiCheckbox,
  UiEmptyState,
  UiNumberStepper,
  UiRadioGroup,
  UiSearchInput,
} from '@/components/ui'
import type { PromptAuditDraft, PromptAuditGroup } from '../types'
import { cloneData, SCANNER_CATALOG } from '../viewModel'

const props = defineProps<{ draft: PromptAuditDraft; groups: PromptAuditGroup[] }>()
const emit = defineEmits<{ (event: 'update:draft', value: PromptAuditDraft): void }>()
const { t } = useI18n()
const groupSearch = ref('')

const scopeValue = computed(() => props.draft.all_groups ? 'all' : 'selected')
const scopeOptions = computed(() => [
  { value: 'all', label: t('admin.promptAudit.policy.allGroups') },
  { value: 'selected', label: t('admin.promptAudit.policy.selectedGroups') },
])
const filteredGroups = computed(() => {
  const query = groupSearch.value.trim().toLowerCase()
  if (!query) return props.groups
  return props.groups.filter((group) => `${group.name} ${group.id} ${group.platform}`.toLowerCase().includes(query))
})
const knownGroupIds = computed(() => new Set(props.groups.map((group) => group.id)))
const missingGroupIds = computed(() => props.draft.group_ids.filter((id) => !knownGroupIds.value.has(id)))

function patch(value: Partial<PromptAuditDraft>) {
  emit('update:draft', { ...cloneData(props.draft), ...value })
}
function updateScope(value: string | number) {
  if (value === 'all') patch({ all_groups: true, group_ids: [] })
  else patch({ all_groups: false })
}
function toggleGroup(id: number) {
  const selected = new Set(props.draft.group_ids)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  patch({ group_ids: [...selected].sort((a, b) => a - b) })
}
function toggleScanner(id: string) {
  const selected = new Set(props.draft.scanners)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  patch({ scanners: SCANNER_CATALOG.map((item) => item.id).filter((item) => selected.has(item)) })
}
function scannerLabel(id: string): string {
  return t(`admin.promptAudit.scanners.${id}`)
}
</script>

<style scoped>
.prompt-policy{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,280px);gap:24px}
.prompt-policy__scope,.prompt-policy__limits{min-width:0;padding:16px;border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius-panel);background:var(--ui-surface)}
.prompt-policy__groups{display:grid;gap:10px;margin-top:16px}
.prompt-policy__group-list{max-height:232px;padding:4px;border:1px solid var(--ui-border-soft);border-radius:var(--ui-radius);overflow-y:auto}
.prompt-policy__group-row{display:flex;min-height:34px;align-items:center;justify-content:space-between;gap:12px;padding:5px 7px;border-radius:var(--ui-radius-dense)}
.prompt-policy__group-row:hover{background:var(--ui-surface-muted)}
.prompt-policy__group-row>span{color:var(--ui-text-soft);font-size:10px;white-space:nowrap}
.prompt-policy__count{margin:0;color:var(--ui-text-soft);font-size:11px}
.prompt-policy__scanners{margin:18px 0 0;padding:16px 0 0;border:0;border-top:1px solid var(--ui-border-soft)}
.prompt-policy__scanners legend{padding:0;color:var(--ui-text);font-size:11px;font-weight:600}
.prompt-policy__scanners>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
.prompt-policy__limits{display:flex;flex-direction:column;gap:18px}
.prompt-policy__strategy{margin-top:auto;padding-top:14px;border-top:1px solid var(--ui-border-soft)}
.prompt-policy__strategy strong{font-size:12px;font-weight:600}.prompt-policy__strategy p{margin:4px 0 0;color:var(--ui-text-muted);font-size:11px;line-height:18px}
@media(max-width:800px){.prompt-policy{grid-template-columns:1fr}.prompt-policy__limits{display:grid;grid-template-columns:1fr 1fr}.prompt-policy__strategy{grid-column:1/-1;margin-top:0}}
@media(max-width:520px){.prompt-policy__scanners>div,.prompt-policy__limits{grid-template-columns:1fr}.prompt-policy__group-row{align-items:flex-start;flex-direction:column;gap:1px}}
</style>
