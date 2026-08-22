<template>
  <div
    ref="containerRef"
    class="ui-select"
    :class="rootClass"
    :style="rootStyle"
  >
    <div class="ui-select__control">
      <button
        ref="triggerRef"
        v-bind="triggerAttrs"
        type="button"
        class="ui-select__trigger select-trigger ui-focus-ring"
        :class="[
          `ui-select__trigger--${density}`,
          {
            'ui-select__trigger--open select-trigger-open': isOpen,
            'ui-select__trigger--invalid select-trigger-error': error,
            'ui-select__trigger--disabled select-trigger-disabled': disabled,
            'ui-select__trigger--clearable': clearable && hasValue && !disabled
          }
        ]"
        :disabled="disabled"
        role="combobox"
        aria-haspopup="listbox"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        :aria-activedescendant="activeOptionId"
        :aria-invalid="error || undefined"
        :id="id"
        :aria-label="ariaLabel || placeholderText"
        :aria-describedby="ariaDescribedby"
        @click="toggle"
        @keydown="onTriggerKeyDown"
      >
        <span class="ui-select__value select-value" :class="{ 'ui-select__value--placeholder': !hasValue }">
          <slot name="selected" :option="selectedOption">{{ selectedLabel }}</slot>
        </span>
        <Icon
          name="chevronDown"
          size="sm"
          class="ui-select__chevron select-icon"
          :class="{ 'ui-select__chevron--open': isOpen }"
        />
      </button>

      <button
        v-if="clearable && hasValue && !disabled"
        type="button"
        class="ui-select__clear select-clear ui-focus-ring"
        :aria-label="clearLabel"
        @click.stop="clearSelection"
        @mousedown.stop
      >
        <Icon name="x" size="xs" />
      </button>
    </div>

    <Teleport to="body">
      <Transition name="ui-select-dropdown">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="ui-select__dropdown select-dropdown-portal"
          :class="instanceClass"
          :style="dropdownStyle"
          @click.stop
          @mousedown.stop
          @keydown="onDropdownKeyDown"
        >
          <div v-if="isSearchable" class="ui-select__search select-search">
            <Icon name="search" size="sm" aria-hidden="true" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              class="ui-select__search-input select-search-input"
              role="searchbox"
              autocomplete="off"
              :placeholder="searchPlaceholderText"
              :aria-label="searchPlaceholderText"
              :aria-controls="listboxId"
              :aria-activedescendant="activeOptionId"
            />
          </div>

          <div
            :id="listboxId"
            ref="optionsListRef"
            class="ui-select__options select-options"
            role="listbox"
            :aria-label="ariaLabel || placeholderText"
          >
            <div
              v-for="(option, index) in filteredOptions"
              :id="optionId(index)"
              :key="optionKey(option, index)"
              :role="isGroupHeaderOption(option) ? 'presentation' : 'option'"
              :aria-selected="isGroupHeaderOption(option) ? undefined : isSelected(option)"
              :aria-disabled="isUnavailable(option) || undefined"
              class="ui-select__option select-option"
              :class="{
                'ui-select__option--group select-option-group': isGroupHeaderOption(option),
                'ui-select__option--selected select-option-selected': isSelected(option),
                'ui-select__option--disabled select-option-disabled': isUnavailable(option) && !isGroupHeaderOption(option),
                'ui-select__option--focused select-option-focused': focusedIndex === index && !isGroupHeaderOption(option)
              }"
              @click.stop="selectOptionIfAvailable(option)"
              @mouseenter="handleOptionMouseEnter(option, index)"
            >
              <slot name="option" :option="option" :selected="isSelected(option)">
                <Icon v-if="isCreatableOption(option)" name="search" size="sm" aria-hidden="true" />
                <span class="ui-select__option-label select-option-label">{{ getOptionLabel(option) }}</span>
                <Icon v-if="isSelected(option)" name="check" size="sm" class="ui-select__check" aria-hidden="true" />
              </slot>
            </div>
            <div v-if="filteredOptions.length === 0" class="ui-select__empty select-empty">
              {{ emptyTextDisplay }}
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  watch,
  type HTMLAttributes
} from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { UiDensity } from '../types'
import type { SelectOption, SelectOptionLike, SelectValue } from '../selectTypes'

defineOptions({ inheritAttrs: false })

