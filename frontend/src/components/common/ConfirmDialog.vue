<template>
  <BaseDialog
    :show="show"
    :title="title"
    width="narrow"
    :close-on-escape="!pending"
    :show-close-button="!pending"
    @close="handleCancel"
  >
    <div class="space-y-3">
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ message }}</p>
      <slot></slot>
    </div>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          @click="handleCancel"
          type="button"
          class="btn btn-secondary btn-sm w-full sm:w-auto"
          :disabled="pending"
        >
          {{ cancelText }}
        </button>
        <button
          @click="handleConfirm"
          type="button"
          :class="[
            'btn btn-sm w-full sm:w-auto',
            danger
              ? 'btn-danger'
              : 'btn-primary'
          ]"
          :disabled="pending || confirmDisabled"
        >
          <span v-if="pending" class="spinner h-4 w-4" aria-hidden="true"></span>
          {{ confirmText }}
        </button>
      </div>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from './BaseDialog.vue'

const { t } = useI18n()

interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  pending?: boolean
  confirmDisabled?: boolean
}

interface Emits {
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  danger: false,
  pending: false,
  confirmDisabled: false
})

const confirmText = computed(() => props.confirmText || t('common.confirm'))
const cancelText = computed(() => props.cancelText || t('common.cancel'))

const emit = defineEmits<Emits>()

const handleConfirm = () => {
  if (props.pending || props.confirmDisabled) return
  emit('confirm')
}

const handleCancel = () => {
  if (props.pending) return
  emit('cancel')
}
</script>
