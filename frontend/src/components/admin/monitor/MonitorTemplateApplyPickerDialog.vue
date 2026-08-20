<template>
  <UiDialog :show="show" :title="t('admin.channelMonitor.template.applyPickerTitle', { name: templateName })" @close="emit('close')">
    <AppStack :gap="12">
      <UiAlert :message="t('admin.channelMonitor.template.applyPickerHint')" />
      <UiSkeleton v-if="loading" height="180px" />
      <UiEmptyState v-else-if="monitors.length === 0" :title="t('admin.channelMonitor.template.applyPickerEmpty')" />
      <template v-else>
        <AppInline justify="space-between">
          <UiButtonGroup :label="t('admin.channelMonitor.template.selectedCount', { n: selectedIds.length, total: monitors.length })">
            <UiButton density="dense" variant="quiet" @click="selectAll">{{ t('common.selectAll') }}</UiButton>
            <UiButton density="dense" variant="quiet" @click="selectNone">{{ t('admin.channelMonitor.template.selectNone') }}</UiButton>
          </UiButtonGroup>
          <UiBadge :label="t('admin.channelMonitor.template.selectedCount', { n: selectedIds.length, total: monitors.length })" />
        </AppInline>

        <AppStack :gap="6">
          <AppInline v-for="monitor in monitors" :key="monitor.id" justify="space-between">
            <UiCheckbox :model-value="selectedSet.has(monitor.id)" :label="monitor.name" @update:model-value="toggle(monitor.id)" />
            <AppInline>
              <UiBadge :label="monitor.provider" />
              <UiBadge v-if="monitor.provider === 'openai'" tone="info" :label="monitor.api_mode" />
              <UiStatusBadge :status="monitor.enabled ? 'active' : 'inactive'" :label="monitor.enabled ? t('admin.channelMonitor.onlyEnabled') : t('admin.channelMonitor.onlyDisabled')" />
            </AppInline>
          </AppInline>
        </AppStack>
      </template>
    </AppStack>

    <template #footer>
      <AppInline justify="flex-end">
        <UiButton density="compact" @click="emit('close')">{{ t('common.cancel') }}</UiButton>
        <UiButton density="compact" variant="primary" :loading="submitting" :disabled="submitting || selectedIds.length === 0" @click="handleApply">
          {{ submitting ? t('common.submitting') : t('admin.channelMonitor.template.applyPickerConfirm', { n: selectedIds.length }) }}
        </UiButton>
      </AppInline>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { adminAPI } from '@/api/admin'
import type { AssociatedMonitorBrief } from '@/api/admin/channelMonitorTemplate'
import { AppInline, AppStack, UiAlert, UiBadge, UiButton, UiButtonGroup, UiCheckbox, UiDialog, UiEmptyState, UiSkeleton, UiStatusBadge } from '@/components/ui'

const props = defineProps<{ show: boolean; templateId: number | null; templateName: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'applied', affected: number): void }>()
const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(false)
const submitting = ref(false)
const monitors = ref<AssociatedMonitorBrief[]>([])
const selectedIds = ref<number[]>([])
const selectedSet = computed(() => new Set(selectedIds.value))

watch(() => [props.show, props.templateId] as const, ([show, id]) => {
  if (show && id != null) void fetchMonitors(id)
}, { immediate: true })

async function fetchMonitors(id: number) {
  loading.value = true
  monitors.value = []
  selectedIds.value = []
  try {
    const { items } = await adminAPI.channelMonitorTemplate.listAssociatedMonitors(id)
    monitors.value = items
    selectedIds.value = items.map((monitor) => monitor.id)
  } catch (error: unknown) {
    appStore.showError(extractApiErrorMessage(error, t('common.error')))
  } finally {
    loading.value = false
  }
}

function toggle(id: number) {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(id)
}

function selectAll() { selectedIds.value = monitors.value.map((monitor) => monitor.id) }
function selectNone() { selectedIds.value = [] }

async function handleApply() {
  if (props.templateId == null || selectedIds.value.length === 0 || submitting.value) return
  submitting.value = true
  try {
    const { affected } = await adminAPI.channelMonitorTemplate.apply(props.templateId, [...selectedIds.value])
    appStore.showSuccess(t('admin.channelMonitor.template.applySuccess', { n: affected }))
    emit('applied', affected)
    emit('close')
  } catch (error: unknown) {
    appStore.showError(extractApiErrorMessage(error, t('common.error')))
  } finally {
    submitting.value = false
  }
}
</script>
