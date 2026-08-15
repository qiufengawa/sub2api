<template>
  <UiDialog :show="show" :title="t('admin.channelMonitor.form.selectKeyTitle')" width="wide" @close="emit('close')">
    <AppStack :gap="12">
      <UiAlert :message="t('admin.channelMonitor.form.selectKeyHint')" />
      <UiSearchInput v-model="search" density="compact" :placeholder="t('keys.searchPlaceholder')" />
      <UiSkeleton v-if="loading" height="220px" />
      <UiEmptyState v-else-if="filteredKeys.length === 0" :title="t('admin.channelMonitor.form.noActiveKey')" />
      <UiMobileTableScroller v-else :label="t('admin.channelMonitor.form.selectKeyTitle')" min-width="560px">
        <UiDataTable :columns="columns" :data="filteredKeys" mobile-table :aria-label="t('admin.channelMonitor.form.selectKeyTitle')" @row-click="emit('pick', $event)">
          <template #cell-name="{ row }"><UiDataCell :value="row.name" :meta="maskApiKey(row.key)" mono /></template>
          <template #cell-group="{ row }"><UiDataCell :value="row.group?.name || '-'" :meta="groupMeta(row)" /></template>
          <template #cell-actions="{ row }"><UiButton density="dense" variant="quiet" @click="emit('pick', row)">{{ t('common.select') }}</UiButton></template>
        </UiDataTable>
      </UiMobileTableScroller>
    </AppStack>
    <template #footer><AppInline justify="flex-end"><UiButton density="compact" @click="emit('close')">{{ t('common.cancel') }}</UiButton></AppInline></template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ApiKey } from '@/types'
import type { Provider } from '@/api/admin/channelMonitor'
import type { Column } from '@/components/ui'
import { AppInline, AppStack, UiAlert, UiButton, UiDataCell, UiDataTable, UiDialog, UiEmptyState, UiMobileTableScroller, UiSearchInput, UiSkeleton } from '@/components/ui'
import { maskApiKey } from '@/utils/maskApiKey'

const props = withDefaults(defineProps<{
  show: boolean
  loading: boolean
  keys: ApiKey[]
  provider: Provider
  userGroupRates?: Record<number, number>
}>(), { userGroupRates: () => ({}) })

const emit = defineEmits<{ (e: 'close'): void; (e: 'pick', key: ApiKey): void }>()
const { t } = useI18n()
const search = ref('')
const columns = computed<Column[]>(() => [
  { key: 'name', label: t('common.name') },
  { key: 'group', label: t('keys.group') },
  { key: 'actions', label: t('common.actions') },
])

watch(() => props.show, (shown) => { if (!shown) search.value = '' })

const filteredKeys = computed<ApiKey[]>(() => {
  const query = search.value.trim().toLowerCase()
  return props.keys.filter((key) => {
    if (key.group?.platform !== props.provider) return false
    if (!query) return true
    return key.name.toLowerCase().includes(query) || key.key.toLowerCase().includes(query) || (key.group?.name || '').toLowerCase().includes(query)
  })
})

function groupMeta(key: ApiKey): string {
  if (!key.group) return '-'
  const userRate = props.userGroupRates[key.group.id]
  return `${key.group.platform} · ${userRate ?? key.group.rate_multiplier}x`
}
</script>
