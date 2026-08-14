<template>
  <div class="auth-text-field">
    <div class="auth-text-field__label-row">
      <label :for="id">
        <slot name="label">{{ label }}</slot>
      </label>

      <span v-if="helpText" class="auth-text-field__help">
        <button
          type="button"
          class="auth-text-field__help-trigger"
          :aria-label="helpText"
          :aria-describedby="`${id}-help`"
        >
          <Icon name="questionCircle" size="xs" />
        </button>
        <span :id="`${id}-help`" class="auth-text-field__help-popover" role="tooltip">
          {{ helpText }}
        </span>
      </span>
    </div>

    <div class="auth-text-field__shell">
      <span class="auth-text-field__icon" aria-hidden="true">
        <Icon :name="icon" size="sm" />
      </span>

      <input
        :id="id"
        :value="modelValue"
        :type="resolvedType"
        :required="required"
        :autofocus="autofocus"
        :autocomplete="autocomplete"
        :disabled="disabled"
        :placeholder="placeholder"
        class="input input-compact auth-text-field__input"
        :class="{
          'auth-text-field__input--trailing': revealable || hasSuffix,
          'input-error': error || state === 'invalid',
          'auth-text-field__input--valid': state === 'valid'
        }"
        @input="handleInput"
      />

      <button
        v-if="revealable"
        type="button"
        class="auth-text-field__toggle"
        :disabled="disabled"
        :aria-label="t(revealed ? 'auth.hidePassword' : 'auth.showPassword')"
        :title="t(revealed ? 'auth.hidePassword' : 'auth.showPassword')"
        :aria-pressed="revealed"
        @click="revealed = !revealed"
      >
        <Icon :name="revealed ? 'eyeOff' : 'eye'" size="sm" />
      </button>

      <span v-else-if="hasSuffix" class="auth-text-field__suffix">
        <slot name="suffix" />
      </span>
    </div>

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

type FieldIcon = 'mail' | 'lock' | 'key' | 'gift'
type FieldState = 'neutral' | 'valid' | 'invalid'

const props = withDefaults(
  defineProps<{
    id: string
    modelValue: string
    label: string
    icon: FieldIcon
    type?: string
    placeholder?: string
    autocomplete?: string
    required?: boolean
    autofocus?: boolean
    disabled?: boolean
    revealable?: boolean
    error?: boolean
    state?: FieldState
    hint?: string
    helpText?: string
    showMeta?: boolean
  }>(),
  {
    type: 'text',
    placeholder: '',
    autocomplete: undefined,
    required: false,
    autofocus: false,
    disabled: false,
    revealable: false,
    error: false,
    state: 'neutral',
    hint: '',
    helpText: '',
    showMeta: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  input: [event: Event]
}>()

const { t } = useI18n()
const slots = useSlots()
const revealed = ref(false)
const resolvedType = computed(() => (props.revealable && revealed.value ? 'text' : props.type))
const hasSuffix = computed(() => Boolean(slots.suffix))

function handleInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
  emit('input', event)
}
</script>

<style scoped>
.auth-text-field__label-row {
  display: flex;
  min-height: 16px;
  align-items: center;
  gap: 4px;
  margin-bottom: 5px;
}

.auth-text-field__label-row > label {
  display: block;
  color: #312f2c;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.auth-text-field__help {
  position: relative;
  display: inline-flex;
}

.auth-text-field__help-trigger {
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--auth-control-soft, #9c9690);
  background: transparent;
  cursor: help;
  transition: color 120ms ease;
}

.auth-text-field__help-trigger:hover,
.auth-text-field__help-trigger:focus-visible {
  color: var(--auth-control-text, #0a0a0a);
  outline: none;
}

.auth-text-field__help-popover {
  position: absolute;
  z-index: 30;
  top: calc(100% + 6px);
  left: 50%;
  width: max-content;
  max-width: min(220px, calc(100vw - 32px));
  padding: 6px 8px;
  border: 1px solid #292725;
  border-radius: 4px;
  color: #fff;
  background: #171615;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -2px);
  transition: opacity 120ms ease, transform 120ms ease;
  white-space: normal;
}

.auth-text-field__help:hover .auth-text-field__help-popover,
.auth-text-field__help:focus-within .auth-text-field__help-popover {
  opacity: 1;
  transform: translate(-50%, 0);
}

.auth-text-field__shell {
  position: relative;
}

.auth-text-field__icon {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 11px;
  z-index: 1;
  display: flex;
  align-items: center;
  color: var(--auth-control-soft, #9c9690);
  pointer-events: none;
}

.auth-text-field__input {
  width: 100%;
  height: 32px !important;
  min-height: 32px !important;
  padding-right: 11px;
  padding-left: 35px;
  border: 1px solid var(--auth-control-line, #ddd7d1) !important;
  border-radius: 6px !important;
  background: #fff !important;
  color: var(--auth-control-text, #0a0a0a) !important;
  font-size: 12px;
  box-shadow: none !important;
}

.auth-text-field__input--trailing {
  padding-right: 36px;
}

.auth-text-field__input::placeholder {
  color: #aaa49e;
}

/* Keep the auth field's single custom reveal button; browsers may add a
   second native password-reveal control when a password has been entered. */
:global(.auth-text-field__input[type='password']::-ms-reveal),
:global(.auth-text-field__input[type='password']::-ms-clear),
:global(.auth-text-field__input[type='password']::-webkit-credentials-auto-fill-button),
:global(.auth-text-field__input[type='password']::-webkit-textfield-decoration-container) {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.auth-text-field__input:hover {
  border-color: #bdb6af !important;
}

.auth-text-field__input:focus {
  border-color: #151515 !important;
  outline: none;
  box-shadow: 0 0 0 3px rgb(20 20 20 / 0.07) !important;
}

.auth-text-field__input:disabled {
  cursor: not-allowed;
  background: #f7f4f1 !important;
  opacity: 0.7;
}

.auth-text-field__input--valid {
  border-color: #22c55e !important;
}

.auth-text-field__toggle,
.auth-text-field__suffix {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  width: 36px;
  height: 32px;
  align-items: center;
  justify-content: center;
  color: var(--auth-control-soft, #9c9690);
}

.auth-text-field__toggle {
  transition: color 150ms ease;
}

.auth-text-field__toggle:hover {
  color: var(--auth-control-text, #0a0a0a);
}

.auth-text-field__hint {
  margin: 3px 0 0;
  color: var(--auth-control-soft, #9c9690);
  font-size: 11px;
  line-height: 1.45;
}

.auth-text-field__meta {
  display: flex;
  min-height: 18px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 4px;
}

:global(.dark) .auth-text-field__label-row > label {
  color: #dbd6d0;
}

@media (prefers-reduced-motion: reduce) {
  .auth-text-field__help-trigger,
  .auth-text-field__help-popover {
    transition: none;
  }
}

:global(.dark) .auth-text-field__input {
  background: #111110 !important;
}

:global(.dark) .auth-text-field__input:disabled {
  background: #1c1a18 !important;
}
</style>
