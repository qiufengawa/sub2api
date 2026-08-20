<template>
  <Transition name="ui-toast">
    <div
      v-if="show"
      class="ui-toast ui-motion"
      :class="`ui-toast--${tone}`"
      :role="tone === 'danger' ? 'alert' : 'status'"
      :aria-live="tone === 'danger' ? 'assertive' : 'polite'"
      aria-atomic="true"
    >
      <Icon :name="icon" size="sm" aria-hidden="true" />
      <span class="ui-toast__content"><b v-if="title">{{ title }}</b>{{ message }}</span>
      <UiIconButton
        v-if="dismissible"
        :label="resolvedCloseLabel"
        variant="ghost"
        density="mini"
        @click="emit('close')"
      >
        <Icon name="x" size="xs" />
      </UiIconButton>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiIconButton from './UiIconButton.vue'
import { useUiT } from './useUiI18n'

const props = withDefaults(defineProps<{
  show: boolean
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  message: string
  dismissible?: boolean
  closeLabel?: string
}>(), { tone: 'info', dismissible: true })
const emit = defineEmits<{ close: [] }>()
const t = useUiT()
const resolvedCloseLabel = computed(() => props.closeLabel || t('common.close'))
const icon = computed(() => ({ info: 'infoCircle', success: 'checkCircle', warning: 'exclamationTriangle', danger: 'exclamationCircle' } as const)[props.tone])
</script>

<style scoped>
.ui-toast{display:grid;width:min(360px,calc(100vw - 32px));grid-template-columns:16px minmax(0,1fr) auto;align-items:start;gap:8px;padding:10px 12px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);box-shadow:0 6px 18px rgb(31 35 41/.1);font-size:13px;line-height:20px}.ui-toast>svg{margin-top:2px}.ui-toast--success>svg{color:var(--ui-success)}.ui-toast--warning>svg{color:var(--ui-warning)}.ui-toast--danger>svg{color:var(--ui-danger)}.ui-toast--info>svg{color:var(--ui-info)}.ui-toast__content{min-width:0;overflow-wrap:anywhere}.ui-toast__content b{display:block;margin-bottom:2px;font-weight:600}.ui-toast-enter-active,.ui-toast-leave-active{transition:opacity var(--ui-motion-base),transform var(--ui-motion-base)}.ui-toast-enter-from,.ui-toast-leave-to{opacity:0;transform:translateY(-4px)}@media(prefers-reduced-motion:reduce){.ui-toast-enter-active,.ui-toast-leave-active{transition:none}}
</style>
