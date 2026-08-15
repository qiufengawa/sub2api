<template>
  <AppInline v-if="groups && groups.length > 0" :gap="4">
      <UiBadge
        v-for="group in displayGroups"
        :key="group.id"
        :label="group.name"
      />
      <UiPopover v-if="hiddenCount > 0" placement="bottom-start">
        <template #trigger>
          <UiBadge :label="`+${hiddenCount}`" />
        </template>
        <template #default="{ close }">
        <AppStack :gap="8">
          <AppInline justify="space-between">
            <UiBadge :label="t('admin.accounts.groupCountTotal', { count: groups.length })" />
            <UiIconButton :label="t('common.close')" icon="x" variant="ghost" density="mini" @click="close" />
          </AppInline>
          <AppInline :gap="6">
            <UiBadge
              v-for="group in groups"
              :key="group.id"
              :label="group.name"
            />
          </AppInline>
        </AppStack>
        </template>
      </UiPopover>
  </AppInline>
  <UiBadge v-else label="-" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppInline, AppStack, UiBadge, UiIconButton, UiPopover } from '@/components/ui'
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
