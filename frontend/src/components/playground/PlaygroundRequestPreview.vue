<template>
  <UiDialog
    :show="show"
    :title="t('playground.preview.title')"
    width="wide"
    @close="emit('close')"
  >
    <UiCodeBlock
      :code="content"
      label="JSON"
      :copy-label="t('playground.actions.copy')"
      :copy-success-text="t('playground.actions.copied')"
      @copy-error="appStore.showError(t('playground.errors.clipboard'))"
    />
  </UiDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { UiCodeBlock, UiDialog } from '@/components/ui'
import { useAppStore } from '@/stores/app'

defineProps<{ show: boolean; content: string }>()
const emit = defineEmits<{ (event: 'close'): void }>()
const { t } = useI18n()
const appStore = useAppStore()
</script>

<style scoped>
:deep(.ui-code-block pre) { max-height: 62dvh; }
</style>
