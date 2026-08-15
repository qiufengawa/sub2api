<template>
  <div v-if="groups && groups.length > 0" class="max-w-56">
    <div class="flex max-h-14 flex-wrap gap-1 overflow-hidden">
      <GroupBadge
        v-for="group in displayGroups"
        :key="group.id"
        :name="group.name"
        :platform="group.platform"
        :rate-multiplier="group.rate_multiplier"
        :show-rate="false"
        class="max-w-24"
      />
      <UiPopover v-if="hiddenCount > 0" placement="bottom-start">
        <template #trigger>
          <UiBadge class="cursor-pointer" :label="`+${hiddenCount}`" />
        </template>
        <template #default="{ close }">
        <div class="p-2">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
              {{ t('admin.accounts.groupCountTotal', { count: groups.length }) }}
            </span>
            <UiIconButton :label="t('common.close')" icon="x" variant="ghost" density="mini" @click="close" />
          </div>
          <div class="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto">
            <GroupBadge
              v-for="group in groups"
              :key="group.id"
              :name="group.name"
              :platform="group.platform"
              :rate-multiplier="group.rate_multiplier"
              :show-rate="false"
            />
          </div>
        </div>
        </template>
      </UiPopover>
    </div>
  </div>
  <span v-else class="text-sm text-gray-400 dark:text-dark-500">-</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GroupBadge from '@/components/common/GroupBadge.vue'
import { UiBadge, UiIconButton, UiPopover } from '@/components/ui'
import type { Group } from '@/types'

interface Props {
  groups: Group[] | null | undefined
  maxDisplay?: number
}

const props = withDefaults(defineProps<Props>(), { maxDisplay: 4 })
const { t } = useI18n()

const displayGroups = computed(() => {
  if (!props.groups) return []
  return props.groups.length <= props.maxDisplay
    ? props.groups
    : props.groups.slice(0, props.maxDisplay - 1)
})

const hiddenCount = computed(() => {
  if (!props.groups || props.groups.length <= props.maxDisplay) return 0
  return props.groups.length - (props.maxDisplay - 1)
})
</script>
