<template>
  <UiDialog :show="show" :title="t('admin.users.replaceGroupTitle')" width="narrow" @close="$emit('close')">
    <div v-if="oldGroup" class="group-replace">
      <p class="group-replace__hint">
        {{ t('admin.users.replaceGroupHint', { old: oldGroup.name }) }}
      </p>

      <div class="group-replace__route">
          <Icon name="shield" size="sm" />
          <span>{{ oldGroup.name }}</span>
          <Icon name="arrowRight" size="sm" />
          <strong v-if="selectedGroupId">
            {{ availableGroups.find(g => g.id === selectedGroupId)?.name }}
          </strong>
          <span v-else>?</span>
      </div>

      <div v-if="availableGroups.length > 0" class="group-replace__options">
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

      <UiEmptyState v-else :title="t('admin.users.noOtherGroups')" />
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
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUser, AdminGroup } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiDialog, UiEmptyState, UiRadioGroup } from '@/components/ui'

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
    appStore.showError(t('common.error'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.group-replace{display:grid;gap:16px}.group-replace__hint{margin:0;color:var(--ui-text-muted);font-size:13px;line-height:21px}.group-replace__route{display:grid;grid-template-columns:auto minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;padding-block:10px;border-block:1px solid var(--ui-border-soft);font-size:13px}.group-replace__route>svg{color:var(--ui-text-soft)}.group-replace__route strong{font-weight:600}.group-replace__options{max-height:256px;overflow-y:auto}
</style>
