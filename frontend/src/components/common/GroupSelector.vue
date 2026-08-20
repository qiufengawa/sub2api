<template>
  <div class="group-selector">
    <div class="group-selector__label">
      {{ t('admin.users.groups') }}
      <span>{{ t('common.selectedCount', { count: modelValue.length }) }}</span>
    </div>
    <div v-if="isSearchable" class="group-selector__search">
      <UiSearchInput
        v-model="searchText"
        :placeholder="t('common.searchPlaceholder')"
        :aria-label="t('common.searchPlaceholder')"
        density="compact"
        :debounce-ms="0"
      />
    </div>
    <div
      class="group-selector__options"
      :class="{ 'group-selector__options--searchable': isSearchable }"
    >
      <div
        v-for="group in filteredGroups"
        :key="group.id"
        class="group-selector__option"
        :title="t('admin.groups.rateAndAccounts', { rate: group.rate_multiplier, count: group.account_count || 0 })"
      >
        <UiCheckbox
          :model-value="modelValue.includes(group.id)"
          :value="group.id"
          full-width
          @update:model-value="handleChange(group.id, $event)"
        >
          <span class="group-selector__option-content">
            <GroupBadge
              :name="group.name"
              :platform="group.platform"
              :rate-multiplier="group.rate_multiplier"
              class="group-selector__badge"
            />
            <span class="group-selector__count">{{ group.account_count || 0 }}</span>
          </span>
        </UiCheckbox>
      </div>
      <div
        v-if="filteredGroups.length === 0"
        class="group-selector__empty"
      >
        {{ t('common.noGroupsAvailable') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GroupBadge from './GroupBadge.vue'
import { UiCheckbox, UiSearchInput } from '@/components/ui'
import type { AdminGroup, GroupPlatform } from '@/types'

const { t } = useI18n()

interface Props {
  modelValue: number[]
  groups: AdminGroup[]
  platform?: GroupPlatform // Optional platform filter
  mixedScheduling?: boolean // For antigravity accounts: allow anthropic/gemini groups
  searchable?: boolean | 'auto'
}

const props = withDefaults(defineProps<Props>(), {
  searchable: 'auto'
})
const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const searchText = ref('')

const isSearchable = computed(() => {
  if (props.searchable === 'auto') return props.groups.length > 5
  return props.searchable
})

// Filter groups by platform if specified
const filteredGroups = computed(() => {
  let result: AdminGroup[] = props.groups
  if (props.platform) {
    // antigravity 账户启用混合调度后，可选择 anthropic/gemini 分组
    if (props.platform === 'antigravity' && props.mixedScheduling) {
      result = result.filter(
        (g) => g.platform === 'antigravity' || g.platform === 'anthropic' || g.platform === 'gemini' || g.platform === 'composite'
      )
    } else {
      // 默认：只能选择同 platform 的分组；composite 分组可接收任意具体平台账号
      result = result.filter((g) => g.platform === props.platform || g.platform === 'composite')
    }
  }
  if (isSearchable.value && searchText.value) {
    const q = searchText.value.toLowerCase()
    result = result.filter(
      (g) => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    )
  }
  return result
})

const handleChange = (groupId: number, checked: boolean) => {
  const newValue = checked
    ? [...props.modelValue, groupId]
    : props.modelValue.filter((id) => id !== groupId)
  emit('update:modelValue', newValue)
}
</script>

<style scoped>
.group-selector{display:grid;gap:6px}
.group-selector__label{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--ui-text);font-size:13px;font-weight:500;line-height:20px}
.group-selector__label span{color:var(--ui-text-soft);font-size:12px;font-weight:400;font-variant-numeric:tabular-nums}
.group-selector__search{padding:6px;border:1px solid var(--ui-border);border-bottom:0;border-radius:var(--ui-radius) var(--ui-radius) 0 0;background:var(--ui-surface-muted)}
.group-selector__options{display:grid;max-height:144px;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;padding:6px;overflow-y:auto;border:1px solid var(--ui-border);border-radius:var(--ui-radius);background:var(--ui-surface-muted)}
.group-selector__options--searchable{border-radius:0 0 var(--ui-radius) var(--ui-radius)}
.group-selector__option{min-width:0;padding:4px 6px;border-radius:var(--ui-radius);transition:background var(--ui-motion-fast)}
.group-selector__option:hover{background:var(--ui-surface)}
.group-selector__option-content{display:flex;min-width:0;flex:1;align-items:center;gap:6px}
.group-selector__badge{min-width:0;flex:1}
.group-selector__count{flex:none;color:var(--ui-text-soft);font-family:var(--ui-font-mono);font-size:11px;font-variant-numeric:tabular-nums}
.group-selector__empty{grid-column:1/-1;padding:8px;color:var(--ui-text-muted);font-size:12px;text-align:center}
@media(max-width:560px){.group-selector__options{grid-template-columns:minmax(0,1fr)}}
</style>
