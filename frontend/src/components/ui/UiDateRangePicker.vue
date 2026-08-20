<template>
  <div ref="containerRef" class="ui-date-range" :class="[`ui-date-range--${density}`]">
    <button
      :id="id"
      ref="triggerRef"
      type="button"
      class="ui-date-range__trigger date-picker-trigger ui-focus-ring"
      :class="{ 'date-picker-trigger-open': isOpen, 'ui-date-range__trigger--disabled': disabled }"
      :disabled="disabled"
      :aria-label="ariaLabel || displayValue"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :aria-controls="popupId"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <Icon name="calendar" size="sm" class="ui-date-range__icon date-picker-icon" aria-hidden="true" />
      <span class="ui-date-range__value date-picker-value">{{ displayValue }}</span>
      <Icon name="chevronDown" size="sm" class="ui-date-range__chevron date-picker-chevron" :class="{ 'ui-date-range__chevron--open': isOpen }" aria-hidden="true" />
    </button>

    <Transition name="ui-date-range-dropdown">
      <div
        v-if="isOpen"
        :id="popupId"
        ref="popupRef"
        class="ui-date-range__popup date-picker-dropdown"
        role="dialog"
        :aria-label="ariaLabel || displayValue"
        @click.stop
      >
        <div class="ui-date-range__presets date-picker-presets" role="list">
          <button
            v-for="preset in presets"
            :key="preset.value"
            type="button"
            class="ui-date-range__preset date-picker-preset"
            :class="{ 'date-picker-preset-active': isPresetActive(preset) }"
            @click="selectPreset(preset)"
          >
            {{ t(preset.labelKey) }}
          </button>
        </div>

        <div class="ui-date-range__divider date-picker-divider" />

        <div class="ui-date-range__custom date-picker-custom">
          <label class="ui-date-range__field date-picker-field" :for="startInputId">
            <span class="ui-date-range__label date-picker-label">{{ t('dates.startDate') }}</span>
            <input
              :id="startInputId"
              v-model="localStartDate"
              type="date"
              class="ui-date-range__input date-picker-input ui-focus-ring"
              :max="localEndDate || tomorrow"
              @change="onDateChange"
            />
          </label>
          <Icon name="arrowRight" size="sm" class="ui-date-range__separator" aria-hidden="true" />
          <label class="ui-date-range__field date-picker-field" :for="endInputId">
            <span class="ui-date-range__label date-picker-label">{{ t('dates.endDate') }}</span>
            <input
              :id="endInputId"
              v-model="localEndDate"
              type="date"
              class="ui-date-range__input date-picker-input ui-focus-ring"
              :min="localStartDate"
              :max="tomorrow"
              @change="onDateChange"
            />
          </label>
        </div>

        <div class="ui-date-range__actions date-picker-actions">
          <button type="button" class="ui-date-range__apply date-picker-apply" @click="apply">
            {{ t('dates.apply') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { UiDensity } from './types'

defineOptions({ inheritAttrs: false })

interface DatePreset {
  labelKey: string
  value: string
  getRange: () => { start: string; end: string }
}

const props = withDefaults(defineProps<{
  startDate: string
  endDate: string
  id?: string
  ariaLabel?: string
  disabled?: boolean
  density?: UiDensity
}>(), { disabled: false, density: 'default' })

const emit = defineEmits<{
  'update:startDate': [string]
  'update:endDate': [string]
  change: [{ startDate: string; endDate: string; preset: string | null }]
}>()

const { t, locale } = useI18n()
const sequence = Math.random().toString(36).slice(2, 9)
const id = computed(() => props.id || `ui-date-range-${sequence}`)
const popupId = `${id.value}-popup`
const startInputId = `${id.value}-start`
const endInputId = `${id.value}-end`
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const localStartDate = ref(props.startDate)
const localEndDate = ref(props.endDate)
const activePreset = ref<string | null>(null)

const formatDateToString = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = computed(() => formatDateToString(new Date()))
const tomorrow = computed(() => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return formatDateToString(date)
})

const presets: DatePreset[] = [
  { labelKey: 'dates.today', value: 'today', getRange: () => ({ start: today.value, end: today.value }) },
  { labelKey: 'dates.yesterday', value: 'yesterday', getRange: () => { const date = new Date(); date.setDate(date.getDate() - 1); const value = formatDateToString(date); return { start: value, end: value } } },
  { labelKey: 'dates.last24Hours', value: 'last24Hours', getRange: () => { const end = new Date(); const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); return { start: formatDateToString(start), end: formatDateToString(end) } } },
  { labelKey: 'dates.last7Days', value: '7days', getRange: () => { const date = new Date(); date.setDate(date.getDate() - 6); return { start: formatDateToString(date), end: today.value } } },
  { labelKey: 'dates.last14Days', value: '14days', getRange: () => { const date = new Date(); date.setDate(date.getDate() - 13); return { start: formatDateToString(date), end: today.value } } },
  { labelKey: 'dates.last30Days', value: '30days', getRange: () => { const date = new Date(); date.setDate(date.getDate() - 29); return { start: formatDateToString(date), end: today.value } } },
  { labelKey: 'dates.thisMonth', value: 'thisMonth', getRange: () => { const date = new Date(); return { start: formatDateToString(new Date(date.getFullYear(), date.getMonth(), 1)), end: today.value } } },
  { labelKey: 'dates.lastMonth', value: 'lastMonth', getRange: () => { const date = new Date(); return { start: formatDateToString(new Date(date.getFullYear(), date.getMonth() - 1, 1)), end: formatDateToString(new Date(date.getFullYear(), date.getMonth(), 0)) } } }
]

