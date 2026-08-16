<template>
  <UiButtonGroup :label="t('admin.channelMonitor.columns.actions')">
    <UiIconButton
      v-if="canRun"
      data-testid="monitor-run"
      density="dense"
      variant="ghost"
      :label="t('admin.channelMonitor.runNow')"
      :disabled="running"
      @click="emit('run', row)"
    >
      <Icon name="refresh" size="sm" :class="running ? 'animate-spin' : ''" />
    </UiIconButton>
    <UiIconButton
      data-testid="monitor-duplicate"
      icon="copy"
      density="dense"
      variant="ghost"
      :label="duplicateTitle"
      :disabled="duplicating || Boolean(row.api_key_decrypt_failed)"
      @click="emit('duplicate', row)"
    />
    <UiIconButton
      data-testid="monitor-history"
      icon="clock"
      density="dense"
      variant="ghost"
      :label="t('admin.channelMonitor.history.action')"
      @click="emit('history', row)"
    />
    <UiIconButton icon="edit" density="dense" variant="ghost" :label="t('common.edit')" @click="emit('edit', row)" />
    <UiIconButton icon="trash" density="dense" variant="danger" :label="t('common.delete')" @click="emit('delete', row)" />
  </UiButtonGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ChannelMonitor } from '@/api/admin/channelMonitor'
import Icon from '@/components/icons/Icon.vue'
import { UiButtonGroup, UiIconButton } from '@/components/ui'

const props = withDefaults(defineProps<{
  row: ChannelMonitor
  running: boolean
  duplicating: boolean
  canRun?: boolean
}>(), { canRun: true })

const emit = defineEmits<{
  (e: 'run', row: ChannelMonitor): void
  (e: 'duplicate', row: ChannelMonitor): void
  (e: 'history', row: ChannelMonitor): void
  (e: 'edit', row: ChannelMonitor): void
  (e: 'delete', row: ChannelMonitor): void
}>()

const { t } = useI18n()
const duplicateTitle = computed(() => {
  if (props.row.api_key_decrypt_failed) return t('admin.channelMonitor.duplicateKeyUnavailable')
  if (props.duplicating) return t('admin.channelMonitor.duplicating')
  return t('admin.channelMonitor.duplicate')
})
</script>
