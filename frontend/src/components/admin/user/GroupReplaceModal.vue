<template>
  <BaseDialog :show="show" :title="t('admin.users.replaceGroupTitle')" width="narrow" @close="$emit('close')">
    <div v-if="oldGroup" class="space-y-4">
      <!-- 提示信息 -->
      <p class="text-sm text-gray-600 dark:text-gray-400">
        {{ t('admin.users.replaceGroupHint', { old: oldGroup.name }) }}
      </p>

      <!-- 当前分组 -->
      <div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-dark-600 dark:bg-dark-800">
        <div class="flex items-center gap-2">
          <Icon name="shield" size="sm" class="text-purple-500" />
          <span class="font-medium text-gray-900 dark:text-white">{{ oldGroup.name }}</span>
          <Icon name="arrowRight" size="sm" class="ml-auto text-gray-400" />
          <span v-if="selectedGroupId" class="font-medium text-primary-600 dark:text-primary-400">
            {{ availableGroups.find(g => g.id === selectedGroupId)?.name }}
          </span>
          <span v-else class="text-sm text-gray-400">?</span>
        </div>
      </div>

      <!-- 可选分组列表 -->
      <div v-if="availableGroups.length > 0" class="max-h-64 overflow-y-auto">
        <UiRadioGroup
          :model-value="selectedGroupId ?? 0"
          @update:model-value="selectedGroupId = Number($event)"
          :name="`replace-group-${oldGroup?.id}`"
          layout="stacked"
          :options="availableGroups.map(group => ({
            value: group.id,
            label: `${group.name} · ${group.platform}`
          }))"
        />
      </div>

      <!-- 无可选分组 -->
      <div v-else class="py-6 text-center text-sm text-gray-400">
        {{ t('admin.users.noOtherGroups') }}
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UiButton @click="$emit('close')">{{ t('common.cancel') }}</UiButton>
        <UiButton
          @click="handleReplace"
          :disabled="!selectedGroupId || submitting"
          variant="primary" :loading="submitting"
        >
          {{ submitting ? t('common.saving') : t('admin.users.replaceGroupConfirm') }}
        </UiButton>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUser, AdminGroup } from '@/types'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiRadioGroup } from '@/components/ui'

interface Props {
  show: boolean
  user: AdminUser | null
  oldGroup: { id: number; name: string } | null
  allGroups: AdminGroup[]
}

const props = defineProps<Props>()
const emit = defineEmits(['close', 'success'])
const { t } = useI18n()
const appStore = useAppStore()

const selectedGroupId = ref<number | null>(null)
const submitting = ref(false)

// 可选的专属标准分组（排除当前 oldGroup）
const availableGroups = computed(() => {
  if (!props.oldGroup) return []
  return props.allGroups.filter(
    g => g.status === 'active' && g.is_exclusive && g.subscription_type === 'standard' && g.id !== props.oldGroup!.id
  )
})

watch(() => props.show, (v) => {
  if (v) {
    selectedGroupId.value = null
  }
})

const handleReplace = async () => {
  if (!props.user || !props.oldGroup || !selectedGroupId.value) return
  submitting.value = true

  try {
    const result = await adminAPI.users.replaceGroup(props.user.id, props.oldGroup.id, selectedGroupId.value)
    appStore.showSuccess(t('admin.users.replaceGroupSuccess', { count: result.migrated_keys }))
    emit('success')
    emit('close')
  } catch (error) {
    console.error('Failed to replace group:', error)
  } finally {
    submitting.value = false
  }
}
</script>
