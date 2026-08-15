<template>
  <UiDialog
    :show="show"
    :title="title"
    width="narrow"
    :close-on-escape="!pending"
    :show-close-button="!pending"
    @close="cancel"
  >
    <div class="ui-confirm">
      <Icon :name="danger ? 'exclamationTriangle' : 'infoCircle'" size="sm" />
      <div><p>{{ message }}</p><slot /></div>
    </div>
    <template #footer>
      <div class="ui-confirm__actions">
        <UiButton autofocus :disabled="pending" @click="cancel">{{ cancelText || '取消' }}</UiButton>
        <UiButton
          :variant="danger ? 'danger' : 'primary'"
          :loading="pending"
          :disabled="confirmDisabled"
          @click="confirm"
        >
          {{ confirmText || '确认' }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'
import UiButton from './UiButton.vue'
import UiDialog from './UiDialog.vue'

const props = withDefaults(defineProps<{
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  pending?: boolean
  confirmDisabled?: boolean
}>(), { danger: false, pending: false, confirmDisabled: false })
const emit = defineEmits<{ confirm: []; cancel: [] }>()

function confirm(): void {
  if (!props.pending && !props.confirmDisabled) emit('confirm')
}

function cancel(): void {
  if (!props.pending) emit('cancel')
}
</script>

<style scoped>
.ui-confirm{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start}.ui-confirm>svg{margin-top:3px;color:var(--ui-warning)}.ui-confirm p{margin:0;color:var(--ui-text-muted);font-size:14px;line-height:22px}.ui-confirm__actions{display:flex;justify-content:flex-end;gap:8px;width:100%}@media(max-width:520px){.ui-confirm__actions{display:grid;grid-template-columns:1fr 1fr}}
</style>