let selectCounter = 0
const instanceNumber = ++selectCounter
const instanceClass = `ui-select-instance-${instanceNumber}`
const listboxId = `ui-select-listbox-${instanceNumber}`
const attrs = useAttrs()
const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue: SelectValue | undefined
  options: SelectOptionLike[]
  placeholder?: string
  disabled?: boolean
  error?: boolean
  searchable?: boolean | 'auto'
  searchPlaceholder?: string
  emptyText?: string
  valueKey?: string
  labelKey?: string
  creatable?: boolean
  creatablePrefix?: string
  clearable?: boolean
  clearLabel?: string
  id?: string
  ariaLabel?: string
  ariaDescribedby?: string
  density?: UiDensity
}>(), {
  disabled: false,
  error: false,
  searchable: 'auto',
  creatable: false,
  creatablePrefix: '',
  clearable: false,
  clearLabel: 'Clear selection',
  valueKey: 'value',
  labelKey: 'label',
  density: 'default'
})

const emit = defineEmits<{
  'update:modelValue': [SelectValue]
  change: [SelectValue, SelectOption | null]
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const focusedIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const optionsListRef = ref<HTMLElement | null>(null)
const dropdownPosition = ref<'bottom' | 'top'>('bottom')
const triggerRect = ref<DOMRect | null>(null)
const viewportPadding = 8
const minimumWidth = 200

const rootClass = computed(() => attrs.class as HTMLAttributes['class'])
const rootStyle = computed(() => attrs.style as HTMLAttributes['style'])
const triggerAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const placeholderText = computed(() => props.placeholder ?? t('common.selectOption'))
const searchPlaceholderText = computed(() => props.searchPlaceholder ?? t('common.searchPlaceholder'))
const emptyTextDisplay = computed(() => props.emptyText ?? t('common.noOptionsFound'))
const isSearchable = computed(() => props.searchable === 'auto' ? props.options.length > 5 : props.searchable)

function getOptionValue(option: SelectOptionLike): SelectValue | undefined {
  if (typeof option === 'object' && option !== null) {
    return option[props.valueKey] as SelectValue | undefined
  }
  return option
}

function getOptionLabel(option: SelectOptionLike): string {
  if (typeof option === 'object' && option !== null) return String(option[props.labelKey] ?? '')
  return String(option ?? '')
}

function isOptionDisabled(option: SelectOptionLike): boolean {
  return typeof option === 'object' && option !== null && Boolean(option.disabled)
}

function isGroupHeaderOption(option: SelectOptionLike): boolean {
  return typeof option === 'object' && option !== null && option.kind === 'group'
}

function isCreatableOption(option: SelectOptionLike): boolean {
  return typeof option === 'object' && option !== null && option._creatable === true
}

function isUnavailable(option: SelectOptionLike): boolean {
  return isOptionDisabled(option) || isGroupHeaderOption(option)
}

const selectedOption = computed(() => props.options.find(option => getOptionValue(option) === props.modelValue) ?? null)
const hasValue = computed(() => props.modelValue !== null && props.modelValue !== undefined && props.modelValue !== '')
const selectedLabel = computed(() => {
  if (selectedOption.value !== null) return getOptionLabel(selectedOption.value)
  if (props.creatable && hasValue.value) return String(props.modelValue)
  return placeholderText.value
})

const filteredOptions = computed<SelectOptionLike[]>(() => {
  const query = searchQuery.value.trim()
  let options = [...props.options]
  if (isSearchable.value && query) {
    const normalized = query.toLocaleLowerCase()
    options = options.filter(option => {
      if (typeof option === 'object' && option !== null && option.alwaysVisible === true) return true
      if (getOptionLabel(option).toLocaleLowerCase().includes(normalized)) return true
      return typeof option === 'object' && option !== null
        && String(option.description ?? '').toLocaleLowerCase().includes(normalized)
    })
    if (props.creatable) {
      const prefix = props.creatablePrefix || t('common.search')
      options.unshift({
        [props.valueKey]: query,
        [props.labelKey]: `${prefix} "${query}"`,
        _creatable: true
      })
    }
  }
  return options
})

function isSelected(option: SelectOptionLike): boolean {
  return getOptionValue(option) === props.modelValue
}

function optionId(index: number): string {
  return `${listboxId}-option-${index}`
}

function optionKey(option: SelectOptionLike, index: number): string {
  return `${index}:${typeof getOptionValue(option)}:${String(getOptionValue(option) ?? '')}`
}

const activeOptionId = computed(() => focusedIndex.value >= 0 ? optionId(focusedIndex.value) : undefined)

function findEnabledIndex(start: number, direction: 1 | -1): number {
  const options = filteredOptions.value
  if (!options.length) return -1
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (start + direction * offset + options.length) % options.length
    if (!isUnavailable(options[index])) return index
  }
  return -1
}

