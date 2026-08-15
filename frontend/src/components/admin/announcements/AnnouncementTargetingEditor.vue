<template>
  <div class="announcement-targeting">
    <div class="announcement-targeting__header">
      <div>
        <div class="announcement-targeting__title">
          {{ t('admin.announcements.form.targetingMode') }}
        </div>
        <div class="announcement-targeting__description">
          {{ mode === 'all' ? t('admin.announcements.form.targetingAll') : t('admin.announcements.form.targetingCustom') }}
        </div>
      </div>
      <UiRadioGroup
        :model-value="mode"
        :options="modeOptions"
        name="announcement-targeting-mode"
        @update:model-value="setMode($event as Mode)"
      />
    </div>

    <div v-if="mode === 'custom'" class="announcement-targeting__custom">
      <div class="announcement-targeting__toolbar">
        <div class="announcement-targeting__title">
          OR
          <span class="announcement-targeting__count ui-numeric">{{ anyOf.length }}/50</span>
        </div>
        <UiButton
          type="button"
          density="compact"
          :disabled="anyOf.length >= 50"
          @click="addOrGroup"
        >
          <template #icon><Icon name="plus" size="sm" /></template>
          {{ t('admin.announcements.form.addOrGroup') }}
        </UiButton>
      </div>

      <UiEmptyState
        v-if="anyOf.length === 0"
        :title="t('admin.announcements.form.targetingCustom')"
        :description="t('admin.announcements.form.addOrGroup')"
      />

      <section
        v-for="(group, groupIndex) in anyOf"
        :key="groupIndex"
        class="announcement-targeting__group"
      >
        <div class="announcement-targeting__group-header">
          <div>
            <div class="announcement-targeting__title">
              {{ t('admin.announcements.form.targetingCustom') }} #{{ groupIndex + 1 }}
              <span class="announcement-targeting__count ui-numeric">AND {{ group.all_of?.length || 0 }}/50</span>
            </div>
            <div class="announcement-targeting__description">
              {{ t('admin.announcements.form.addAndCondition') }}
            </div>
          </div>
          <UiIconButton icon="trash" :label="t('common.delete')" variant="danger" density="compact" @click="removeOrGroup(groupIndex)" />
        </div>

        <div class="announcement-targeting__conditions">
          <div
            v-for="(cond, condIndex) in (group.all_of || [])"
            :key="condIndex"
            class="announcement-targeting__condition"
          >
              <div class="announcement-targeting__condition-type">
                <UiSelect
                  :model-value="cond.type"
                  :label="t('admin.announcements.form.conditionType')"
                  :options="conditionTypeOptions"
                  density="compact"
                  @update:model-value="(v) => setConditionType(groupIndex, condIndex, v as any)"
                />
              </div>

              <div v-if="cond.type === 'subscription'" class="announcement-targeting__condition-value">
                <label class="announcement-targeting__field-label">{{ t('admin.announcements.form.selectPackages') }}</label>
                <GroupSelector
                  v-model="subscriptionSelections[groupIndex][condIndex]"
                  :groups="groups"
                />
              </div>

              <div v-else class="announcement-targeting__balance">
                <UiSelect
                    :model-value="cond.operator"
                    :label="t('admin.announcements.form.operator')"
                    :options="balanceOperatorOptions"
                    density="compact"
                    @update:model-value="(v) => setOperator(groupIndex, condIndex, v as any)"
                  />
                  <UiTextField
                    :model-value="cond.value ?? ''"
                    type="number"
                    step="any"
                    density="compact"
                    :label="t('admin.announcements.form.balanceValue')"
                    @update:model-value="setBalanceValue(groupIndex, condIndex, String($event))"
                  />
              </div>

              <UiIconButton icon="x" :label="t('common.delete')" variant="danger" density="compact" @click="removeAndCondition(groupIndex, condIndex)" />
          </div>

          <div class="announcement-targeting__condition-actions">
            <UiButton
              type="button"
              density="compact"
              :disabled="(group.all_of?.length || 0) >= 50"
              @click="addAndCondition(groupIndex)"
            >
              <template #icon><Icon name="plus" size="sm" /></template>
              {{ t('admin.announcements.form.addAndCondition') }}
            </UiButton>
          </div>
        </div>
      </section>

      <UiAlert v-if="validationError" tone="danger" :message="validationError" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  AdminGroup,
  AnnouncementTargeting,
  AnnouncementCondition,
  AnnouncementConditionGroup,
  AnnouncementConditionType,
  AnnouncementOperator
} from '@/types'

import GroupSelector from '@/components/common/GroupSelector.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  UiAlert,
  UiButton,
  UiEmptyState,
  UiIconButton,
  UiRadioGroup,
  UiSelect,
  UiTextField,
} from '@/components/ui'

const { t } = useI18n()

