<template>
  <UiDialog
    :show="controller.visible.value"
    :title="t('stepUp.title')"
    width="narrow"
    :show-close-button="false"
    :close-on-click-outside="true"
    @close="handleCancel"
  >
    <div class="auth-totp">
      <div class="auth-totp__intro">
        <Icon name="lock" size="sm" />
        <p>{{ t('stepUp.hint') }}</p>
      </div>
      <div class="auth-totp__code">
          <input
            ref="hiddenOtpInputRef"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            class="auth-totp__autofill"
            aria-hidden="true"
            tabindex="-1"
            @input="handleHiddenOtpInput"
          />
          <div class="auth-totp__cells" role="group" :aria-label="t('stepUp.title')">
            <input
              v-for="(_, index) in 6"
              :key="index"
              :ref="(el) => setInputRef(el, index)"
              type="text"
              maxlength="1"
              inputmode="numeric"
              pattern="[0-9]"
              autocomplete="off"
              class="auth-totp__cell"
              :aria-label="`${t('stepUp.title')} ${index + 1}`"
              :disabled="verifying"
              @input="handleCodeInput($event, index)"
              @keydown="handleKeydown($event, index)"
              @paste="handlePaste"
            />
          </div>
          <div v-if="verifying" class="auth-totp__progress" role="status" aria-live="polite">
            <UiSpinner size="sm" />
            {{ t('common.verifying') }}
          </div>
      </div>
    </div>
    <template #footer>
      <UiButton density="compact" :disabled="verifying" @click="handleCancel">
        {{ t('common.cancel') }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiDialog, UiSpinner } from '@/components/ui'
import { useAppStore } from '@/stores'
import { totpAPI } from '@/api'
import type { StepUpController } from '@/composables/useStepUp'
import './auth-totp.css'

const props = defineProps<{
  controller: StepUpController
}>()

const { t } = useI18n()
const appStore = useAppStore()

const verifying = ref(false)
const code = ref<string[]>(['', '', '', '', '', ''])
const inputRefs = ref<(HTMLInputElement | null)[]>([])
const hiddenOtpInputRef = ref<HTMLInputElement | null>(null)

// Focus the first cell whenever the dialog opens.
watch(
  () => props.controller.visible.value,
  (open) => {
    if (open) {
      resetInputs()
      nextTick(() => inputRefs.value[0]?.focus())
    }
  }
)

// Auto-submit once 6 digits are entered.
watch(
  () => code.value.join(''),
  (newCode) => {
    if (newCode.length === 6 && !verifying.value) {
      submit(newCode)
    }
  }
)

async function submit(otp: string) {
  verifying.value = true
  try {
    await totpAPI.stepUp(otp)
    verifying.value = false
    resetInputs()
    props.controller.onVerified()
  } catch (err: any) {
    verifying.value = false
    appStore.showError(err?.message || t('stepUp.verifyFailed'))
    resetInputs()
    nextTick(() => inputRefs.value[0]?.focus())
  }
}

function resetInputs() {
  code.value = ['', '', '', '', '', '']
  inputRefs.value.forEach((input) => {
    if (input) input.value = ''
  })
  if (hiddenOtpInputRef.value) hiddenOtpInputRef.value.value = ''
}

function handleCancel() {
  if (verifying.value) return
  props.controller.onCancel()
}

const setInputRef = (el: any, index: number) => {
  inputRefs.value[index] = el as HTMLInputElement | null
}

const handleCodeInput = (event: Event, index: number) => {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/[^0-9]/g, '').slice(0, 1)
  input.value = value
  code.value[index] = value
  if (value && index < 5) {
    nextTick(() => inputRefs.value[index + 1]?.focus())
  }
}

const handleHiddenOtpInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/[^0-9]/g, '').slice(0, 6).split('')
  for (let i = 0; i < 6; i++) {
    code.value[i] = digits[i] || ''
    if (inputRefs.value[i]) inputRefs.value[i]!.value = digits[i] || ''
  }
}

const handleKeydown = (event: KeyboardEvent, index: number) => {
  if (event.key === 'Backspace') {
    const input = event.target as HTMLInputElement
    if (!input.value && index > 0) {
      event.preventDefault()
      inputRefs.value[index - 1]?.focus()
    }
  }
}

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedData = event.clipboardData?.getData('text') || ''
  const digits = pastedData.replace(/[^0-9]/g, '').slice(0, 6).split('')
  for (let i = 0; i < 6; i++) {
    code.value[i] = digits[i] || ''
    if (inputRefs.value[i]) inputRefs.value[i]!.value = digits[i] || ''
  }
  const focusIndex = Math.min(digits.length, 5)
  nextTick(() => inputRefs.value[focusIndex]?.focus())
}
</script>
