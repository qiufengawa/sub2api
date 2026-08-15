<template>
  <UiDialog
    :show="show"
    :title="t('admin.proxies.dataImportTitle')"
    width="normal"
    close-on-click-outside
    @close="handleClose"
  >
    <form id="import-proxy-data-form" class="proxy-import" @submit.prevent="handleImport">
      <p class="proxy-import__hint">{{ t('admin.proxies.dataImportHint') }}</p>
      <UiAlert tone="warning" :message="t('admin.proxies.dataImportWarning')" />

      <UiFileUpload
        :label="t('admin.proxies.dataImportFile')"
        accept="application/json,.json"
        :accept-text="fileName || 'JSON (.json)'"
        :button-text="t('common.chooseFile')"
        :disabled="importing"
        @select="handleFileSelect"
      />

      <UiAlert
        v-if="result"
        :tone="result.proxy_failed > 0 ? 'danger' : 'success'"
        :title="t('admin.proxies.dataImportResult')"
        :message="t('admin.proxies.dataImportResultSummary', result)"
      />
      <UiCodeBlock v-if="errorItems.length" :label="t('admin.proxies.dataImportErrors')" :code="errorCode" />
    </form>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UiButton type="button" density="compact" :disabled="importing" @click="handleClose">
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          type="submit"
          form="import-proxy-data-form"
          variant="primary"
          density="compact"
          :loading="importing"
        >
          {{ importing ? t('admin.proxies.dataImporting') : t('admin.proxies.dataImportButton') }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import { useAppStore } from '@/stores/app'
import type { AdminDataImportResult } from '@/types'
import { UiAlert, UiButton, UiCodeBlock, UiDialog, UiFileUpload } from '@/components/ui'

interface Props {
  show: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'imported'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const appStore = useAppStore()

const importing = ref(false)
const file = ref<File | null>(null)
const result = ref<AdminDataImportResult | null>(null)

const fileName = computed(() => file.value?.name || '')

const errorItems = computed(() => result.value?.errors || [])
const errorCode = computed(() => errorItems.value.map((item) => (
  `${item.kind} ${item.name || item.proxy_key || '-'} - ${item.message}`
)).join('\n'))

watch(
  () => props.show,
  (open) => {
    if (open) {
      file.value = null
      result.value = null
    }
  }
)

const handleFileSelect = (files: File[]) => {
  file.value = files[0] || null
}

const handleClose = () => {
  if (importing.value) return
  emit('close')
}

const readFileAsText = async (sourceFile: File): Promise<string> => {
  if (typeof sourceFile.text === 'function') {
    return sourceFile.text()
  }

  if (typeof sourceFile.arrayBuffer === 'function') {
    const buffer = await sourceFile.arrayBuffer()
    return new TextDecoder().decode(buffer)
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error || new Error(t('common.fileReadFailed')))
    reader.readAsText(sourceFile)
  })
}

const handleImport = async () => {
  if (!file.value) {
    appStore.showError(t('admin.proxies.dataImportSelectFile'))
    return
  }

  importing.value = true
  try {
    const text = await readFileAsText(file.value)
    const dataPayload = JSON.parse(text)

    const res = await adminAPI.proxies.importData({ data: dataPayload })

    result.value = res

    const msgParams: Record<string, unknown> = {
      proxy_created: res.proxy_created,
      proxy_reused: res.proxy_reused,
      proxy_failed: res.proxy_failed
    }

    if (res.proxy_failed > 0) {
      appStore.showError(t('admin.proxies.dataImportCompletedWithErrors', msgParams))
    } else {
      appStore.showSuccess(t('admin.proxies.dataImportSuccess', msgParams))
      emit('imported')
    }
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      appStore.showError(t('admin.proxies.dataImportParseFailed'))
    } else {
      appStore.showError(error?.message || t('admin.proxies.dataImportFailed'))
    }
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.proxy-import { display: grid; gap: 14px; }
.proxy-import__hint { margin: 0; color: var(--ui-text-muted); font-size: 13px; line-height: 20px; }
</style>
