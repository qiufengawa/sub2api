<template>
  <UiDialog
    :show="show"
    :title="t('playground.preview.title')"
    width="wide"
    @close="emit('close')"
  >
    <div class="playground-preview">
      <div class="playground-preview__toolbar">
        <span>JSON</span>
        <UiButton density="compact" variant="quiet" @click="copyPreview">
          <template #icon><Icon :name="copied ? 'check' : 'copy'" size="sm" /></template>
          {{ copied ? t('playground.actions.copied') : t('playground.actions.copy') }}
        </UiButton>
      </div>
      <pre><code>{{ props.content }}</code></pre>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiDialog } from '@/components/ui'
import { useAppStore } from '@/stores/app'

const props = defineProps<{ show: boolean; content: string }>()
const emit = defineEmits<{ (event: 'close'): void }>()
const { t } = useI18n()
const appStore = useAppStore()
const copied = ref(false)

async function copyPreview(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.content)
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 1200)
  } catch {
    appStore.showError(t('playground.errors.clipboard'))
  }
}
</script>

<style scoped>
.playground-preview {
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  background: var(--ui-surface-strong);
}

.playground-preview__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid var(--ui-border);
  color: var(--ui-text-muted);
  font: 600 11px/16px var(--ui-font-mono);
}

.playground-preview pre {
  max-height: 62dvh;
  margin: 0;
  overflow: auto;
  padding: 14px;
  color: var(--ui-text);
  background: var(--ui-surface-strong);
  font: 12px/22px var(--ui-font-mono);
  white-space: pre;
}
</style>