function setInitialFocus(): void {
  if (!filteredOptions.value.length) {
    focusedIndex.value = -1
    return
  }
  const selectedIndex = filteredOptions.value.findIndex(isSelected)
  focusedIndex.value = findEnabledIndex(selectedIndex >= 0 ? selectedIndex : 0, 1)
}

function moveFocus(direction: 1 | -1): void {
  const start = focusedIndex.value < 0
    ? (direction === 1 ? 0 : filteredOptions.value.length - 1)
    : focusedIndex.value + direction
  focusedIndex.value = findEnabledIndex(start, direction)
  scrollToFocused()
}

function moveToBoundary(boundary: 'start' | 'end'): void {
  const start = boundary === 'start' ? 0 : filteredOptions.value.length - 1
  focusedIndex.value = findEnabledIndex(start, boundary === 'start' ? 1 : -1)
  scrollToFocused()
}

function handleOptionMouseEnter(option: SelectOptionLike, index: number): void {
  if (!isUnavailable(option)) focusedIndex.value = index
}

function selectOptionIfAvailable(option: SelectOptionLike): void {
  if (!isUnavailable(option)) selectOption(option)
}

function selectOption(option: SelectOptionLike): void {
  const value = getOptionValue(option) ?? null
  emit('update:modelValue', value)
  emit('change', value, option as SelectOption)
  close(true)
}

function clearSelection(): void {
  if (props.disabled) return
  emit('update:modelValue', null)
  emit('change', null, null)
}

function open(): void {
  if (props.disabled || isOpen.value) return
  isOpen.value = true
}

function close(restoreFocus = false): void {
  if (!isOpen.value) return
  isOpen.value = false
  if (restoreFocus) nextTick(() => triggerRef.value?.focus())
}

function toggle(): void {
  isOpen.value ? close() : open()
}

function handleNavigationKey(event: KeyboardEvent): boolean {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) open()
    else moveFocus(event.key === 'ArrowDown' ? 1 : -1)
    return true
  }
  if (event.key === 'Home' || event.key === 'End') {
    if (!isOpen.value) return false
    event.preventDefault()
    moveToBoundary(event.key === 'Home' ? 'start' : 'end')
    return true
  }
  if (event.key === 'Enter' && isOpen.value) {
    event.preventDefault()
    const option = filteredOptions.value[focusedIndex.value]
    if (option && !isUnavailable(option)) selectOption(option)
    return true
  }
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    close(true)
    return true
  }
  if (event.key === 'Tab' && isOpen.value) close()
  return false
}

function onTriggerKeyDown(event: KeyboardEvent): void {
  if (handleNavigationKey(event)) return
  if ((event.key === 'Enter' || event.key === ' ') && !isOpen.value) {
    event.preventDefault()
    open()
  }
}

function onDropdownKeyDown(event: KeyboardEvent): void {
  handleNavigationKey(event)
}

function scrollToFocused(): void {
  nextTick(() => {
    const option = optionsListRef.value?.querySelector<HTMLElement>(`#${optionId(focusedIndex.value)}`)
    option?.scrollIntoView?.({ block: 'nearest' })
  })
}

function updatePosition(): void {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) return
  triggerRect.value = rect
  nextTick(() => {
    const dropdownHeight = dropdownRef.value?.offsetHeight || 240
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    dropdownPosition.value = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight ? 'top' : 'bottom'
  })
}

const dropdownStyle = computed<Record<string, string>>(() => {
  const rect = triggerRect.value
  if (!rect) return {}
  const viewportRight = Math.max(viewportPadding, window.innerWidth - viewportPadding)
  const left = Math.min(Math.max(viewportPadding, rect.left), viewportRight)
  const availableWidth = Math.max(0, viewportRight - left)
  const preferredWidth = Math.max(minimumWidth, rect.width)
  const style: Record<string, string> = {
    position: 'fixed',
    left: `${left}px`,
    minWidth: `${Math.min(preferredWidth, availableWidth)}px`,
    maxWidth: `${availableWidth}px`,
    zIndex: '100000020'
  }
  if (dropdownPosition.value === 'top') style.bottom = `${window.innerHeight - rect.top + 4}px`
  else style.top = `${rect.bottom + 4}px`
  return style
})