function formatDate(date: string): string {
  const value = new Date(`${date}T00:00:00`)
  return value.toLocaleDateString(locale.value === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })
}

const displayValue = computed(() => {
  const preset = presets.find(item => item.value === activePreset.value)
  if (preset) return t(preset.labelKey)
  if (isLast24Range()) return t('dates.last24Hours')
  if (localStartDate.value && localEndDate.value) {
    return localStartDate.value === localEndDate.value
      ? formatDate(localStartDate.value)
      : `${formatDate(localStartDate.value)} - ${formatDate(localEndDate.value)}`
  }
  return t('dates.selectDateRange')
})

function isLast24Range(): boolean {
  const previousDate = new Date()
  previousDate.setDate(previousDate.getDate() - 1)
  return localStartDate.value === formatDateToString(previousDate) && localEndDate.value === today.value
}

function syncActivePreset(): void {
  if (isLast24Range()) {
    activePreset.value = 'last24Hours'
    return
  }
  activePreset.value = presets.find(preset => {
    const range = preset.getRange()
    return range.start === localStartDate.value && range.end === localEndDate.value
  })?.value ?? null
}

function isPresetActive(preset: DatePreset): boolean { return activePreset.value === preset.value }
function selectPreset(preset: DatePreset): void {
  const range = preset.getRange()
  localStartDate.value = range.start
  localEndDate.value = range.end
  activePreset.value = preset.value
}
function onDateChange(): void { syncActivePreset(); activePreset.value = activePreset.value && presets.some(preset => preset.value === activePreset.value) ? activePreset.value : null }
function toggle(): void { if (!props.disabled) isOpen.value = !isOpen.value }
async function closeAndRestoreFocus(): Promise<void> {
  isOpen.value = false
  await nextTick()
  triggerRef.value?.focus()
}
function apply(): void {
  emit('update:startDate', localStartDate.value)
  emit('update:endDate', localEndDate.value)
  emit('change', { startDate: localStartDate.value, endDate: localEndDate.value, preset: activePreset.value })
  void closeAndRestoreFocus()
}
function onTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' && !isOpen.value) { event.preventDefault(); isOpen.value = true }
  else if (event.key === 'Escape' && isOpen.value) { event.preventDefault(); void closeAndRestoreFocus() }
}
function onDocumentClick(event: MouseEvent): void {
  if (isOpen.value && !(event.target instanceof Node && containerRef.value?.contains(event.target))) void closeAndRestoreFocus()
}
function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && isOpen.value) { event.preventDefault(); void closeAndRestoreFocus() }
}

