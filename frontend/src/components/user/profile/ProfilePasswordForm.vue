<template>
  <div :class="props.embedded ? 'space-y-4' : 'ui-panel'">
    <div
      v-if="!props.embedded"
      class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
    >
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">
        {{ t('profile.changePassword') }}
      </h2>
    </div>
    <div :class="props.embedded ? '' : 'px-6 py-6'">
      <form @submit.prevent="handleChangePassword" :class="props.embedded ? 'grid gap-3 sm:grid-cols-2' : 'space-y-4'">
        <UiPasswordField
            id="old_password"
            v-model="form.old_password"
            required
            autocomplete="current-password"
            :density="props.embedded ? 'compact' : 'default'"
            :label="t('profile.currentPassword')"
            :reveal-label="t('common.showPassword')"
            :hide-label="t('common.hidePassword')"
            :class="props.embedded ? 'sm:col-span-2' : ''"
        />

        <UiPasswordField
            id="new_password"
            v-model="form.new_password"
            required
            autocomplete="new-password"
            :density="props.embedded ? 'compact' : 'default'"
            :label="t('profile.newPassword')"
            :description="t('profile.passwordHint')"
            :rules="t('profile.passwordHint')"
            :reveal-label="t('common.showPassword')"
            :hide-label="t('common.hidePassword')"
        />

        <UiPasswordField
            id="confirm_password"
            v-model="form.confirm_password"
            required
            autocomplete="new-password"
            :density="props.embedded ? 'compact' : 'default'"
            :label="t('profile.confirmNewPassword')"
            :reveal-label="t('common.showPassword')"
            :hide-label="t('common.hidePassword')"
        />

        <div :class="props.embedded ? 'flex justify-end pt-1 sm:col-span-2' : 'flex justify-end pt-4'">
          <UiButton
            type="submit"
            variant="primary"
            :density="props.embedded ? 'compact' : 'default'"
            :loading="loading"
          >
            {{ t('profile.changePasswordButton') }}
          </UiButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { userAPI } from '@/api'
import { UiButton, UiPasswordField } from '@/components/ui'

const { t } = useI18n()
const appStore = useAppStore()
const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const loading = ref(false)
const form = ref({
  old_password: '',
  new_password: '',
  confirm_password: ''
})

const handleChangePassword = async () => {
  if (form.value.new_password !== form.value.confirm_password) {
    appStore.showError(t('profile.passwordsNotMatch'))
    return
  }

  if (form.value.new_password.length < 8) {
    appStore.showError(t('profile.passwordTooShort'))
    return
  }

  loading.value = true
  try {
    await userAPI.changePassword(form.value.old_password, form.value.new_password)
    form.value = { old_password: '', new_password: '', confirm_password: '' }
    appStore.showSuccess(t('profile.passwordChangeSuccess'))
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('profile.passwordChangeFailed'))
  } finally {
    loading.value = false
  }
}
</script>
