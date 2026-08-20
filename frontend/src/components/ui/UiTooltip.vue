<template>
  <span
    ref="triggerRef"
    class="ui-tooltip__trigger"
    v-bind="$attrs"
    :aria-describedby="show ? tooltipId : undefined"
    @mouseenter="openFromHover"
    @mouseleave="closeFromHover"
    @focusin="openFromHover"
    @focusout="closeFromHover"
    @click="toggleFromClick"
  >
    <slot />
  </span>
  <Teleport to="body">
    <Transition name="ui-tooltip">
      <div
        v-if="show"
        :id="tooltipId"
        ref="tooltipRef"
        role="tooltip"
        class="ui-tooltip"
        :class="widthClass"
        :data-placement="placement"
        :style="tooltipStyle"
      >
        <UiIconButton
          v-if="trigger === 'click'"
          class="ui-tooltip__close"
          :label="resolvedCloseLabel"
          variant="ghost"
          density="mini"
          @click.stop="close"
        >
          <Icon name="x" size="xs" />
        </UiIconButton>
        <slot name="content">{{ content }}</slot>
        <span class="ui-tooltip__arrow" aria-hidden="true" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '@/components/icons/Icon.vue'
import UiIconButton from './UiIconButton.vue'
import { useUiT } from './useUiI18n'

defineOptions({ inheritAttrs: false })

let tooltipCounter = 0
const tooltipId = `ui-tooltip-${++tooltipCounter}`
const props = withDefaults(defineProps<{
  content?: string
  trigger?: 'hover' | 'click'
  widthClass?: string
  closeLabel?: string
}>(), { content: '', trigger: 'hover', widthClass: '' })
const t = useUiT()
const resolvedCloseLabel = computed(() => props.closeLabel || t('common.close'))
const show = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const placement = ref<'top' | 'bottom'>('top')
const tooltipStyle = ref<Record<string, string>>({ top: '0px', left: '0px' })

function open(): void {
  show.value = true
  nextTick(updatePosition)
}

function close(): void {
  show.value = false
}

function openFromHover(): void {
  if (props.trigger === 'hover') open()
}

function closeFromHover(): void {
  if (props.trigger === 'hover') close()
}

function toggleFromClick(event: MouseEvent): void {
  if (props.trigger !== 'click') return
  event.stopPropagation()
  show.value ? close() : open()
}

function updatePosition(): void {
  const trigger = triggerRef.value
  const tooltip = tooltipRef.value
  if (!trigger || !tooltip) return
  const triggerRect = trigger.getBoundingClientRect()
  const tooltipRect = tooltip.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight
  const margin = 8
  const gap = 8
  const halfWidth = tooltipRect.width / 2
  const center = Math.min(
    Math.max(triggerRect.left + triggerRect.width / 2, margin + halfWidth),
    viewportWidth - margin - halfWidth
  )
  const spaceAbove = triggerRect.top - margin - gap
  const spaceBelow = viewportHeight - triggerRect.bottom - margin - gap
  placement.value = tooltipRect.height > spaceAbove && spaceBelow > spaceAbove ? 'bottom' : 'top'
  tooltipStyle.value = {
    left: `${center}px`,
    top: `${placement.value === 'bottom' ? triggerRect.bottom + gap : triggerRect.top - gap}px`
  }
}

function onDocumentClick(event: MouseEvent): void {
  if (props.trigger !== 'click' || !show.value) return
  const target = event.target as Node | null
  if (target && !triggerRef.value?.contains(target) && !tooltipRef.value?.contains(target)) close()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && show.value) close()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<style scoped>
.ui-tooltip__trigger{display:inline-flex;align-items:center;vertical-align:middle}.ui-tooltip{position:fixed;z-index:100000300;width:max-content;max-width:min(280px,calc(100vw - 16px));padding:7px 10px;border:1px solid rgb(255 255 255/.12);border-radius:var(--ui-radius);color:#fff;background:#222220;box-shadow:0 6px 18px rgb(0 0 0/.16);font-size:12px;line-height:18px;transform:translate(-50%,-100%)}.ui-tooltip[data-placement="bottom"]{transform:translateX(-50%)}.ui-tooltip__close{position:absolute;top:3px;right:3px;color:#d7d4cf}.ui-tooltip:has(.ui-tooltip__close){padding-right:34px}.ui-tooltip__arrow{position:absolute;left:50%;width:8px;height:8px;background:#222220;transform:translateX(-50%) rotate(45deg)}.ui-tooltip[data-placement="top"] .ui-tooltip__arrow{bottom:-4px}.ui-tooltip[data-placement="bottom"] .ui-tooltip__arrow{top:-4px}.ui-tooltip-enter-active,.ui-tooltip-leave-active{transition:opacity var(--ui-motion-fast) var(--ui-ease-standard)}.ui-tooltip-enter-from,.ui-tooltip-leave-to{opacity:0}@media(prefers-reduced-motion:reduce){.ui-tooltip-enter-active,.ui-tooltip-leave-active{transition:none}}
</style>