watch(() => props.startDate, value => { localStartDate.value = value; syncActivePreset() })
watch(() => props.endDate, value => { localEndDate.value = value; syncActivePreset() })
watch(isOpen, async open => {
  if (!open) return
  await nextTick()
  popupRef.value?.querySelector<HTMLButtonElement>('.ui-date-range__preset')?.focus()
})
watch(() => props.disabled, disabled => { if (disabled) isOpen.value = false })
onMounted(() => {
  syncActivePreset()
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<style scoped>
.ui-date-range{position:relative;min-width:0}.ui-date-range__trigger{display:flex;min-width:180px;align-items:center;gap:8px;padding:0 11px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);font:inherit;font-size:13px;cursor:pointer;transition:border-color var(--ui-motion-fast),background var(--ui-motion-fast)}.ui-date-range--mini .ui-date-range__trigger{height:var(--ui-control-mini);padding-inline:8px}.ui-date-range--dense .ui-date-range__trigger{height:var(--ui-control-dense);padding-inline:10px}.ui-date-range--compact .ui-date-range__trigger{height:var(--ui-control-compact)}.ui-date-range--default .ui-date-range__trigger{height:var(--ui-control-default)}.ui-date-range--large .ui-date-range__trigger{height:var(--ui-control-large);padding-inline:12px}.ui-date-range__trigger:hover{border-color:var(--ui-text-soft)}.ui-date-range__trigger--disabled{color:var(--ui-text-soft);background:var(--ui-surface-muted);cursor:not-allowed}.ui-date-range__icon,.ui-date-range__chevron{flex:none;color:var(--ui-text-soft)}.ui-date-range__value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ui-date-range__chevron{margin-left:auto;transition:transform var(--ui-motion-fast)}.ui-date-range__chevron--open{transform:rotate(180deg)}.ui-date-range__popup{position:absolute;z-index:100;left:0;top:calc(100% + 4px);width:min(360px,calc(100vw - 16px));overflow:hidden;border:1px solid var(--ui-border);border-radius:var(--ui-radius-panel);background:var(--ui-surface);box-shadow:0 8px 24px rgb(31 35 41/.1)}.ui-date-range__presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;padding:10px}.ui-date-range__preset{min-height:28px;padding:4px 8px;border:0;border-radius:var(--ui-radius-dense);color:var(--ui-text-muted);background:transparent;font:inherit;font-size:12px;text-align:left;cursor:pointer;transition:background var(--ui-motion-fast),color var(--ui-motion-fast)}.ui-date-range__preset:hover,.ui-date-range__preset:focus-visible{color:var(--ui-text);background:var(--ui-surface-muted)}.ui-date-range__preset.date-picker-preset-active{color:var(--ui-text);background:var(--ui-surface-strong);font-weight:500}.ui-date-range__divider{border-top:1px solid var(--ui-border-soft)}.ui-date-range__custom{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:8px;padding:14px 12px}.ui-date-range__field{display:grid;gap:4px;min-width:0}.ui-date-range__label{color:var(--ui-text-muted);font-size:11px;line-height:16px}.ui-date-range__input{width:100%;height:32px;padding:0 8px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);font:inherit;font-size:12px}.ui-date-range__separator{margin-bottom:8px;color:var(--ui-text-soft)}.ui-date-range__actions{display:flex;justify-content:flex-end;padding:0 12px 12px}.ui-date-range__apply{min-width:64px;height:32px;padding:0 12px;border:1px solid var(--ui-text);border-radius:var(--ui-radius);color:var(--ui-inverse);background:var(--ui-text);font:inherit;font-size:12px;cursor:pointer}.ui-date-range-dropdown-enter-active,.ui-date-range-dropdown-leave-active{transition:opacity var(--ui-motion-fast),transform var(--ui-motion-fast)}.ui-date-range-dropdown-enter-from,.ui-date-range-dropdown-leave-to{opacity:0;transform:translateY(-3px)}@media(max-width:520px){.ui-date-range__popup{position:fixed;left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:calc(100dvh - 16px);overflow:auto}.ui-date-range__custom{grid-template-columns:1fr;align-items:stretch}.ui-date-range__separator{display:none}}@media(prefers-reduced-motion:reduce){.ui-date-range__trigger,.ui-date-range__chevron,.ui-date-range-dropdown-enter-active,.ui-date-range-dropdown-leave-active{transition:none}}
</style>