const props = defineProps<{
  modelValue: AnnouncementTargeting
  groups: AdminGroup[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: AnnouncementTargeting): void
}>()

const anyOf = computed(() => props.modelValue?.any_of ?? [])

type Mode = 'all' | 'custom'
const mode = computed<Mode>(() => (anyOf.value.length === 0 ? 'all' : 'custom'))
const modeOptions = computed(() => [
  { value: 'all', label: t('admin.announcements.form.targetingAll') },
  { value: 'custom', label: t('admin.announcements.form.targetingCustom') },
])

const conditionTypeOptions = computed(() => [
  { value: 'subscription', label: t('admin.announcements.form.conditionSubscription') },
  { value: 'balance', label: t('admin.announcements.form.conditionBalance') }
])

const balanceOperatorOptions = computed(() => [
  { value: 'gt', label: t('admin.announcements.operators.gt') },
  { value: 'gte', label: t('admin.announcements.operators.gte') },
  { value: 'lt', label: t('admin.announcements.operators.lt') },
  { value: 'lte', label: t('admin.announcements.operators.lte') },
  { value: 'eq', label: t('admin.announcements.operators.eq') }
])

function setMode(next: Mode) {
  if (next === 'all') {
    emit('update:modelValue', { any_of: [] })
    return
  }
  if (anyOf.value.length === 0) {
    emit('update:modelValue', { any_of: [{ all_of: [defaultSubscriptionCondition()] }] })
  }
}

function defaultSubscriptionCondition(): AnnouncementCondition {
  return {
    type: 'subscription' as AnnouncementConditionType,
    operator: 'in' as AnnouncementOperator,
    group_ids: []
  }
}

function defaultBalanceCondition(): AnnouncementCondition {
  return {
    type: 'balance' as AnnouncementConditionType,
    operator: 'gte' as AnnouncementOperator,
    value: 0
  }
}

type TargetingDraft = {
  any_of: AnnouncementConditionGroup[]
}

function updateTargeting(mutator: (draft: TargetingDraft) => void) {
  const draft: TargetingDraft = JSON.parse(JSON.stringify(props.modelValue ?? { any_of: [] }))
  if (!draft.any_of) draft.any_of = []
  mutator(draft)
  emit('update:modelValue', draft)
}

function addOrGroup() {
  updateTargeting((draft) => {
    if (draft.any_of.length >= 50) return
    draft.any_of.push({ all_of: [defaultSubscriptionCondition()] })
  })
}

function removeOrGroup(groupIndex: number) {
  updateTargeting((draft) => {
    draft.any_of.splice(groupIndex, 1)
  })
}

function addAndCondition(groupIndex: number) {
  updateTargeting((draft) => {
    const group = draft.any_of[groupIndex]
    if (!group.all_of) group.all_of = []
    if (group.all_of.length >= 50) return
    group.all_of.push(defaultSubscriptionCondition())
  })
}

function removeAndCondition(groupIndex: number, condIndex: number) {
  updateTargeting((draft) => {
    const group = draft.any_of[groupIndex]
    if (!group?.all_of) return
    group.all_of.splice(condIndex, 1)
  })
}

function setConditionType(groupIndex: number, condIndex: number, nextType: AnnouncementConditionType) {
  updateTargeting((draft) => {
    const group = draft.any_of[groupIndex]
    if (!group?.all_of) return

    if (nextType === 'subscription') {
      group.all_of[condIndex] = defaultSubscriptionCondition()
    } else {
      group.all_of[condIndex] = defaultBalanceCondition()
    }
  })
}

function setOperator(groupIndex: number, condIndex: number, op: AnnouncementOperator) {
  updateTargeting((draft) => {
    const group = draft.any_of[groupIndex]
    if (!group?.all_of) return

    const cond = group.all_of[condIndex]
    if (!cond) return

    cond.operator = op
  })
}

function setBalanceValue(groupIndex: number, condIndex: number, raw: string) {
  const n = raw === '' ? 0 : Number(raw)
  updateTargeting((draft) => {
    const group = draft.any_of[groupIndex]
    if (!group?.all_of) return

    const cond = group.all_of[condIndex]
    if (!cond) return

    cond.value = Number.isFinite(n) ? n : 0
  })
}

// We keep group_ids selection in a parallel reactive map because GroupSelector is numeric list.
// Then we mirror it back to targeting.group_ids via a watcher.
const subscriptionSelections = reactive<Record<number, Record<number, number[]>>>({})

function ensureSelectionPath(groupIndex: number, condIndex: number) {
  if (!subscriptionSelections[groupIndex]) subscriptionSelections[groupIndex] = {}
  if (!subscriptionSelections[groupIndex][condIndex]) subscriptionSelections[groupIndex][condIndex] = []
}

