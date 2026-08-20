<template>
  <div class="mb-3 flex flex-wrap items-center justify-between gap-3 border-block border-[var(--ui-border-soft)] py-2" :aria-busy="pending">
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="allResultsSelected" class="text-sm font-medium text-primary-900 dark:text-primary-100">
        {{ t('admin.accounts.bulkActions.selectedAll', { count: selectedIds.length }) }}
      </span>
      <span v-else-if="selectedIds.length > 0" class="text-sm font-medium text-primary-900 dark:text-primary-100">
        {{ t('admin.accounts.bulkActions.selected', { count: selectedIds.length }) }}
      </span>
      <span v-else class="text-sm font-medium text-primary-900 dark:text-primary-100">
        {{ t('admin.accounts.bulkEdit.title') }}
      </span>
      <template v-if="selectedIds.length > 0">
        <UiButton
          density="dense"
          variant="quiet"
          :disabled="pending"
          @click="$emit('select-page')"
        >
          {{ t('admin.accounts.bulkActions.selectCurrentPage') }}
        </UiButton>
      </template>
      <template v-if="!allResultsSelected && totalResults > selectedIds.length">
        <span v-if="selectedIds.length > 0" class="text-gray-300 dark:text-primary-800">•</span>
        <UiButton
          density="dense"
          variant="quiet"
          :disabled="selectingAll || pending"
          @click="$emit('select-all-results')"
        >
          {{
            selectingAll
              ? t('admin.accounts.bulkActions.selectingAll')
              : t('admin.accounts.bulkActions.selectAllResults', { count: totalResults })
          }}
        </UiButton>
      </template>
      <template v-if="selectedIds.length > 0">
        <span class="text-gray-300 dark:text-primary-800">•</span>
        <UiButton
          density="dense"
          variant="quiet"
          :disabled="pending"
          @click="$emit('clear')"
        >
          {{ t('admin.accounts.bulkActions.clear') }}
        </UiButton>
      </template>
    </div>
    <div class="flex gap-2">
      <template v-if="selectedIds.length > 0">
        <UiButton density="compact" variant="danger" :disabled="pending" @click="$emit('delete')">{{ t('admin.accounts.bulkActions.delete') }}</UiButton>
        <UiButton density="compact" variant="secondary" :disabled="pending" @click="$emit('reset-status')">{{ t('admin.accounts.bulkActions.resetStatus') }}</UiButton>
        <UiButton density="compact" variant="secondary" :disabled="pending" @click="$emit('refresh-token')">{{ t('admin.accounts.bulkActions.refreshToken') }}</UiButton>
        <UiButton density="compact" variant="secondary" :disabled="pending" @click="$emit('probe-upstream-billing')">{{ t('admin.accounts.bulkActions.probeUpstreamBilling') }}</UiButton>
        <UiButton density="compact" variant="secondary" :disabled="pending" @click="$emit('toggle-schedulable', true)">{{ t('admin.accounts.bulkActions.enableScheduling') }}</UiButton>
        <UiButton density="compact" variant="secondary" :disabled="pending" @click="$emit('toggle-schedulable', false)">{{ t('admin.accounts.bulkActions.disableScheduling') }}</UiButton>
        <UiButton density="compact" variant="primary" :disabled="pending" @click="$emit('edit-selected')">{{ t('admin.accounts.bulkActions.edit') }}</UiButton>
      </template>
      <UiButton density="compact" variant="primary" :disabled="pending" @click="$emit('edit-filtered')">
        {{ t('admin.accounts.bulkEdit.submit') }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { UiButton } from '@/components/ui'

defineProps<{
  selectedIds: number[]
  totalResults: number
  selectingAll: boolean
  allResultsSelected: boolean
  pending?: boolean
}>()

defineEmits([
  'delete',
  'edit-selected',
  'edit-filtered',
  'clear',
  'select-page',
  'select-all-results',
  'toggle-schedulable',
  'reset-status',
  'refresh-token',
  'probe-upstream-billing'
])

const { t } = useI18n()
</script>
