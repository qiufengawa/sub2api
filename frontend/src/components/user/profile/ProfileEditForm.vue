<template>
  <div :class="props.embedded ? 'space-y-4' : 'ui-panel'">
    <div
      v-if="!props.embedded"
      class="border-b border-gray-100 px-6 py-4 dark:border-dark-700"
    >
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">
        {{ t('profile.editProfile') }}
      </h2>
    </div>
    <div :class="props.embedded ? '' : 'px-6 py-6'">
      <form @submit.prevent="handleUpdateProfile" :class="props.embedded ? 'space-y-3' : 'space-y-4'">
        <div v-if="props.embedded">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('profile.editProfile') }}
          </p>
        </div>
        <UiTextField
            id="username"
            v-model="username"
            type="text"
            :density="props.embedded ? 'compact' : 'default'"
            :label="t('profile.username')"
            :placeholder="t('profile.enterUsername')"
        />

        <div :class="props.embedded ? 'flex justify-end pt-1' : 'flex justify-end pt-4'">
          <UiButton
            type="submit"
            variant="primary"
            :density="props.embedded ? 'compact' : 'default'"
            :loading="loading"
          >
            {{ t('profile.updateProfile') }}
          </UiButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { userAPI } from '@/api'
import { UiButton, UiTextField } from '@/components/ui'

const props = withDefaults(defineProps<{
  initialUsername: string
  embedded?: boolean
}>(), {
  embedded: false,
})

const { t } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()

const username = ref(props.initialUsername)
const loading = ref(false)

watch(() => props.initialUsername, (val) => {
  username.value = val
})

const handleUpdateProfile = async () => {
  if (!username.value.trim()) {
    appStore.showError(t('profile.usernameRequired'))
    return
  }

  loading.value = true
  try {
    const updatedUser = await userAPI.updateProfile({
      username: username.value
    })
    authStore.user = updatedUser
    appStore.showSuccess(t('profile.updateSuccess'))
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('profile.updateFailed'))
  } finally {
    loading.value = false
  }
}
</script>
