<template>
  <AuthFormPanel :title="t('auth.resetPasswordTitle')" :subtitle="t('auth.resetPasswordHint')">

      <!-- Invalid Link State -->
      <div v-if="isInvalidLink" class="auth-state-stack">
        <UiAlert tone="warning" :title="t('auth.invalidResetLink')" :message="t('auth.invalidResetLinkHint')" />
        <UiButton to="/forgot-password" density="compact" block>{{ t('auth.requestNewResetLink') }}</UiButton>
      </div>

      <!-- Success State -->
      <div v-else-if="isSuccess" class="auth-state-stack">
        <UiAlert tone="success" :title="t('auth.passwordResetSuccess')" :message="t('auth.passwordResetSuccessHint')" />
        <UiButton to="/login" variant="primary" density="compact" block>
          <template #icon><Icon name="login" size="sm" /></template>
          {{ t('auth.signIn') }}
        </UiButton>
      </div>

      <!-- Form State -->
      <form v-else class="auth-form" @submit.prevent="handleSubmit">
        <AuthTextField id="email" :model-value="email" :label="t('auth.emailLabel')" icon="mail" type="email" readonly disabled />
        <AuthTextField
          id="password"
          v-model="formData.password"
          :label="t('auth.newPassword')"
          icon="lock"
          type="password"
          revealable
          required
          autocomplete="new-password"
          :disabled="isLoading"
          :error="Boolean(errors.password)"
          :error-message="errors.password"
          :placeholder="t('auth.newPasswordPlaceholder')"
          :help-text="t('auth.passwordHint')"
        />
        <AuthTextField
          id="confirmPassword"
          v-model="formData.confirmPassword"
          :label="t('auth.confirmPassword')"
          icon="lock"
          type="password"
          revealable
          required
          autocomplete="new-password"
          :disabled="isLoading"
          :error="Boolean(errors.confirmPassword)"
          :error-message="errors.confirmPassword"
          :placeholder="t('auth.confirmPasswordPlaceholder')"
        />

        <!-- Submit Button -->
        <UiButton
          type="submit"
          :disabled="isLoading"
          :loading="isLoading"
          variant="primary"
          density="compact"
          block
        >
          <template v-if="!isLoading" #icon><Icon name="checkCircle" size="sm" /></template>
          {{ isLoading ? t('auth.resettingPassword') : t('auth.resetPassword') }}
        </UiButton>
      </form>

      <template #footer>
      <AuthFooterPrompt :text="t('auth.rememberedPassword')" :link-text="t('auth.signIn')" to="/login" />
      </template>
  </AuthFormPanel>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthFormPanel from '@/components/auth/AuthFormPanel.vue'
import AuthFooterPrompt from '@/components/auth/AuthFooterPrompt.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import Icon from '@/components/icons/Icon.vue'
import { UiAlert, UiButton } from '@/components/ui'
import { useAppStore } from '@/stores'
import { resetPassword } from '@/api/auth'

const { t } = useI18n()

// ==================== Router & Stores ====================

const route = useRoute()
const appStore = useAppStore()

// ==================== State ====================

const isLoading = ref<boolean>(false)
const isSuccess = ref<boolean>(false)
const errorMessage = ref<string>('')

// URL parameters
const email = ref<string>('')
const token = ref<string>('')

const formData = reactive({
  password: '',
  confirmPassword: ''
})

const errors = reactive({
  password: '',
  confirmPassword: ''
})

const validationToastMessage = computed(
  () => errors.password || errors.confirmPassword || ''
)

watch(validationToastMessage, (value, previousValue) => {
  if (value && value !== previousValue) {
    appStore.showError(value)
  }
})

// Check if the reset link is valid (has email and token)
const isInvalidLink = computed(() => !email.value || !token.value)

// ==================== Lifecycle ====================

onMounted(() => {
  // Get email and token from URL query parameters
  email.value = (route.query.email as string) || ''
  token.value = (route.query.token as string) || ''

  if (!email.value || !token.value) {
    appStore.showError(t('auth.invalidResetLink'))
  }
})

// ==================== Validation ====================

function validateForm(): boolean {
  errors.password = ''
  errors.confirmPassword = ''

  let isValid = true

  // Password validation
  if (!formData.password) {
    errors.password = t('auth.passwordRequired')
    isValid = false
  } else if (formData.password.length < 6) {
    errors.password = t('auth.passwordMinLength')
    isValid = false
  }

  // Confirm password validation
  if (!formData.confirmPassword) {
    errors.confirmPassword = t('auth.confirmPasswordRequired')
    isValid = false
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = t('auth.passwordsDoNotMatch')
    isValid = false
  }

  return isValid
}

// ==================== Form Handlers ====================

async function handleSubmit(): Promise<void> {
  errorMessage.value = ''

  if (!validateForm()) {
    return
  }

  isLoading.value = true

  try {
    await resetPassword({
      email: email.value,
      token: token.value,
      new_password: formData.password
    })

    isSuccess.value = true
    appStore.showSuccess(t('auth.passwordResetSuccess'))
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { data?: { detail?: string; code?: string } } }

    // Check for invalid/expired token error
    if (err.response?.data?.code === 'INVALID_RESET_TOKEN') {
      errorMessage.value = t('auth.invalidOrExpiredToken')
    } else if (err.response?.data?.detail) {
      errorMessage.value = err.response.data.detail
    } else if (err.message) {
      errorMessage.value = err.message
    } else {
      errorMessage.value = t('auth.resetPasswordFailed')
    }

    appStore.showError(errorMessage.value)
  } finally {
    isLoading.value = false
  }
}
</script>
