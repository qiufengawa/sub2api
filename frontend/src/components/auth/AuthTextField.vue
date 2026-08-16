<template>
  <div class="auth-text-field">
    <UiTextField
      :id="id"
      :test-id="testId"
      :model-value="modelValue"
      :label="label"
      :description="description"
      :type="resolvedType"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      :autofocus="autofocus"
      :disabled="disabled"
      :readonly="readonly"
      :invalid="error || state === 'invalid'"
      :error="errorMessage"
      :help="helpText"
      :inputmode="inputmode"
      :maxlength="maxlength"
      :monospace="monospace"
      :text-align="textAlign"
      :prevent-enter-default="preventEnterDefault"
      density="compact"
      @update:model-value="handleInput"
      @input="forwardInput"
      @change="emit('change', $event)"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
      @enter="emit('enter', $event)"
    >
      <template v-if="$slots.label" #label><slot name="label" /></template>
      <template #prefix>
        <Icon :name="icon" size="sm" />
      </template>
      <template v-if="revealable || hasSuffix" #suffix>
        <UiIconButton
          v-if="revealable"
          class="auth-text-field__toggle"
          :label="t(revealed ? 'auth.hidePassword' : 'auth.showPassword')"
          :tooltip="t(revealed ? 'auth.hidePassword' : 'auth.showPassword')"
          :icon="revealed ? 'eyeOff' : 'eye'"
          variant="ghost"
          density="mini"
          :disabled="disabled"
          :aria-pressed="revealed"
          @click="revealed = !revealed"
        />
        <span v-else class="auth-text-field__suffix"><slot name="suffix" /></span>
      </template>
    </UiTextField>

    <p v-if="hint" class="auth-text-field__hint">{{ hint }}</p>
    <div v-if="showMeta" class="auth-text-field__meta">
      <slot name="meta" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiIconButton, UiTextField } from '@/components/ui'

type FieldIcon = 'mail' | 'lock' | 'key' | 'gift' | 'link' | 'user'
type FieldState = 'neutral' | 'valid' | 'invalid'

const props = withDefaults(defineProps<{
  id: string
  testId?: string
  modelValue: string
  label: string
  icon: FieldIcon
  description?: string
  type?: string
  placeholder?: string
  autocomplete?: string
  required?: boolean
  autofocus?: boolean
  disabled?: boolean
  readonly?: boolean
  revealable?: boolean
  error?: boolean
  errorMessage?: string
  state?: FieldState
  hint?: string
  helpText?: string
  showMeta?: boolean
  inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url'
  maxlength?: number
  monospace?: boolean
  textAlign?: 'left' | 'center' | 'right'
  preventEnterDefault?: boolean
}>(), {
  type: 'text',
  placeholder: '',
  testId: undefined,
  description: '',
  autocomplete: undefined,
  required: false,
  autofocus: false,
  disabled: false,
  readonly: false,
  revealable: false,
  error: false,
  errorMessage: '',
  state: 'neutral',
  hint: '',
  helpText: '',
  showMeta: false,
  inputmode: undefined,
  maxlength: undefined,
  monospace: false,
  textAlign: 'left',
  preventEnterDefault: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
  change: [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
  enter: [event: KeyboardEvent]
}>()

const { t } = useI18n()
const slots = useSlots()
const revealed = ref(false)
const resolvedType = computed(() => (props.revealable && revealed.value ? 'text' : props.type))
const hasSuffix = computed(() => Boolean(slots.suffix))

function handleInput(value: string): void {
  emit('update:modelValue', value)
}

function forwardInput(event: Event): void {
  emit('input', event)
}
</script>

<style scoped>
.auth-text-field__hint { margin: 3px 0 0; color: var(--ui-text-soft); font-size: 11px; line-height: 18px; }
.auth-text-field__meta { display: flex; min-height: 18px; align-items: center; justify-content: flex-end; margin-top: 4px; }
.auth-text-field__toggle { margin: 0 -6px 0 0; }
.auth-text-field__suffix { display: inline-flex; align-items: center; }
</style>
