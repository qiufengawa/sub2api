<template>
  <BaseDialog
    :show="show"
    :title="t('playground.preview.title')"
    width="wide"
    @close="emit('close')"
  >
    <div class="overflow-hidden rounded-[4px] border border-gray-200 bg-gray-950 dark:border-dark-600">
      <div class="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span class="text-xs text-gray-400">JSON</span>
        <button type="button" class="btn h-7 border-white/15 bg-white/10 px-2 text-xs text-gray-100 hover:bg-white/15" @click="copyPreview">
          <Icon :name="copied ? 'check' : 'copy'" size="sm" class="mr-1.5" />
          {{ copied ? t('playground.actions.copied') : t('playground.actions.copy') }}
        </button>
      </div>
      <pre class="max-h-[62dvh] overflow-auto p-4 text-xs leading-6 text-gray-100"><code>{{ props.content }}</code></pre>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
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
