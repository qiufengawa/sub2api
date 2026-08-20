<template>
  <Teleport to="body">
    <Transition name="ui-dialog">
      <div
        v-if="show"
        class="ui-dialog__overlay"
        :style="{ zIndex }"
        @mousedown.self="closeFromOutside"
      >
        <section
          ref="panelRef"
          class="ui-dialog"
          :class="`ui-dialog--${width}`"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <header class="ui-dialog__header">
            <h2 :id="titleId">{{ title }}</h2>
            <UiIconButton
              v-if="showCloseButton"
              :label="resolvedCloseLabel"
              variant="ghost"
              density="dense"
              @click="emit('close')"
            >
              <Icon name="x" size="sm" />
            </UiIconButton>
          </header>
          <div class="ui-dialog__body"><slot /></div>
          <footer v-if="$slots.footer" class="ui-dialog__footer"><slot name="footer" /></footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiIconButton from './UiIconButton.vue'
import { useOverlayLifecycle } from './useOverlayLifecycle'
import { useUiT } from './useUiI18n'

type DialogWidth = 'narrow' | 'normal' | 'wide' | 'extra-wide' | 'full'

let dialogId = 0
const titleId = `ui-dialog-title-${++dialogId}`
const props = withDefaults(defineProps<{
  show: boolean
  title: string
  width?: DialogWidth
  closeOnEscape?: boolean
  closeOnClickOutside?: boolean
  showCloseButton?: boolean
  closeLabel?: string
  zIndex?: number
}>(), {
  width: 'normal',
  closeOnEscape: true,
  closeOnClickOutside: false,
  showCloseButton: true,
  zIndex: 100_000_000
})
const emit = defineEmits<{ close: [] }>()
const t = useUiT()
const resolvedCloseLabel = computed(() => props.closeLabel || t('common.close'))
const { panelRef, zIndex } = useOverlayLifecycle(
  toRef(props, 'show'),
  () => emit('close'),
  { closeOnEscape: () => props.closeOnEscape, zIndex: props.zIndex }
)

function closeFromOutside(): void {
  if (props.closeOnClickOutside) emit('close')
}
</script>

<style scoped>
.ui-dialog__overlay{position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:rgb(0 0 0/.32)}
.ui-dialog{display:grid;width:100%;max-height:calc(100dvh - 48px);grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;border:1px solid var(--ui-border);border-radius:var(--ui-radius-panel);color:var(--ui-text);background:var(--ui-surface);box-shadow:0 12px 32px rgb(31 35 41/.12)}
.ui-dialog--narrow{max-width:420px}.ui-dialog--normal{max-width:560px}.ui-dialog--wide{max-width:860px}.ui-dialog--extra-wide{max-width:1120px}.ui-dialog--full{max-width:calc(100vw - 48px);height:calc(100dvh - 48px)}
.ui-dialog__header,.ui-dialog__footer{display:flex;min-height:52px;align-items:center;justify-content:space-between;gap:12px;padding:10px 20px;border-bottom:1px solid var(--ui-border-soft)}
.ui-dialog__footer{justify-content:flex-end;border-top:1px solid var(--ui-border-soft);border-bottom:0}
.ui-dialog__header h2{margin:0;font-size:16px;font-weight:600;line-height:24px;letter-spacing:0}
.ui-dialog__body{min-height:0;padding:20px;overflow:auto}
.ui-dialog-enter-active,.ui-dialog-leave-active{transition:opacity var(--ui-motion-base) var(--ui-ease-standard)}
.ui-dialog-enter-active .ui-dialog,.ui-dialog-leave-active .ui-dialog{transition:transform var(--ui-motion-base) var(--ui-ease-enter)}
.ui-dialog-enter-from,.ui-dialog-leave-to{opacity:0}.ui-dialog-enter-from .ui-dialog,.ui-dialog-leave-to .ui-dialog{transform:translateY(6px)}
@media(max-width:640px){.ui-dialog__overlay{align-items:end;padding:0}.ui-dialog{max-width:none;max-height:calc(100dvh - env(safe-area-inset-top));border-width:1px 0 0;border-radius:8px 8px 0 0;padding-bottom:env(safe-area-inset-bottom)}.ui-dialog__header,.ui-dialog__footer{padding-inline:16px}.ui-dialog__body{padding:16px}.ui-dialog--full{height:100dvh;border:0;border-radius:0}}
@media(prefers-reduced-motion:reduce){.ui-dialog-enter-active,.ui-dialog-leave-active,.ui-dialog-enter-active .ui-dialog,.ui-dialog-leave-active .ui-dialog{transition:none}}
</style>
