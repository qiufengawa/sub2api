<template>
  <AppStack :gap="8">
    <AppInline :gap="4">
      <UiButton density="dense" variant="quiet" @click="toggleImportPanel">
        <template #icon><Icon name="document" size="sm" /></template>
        {{ t('admin.accounts.headerOverride.importJson') }}
      </UiButton>
      <UiButton density="dense" variant="quiet" :disabled="!hasNamedRows" @click="copyAsJson">
        <template #icon><Icon name="copy" size="sm" /></template>
        {{ t('admin.accounts.headerOverride.copyJson') }}
      </UiButton>
    </AppInline>

    <div v-if="showImportPanel" ref="importPanelRef" class="header-json-tools__panel">
      <UiTextArea
        ref="importTextareaRef"
        v-model="importText"
        :rows="5"
        monospace
        :label="t('admin.accounts.headerOverride.importJson')"
        :description="t('admin.accounts.headerOverride.importJsonHint')"
        :placeholder="IMPORT_JSON_PLACEHOLDER"
      />
      <AppInline :gap="6">
        <UiButton density="dense" variant="primary" @click="applyImport">
          {{ t('admin.accounts.headerOverride.importJsonApply') }}
        </UiButton>
        <UiButton density="dense" variant="secondary" @click="closeImportPanel">
          {{ t('admin.accounts.headerOverride.importJsonCancel') }}
        </UiButton>
      </AppInline>
    </div>
  </AppStack>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import Icon from '@/components/icons/Icon.vue'
import { AppInline, AppStack, UiButton, UiTextArea } from '@/components/ui'
import {
  parseHeaderOverridesJson,
  serializeHeaderOverrideRows,
  type HeaderOverrideRow
} from './credentialsBuilder'

const props = defineProps<{
  rows: HeaderOverrideRow[]
}>()

const emit = defineEmits<{
  (e: 'update:rows', rows: HeaderOverrideRow[]): void
}>()

const { t } = useI18n()
const appStore = useAppStore()
const { copyToClipboard } = useClipboard()

// JSON 示例语言中立，且花括号会被 vue-i18n 消息编译器当作插值占位符解析
// 导致渲染时抛 SyntaxError，因此不走 i18n。
const IMPORT_JSON_PLACEHOLDER = '{"user-agent": "my-client/1.0", "x-relay-token": "..."}'

const showImportPanel = ref(false)
const importText = ref('')
const importPanelRef = ref<HTMLElement | null>(null)
const importTextareaRef = ref<InstanceType<typeof UiTextArea> | null>(null)

const hasNamedRows = computed(() => props.rows.some((row) => row.name.trim()))

// 面板在弹窗滚动容器（.modal-body）内向下展开，可能落在当前视野之外，
// 打开后必须主动滚入视野，否则看起来像点击无效。
const toggleImportPanel = async () => {
  showImportPanel.value = !showImportPanel.value
  if (!showImportPanel.value) return
  await nextTick()
  importPanelRef.value?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  importTextareaRef.value?.focus()
}

const closeImportPanel = () => {
  showImportPanel.value = false
  importText.value = ''
}

const applyImport = () => {
  const rows = parseHeaderOverridesJson(importText.value)
  if (rows === null) {
    appStore.showError(t('admin.accounts.headerOverride.importJsonInvalid'))
    return
  }
  emit('update:rows', rows)
  closeImportPanel()
}

const copyAsJson = () => {
  void copyToClipboard(serializeHeaderOverrideRows(props.rows))
}
</script>

<style scoped>
.header-json-tools__panel{display:grid;gap:8px;min-width:0}
</style>