function onDocumentClick(event: MouseEvent): void {
  if (!isOpen.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (containerRef.value?.contains(target) || dropdownRef.value?.contains(target)) return
  close()
}

watch(isOpen, openState => {
  if (openState) {
    setInitialFocus()
    updatePosition()
    if (isSearchable.value) nextTick(() => searchInputRef.value?.focus())
    window.addEventListener('scroll', updatePosition, { capture: true, passive: true })
    window.addEventListener('resize', updatePosition)
    return
  }
  searchQuery.value = ''
  focusedIndex.value = -1
  window.removeEventListener('scroll', updatePosition, { capture: true })
  window.removeEventListener('resize', updatePosition)
})

watch(() => props.disabled, disabled => {
  if (disabled) close()
})

watch(filteredOptions, () => {
  if (isOpen.value) setInitialFocus()
})

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('scroll', updatePosition, { capture: true })
  window.removeEventListener('resize', updatePosition)
})
</script>

<style scoped>
.ui-select{position:relative;min-width:0}.ui-select__control{position:relative}.ui-select__trigger{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;padding:0 11px;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);font:inherit;font-size:13px;line-height:1;cursor:pointer;transition:border-color var(--ui-motion-fast),background var(--ui-motion-fast),color var(--ui-motion-fast)}.ui-select__trigger--mini{height:var(--ui-control-mini);padding-inline:8px}.ui-select__trigger--dense{height:var(--ui-control-dense);padding-inline:10px}.ui-select__trigger--compact{height:var(--ui-control-compact)}.ui-select__trigger--default{height:var(--ui-control-default)}.ui-select__trigger--large{height:var(--ui-control-large);padding-inline:12px}.ui-select__trigger:hover{border-color:var(--ui-text-soft)}.ui-select__trigger--open{border-color:var(--ui-focus)}.ui-select__trigger--invalid{border-color:var(--ui-danger)}.ui-select__trigger--disabled{color:var(--ui-text-soft);background:var(--ui-surface-muted);cursor:not-allowed}.ui-select__trigger--clearable{padding-right:58px}.ui-select__value{min-width:0;flex:1;overflow:hidden;text-align:left;text-overflow:ellipsis;white-space:nowrap}.ui-select__value--placeholder{color:var(--ui-text-soft)}.ui-select__chevron{flex:none;color:var(--ui-text-soft);transition:transform var(--ui-motion-fast)}.ui-select__chevron--open{transform:rotate(180deg)}.ui-select__clear{position:absolute;top:50%;right:28px;display:grid;width:24px;height:24px;place-items:center;padding:0;border:0;border-radius:var(--ui-radius-dense);color:var(--ui-text-soft);background:transparent;transform:translateY(-50%);cursor:pointer}.ui-select__clear:hover{color:var(--ui-text);background:var(--ui-surface-muted)}
</style>

<style>
.ui-select__dropdown{overflow:hidden;border:1px solid var(--ui-border);border-radius:var(--ui-radius);color:var(--ui-text);background:var(--ui-surface);box-shadow:0 6px 18px rgb(31 35 41/.1)}.ui-select__search{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--ui-border-soft);color:var(--ui-text-soft)}.ui-select__search-input{min-width:0;flex:1;padding:0;border:0;outline:0;color:var(--ui-text);background:transparent;font:inherit;font-size:13px;line-height:22px}.ui-select__search-input::placeholder{color:var(--ui-text-soft)}.ui-select__options{max-height:320px;overflow-y:auto;padding:4px}.ui-select__option{display:flex;min-height:30px;align-items:center;gap:8px;padding:5px 8px;border-radius:var(--ui-radius-dense);font-size:13px;line-height:20px;cursor:pointer}.ui-select__option:hover,.ui-select__option--focused{background:var(--ui-surface-muted)}.ui-select__option--selected{font-weight:500}.ui-select__option--disabled{color:var(--ui-text-soft);cursor:not-allowed}.ui-select__option--group{min-height:26px;margin-top:4px;color:var(--ui-text-soft);font-size:11px;font-weight:600;line-height:18px;cursor:default}.ui-select__option-label{min-width:0;flex:1;overflow-wrap:break-word;word-break:normal}.ui-select__check{flex:none;color:var(--ui-success)}.ui-select__empty{padding:14px 10px;color:var(--ui-text-soft);font-size:12px;line-height:18px;text-align:center}.ui-select-dropdown-enter-active,.ui-select-dropdown-leave-active{transition:opacity var(--ui-motion-fast),transform var(--ui-motion-fast)}.ui-select-dropdown-enter-from,.ui-select-dropdown-leave-to{opacity:0;transform:translateY(-3px)}@media(prefers-reduced-motion:reduce){.ui-select__trigger,.ui-select__chevron,.ui-select-dropdown-enter-active,.ui-select-dropdown-leave-active{transition:none}}
</style>