// Sync from modelValue to subscriptionSelections (one-way: model -> local state)
watch(
  () => props.modelValue,
  (v) => {
    const groups = v?.any_of ?? []
    for (let gi = 0; gi < groups.length; gi++) {
      const allOf = groups[gi]?.all_of ?? []
      for (let ci = 0; ci < allOf.length; ci++) {
        const c = allOf[ci]
        if (c?.type === 'subscription') {
          ensureSelectionPath(gi, ci)
          // Only update if different to avoid triggering unnecessary updates
          const newIds = (c.group_ids ?? []).slice()
          const currentIds = subscriptionSelections[gi]?.[ci] ?? []
          if (JSON.stringify(newIds.sort()) !== JSON.stringify(currentIds.sort())) {
            subscriptionSelections[gi][ci] = newIds
          }
        }
      }
    }
  },
  { immediate: true }
)

// Sync from subscriptionSelections to modelValue (one-way: local state -> model)
// Use a debounced approach to avoid infinite loops
let syncTimeout: ReturnType<typeof setTimeout> | null = null
watch(
  () => subscriptionSelections,
  () => {
    // Debounce the sync to avoid rapid fire updates
    if (syncTimeout) clearTimeout(syncTimeout)

    syncTimeout = setTimeout(() => {
      // Build the new targeting state
      const newTargeting: TargetingDraft = JSON.parse(JSON.stringify(props.modelValue ?? { any_of: [] }))
      if (!newTargeting.any_of) newTargeting.any_of = []

      const groups = newTargeting.any_of ?? []
      for (let gi = 0; gi < groups.length; gi++) {
        const allOf = groups[gi]?.all_of ?? []
        for (let ci = 0; ci < allOf.length; ci++) {
          const c = allOf[ci]
          if (c?.type === 'subscription') {
            ensureSelectionPath(gi, ci)
            c.operator = 'in' as AnnouncementOperator
            c.group_ids = (subscriptionSelections[gi]?.[ci] ?? []).slice()
          }
        }
      }

      // Only emit if there's an actual change (deep comparison)
      if (JSON.stringify(props.modelValue) !== JSON.stringify(newTargeting)) {
        emit('update:modelValue', newTargeting)
      }
    }, 0)
  },
  { deep: true }
)

const validationError = computed(() => {
  if (mode.value !== 'custom') return ''

  const groups = anyOf.value
  if (groups.length === 0) return t('admin.announcements.form.addOrGroup')

  if (groups.length > 50) return 'any_of > 50'

  for (const g of groups) {
    const allOf = g?.all_of ?? []
    if (allOf.length === 0) return t('admin.announcements.form.addAndCondition')
    if (allOf.length > 50) return 'all_of > 50'

    for (const c of allOf) {
      if (c.type === 'subscription') {
        if (!c.group_ids || c.group_ids.length === 0) return t('admin.announcements.form.selectPackages')
      }
    }
  }

  return ''
})
</script>

<style scoped>
.announcement-targeting { display: grid; gap: 14px; padding-block: 2px; }
.announcement-targeting__header,
.announcement-targeting__toolbar,
.announcement-targeting__group-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.announcement-targeting__title { color: var(--ui-text); font-size: 13px; font-weight: 600; }
.announcement-targeting__description,
.announcement-targeting__count { margin-top: 2px; color: var(--ui-text-soft); font-size: 11px; font-weight: 400; }
.announcement-targeting__count { margin-left: 6px; }
.announcement-targeting__custom { display: grid; gap: 12px; padding-top: 14px; border-top: 1px solid var(--ui-border-soft); }
.announcement-targeting__group { display: grid; gap: 12px; padding-block: 12px; border-top: 1px solid var(--ui-border); }
.announcement-targeting__conditions { display: grid; gap: 8px; }
.announcement-targeting__condition { display: grid; grid-template-columns: minmax(160px, .65fr) minmax(240px, 1.35fr) auto; align-items: end; gap: 10px; padding: 10px 0; border-top: 1px solid var(--ui-border-soft); }
.announcement-targeting__condition-value { min-width: 0; }
.announcement-targeting__balance { display: grid; grid-template-columns: minmax(130px, .7fr) minmax(160px, 1fr); gap: 10px; }
.announcement-targeting__field-label { display: block; margin-bottom: 4px; color: var(--ui-text-muted); font-size: 11px; font-weight: 600; }
.announcement-targeting__condition-actions { display: flex; justify-content: flex-end; }
@media (max-width: 720px) {
  .announcement-targeting__header { align-items: flex-start; flex-direction: column; }
  .announcement-targeting__condition { grid-template-columns: 1fr; }
  .announcement-targeting__balance { grid-template-columns: 1fr; }
  .announcement-targeting__condition > .ui-icon-button { justify-self: end; }
}
</style>
