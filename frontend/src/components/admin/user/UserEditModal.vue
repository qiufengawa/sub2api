<template>
  <UiDialog
    :show="show"
    :title="t('admin.users.editUser')"
    width="normal"
    @close="$emit('close')"
  >
    <form v-if="user" id="edit-user-form" @submit.prevent="handleUpdateUser" class="space-y-5">
      <UiTextField v-model="form.email" type="email" :label="t('admin.users.email')" />
      <div class="user-modal-inline-field"><UiTextField v-model="form.password" type="text" :label="t('admin.users.password')" :placeholder="t('admin.users.enterNewPassword')" /><UiIconButton v-if="form.password" :icon="passwordCopied ? 'check' : 'copy'" :variant="passwordCopied ? 'success' : 'ghost'" density="compact" :label="t('admin.users.passwordCopied')" @click="copyPassword" /><UiIconButton icon="refresh" density="compact" :label="t('common.refresh')" @click="generatePassword" /></div>
      <UiTextField v-model="form.username" :label="t('admin.users.username')" />
      <UiSelect v-model="form.role" :label="t('admin.users.form.roleLabel')" :options="[{ value: 'user', label: t('admin.users.roles.user') }, { value: 'admin', label: t('admin.users.roles.admin') }]" />
      <UiTextArea v-model="form.notes" :label="t('admin.users.notes')" :rows="3" />
      <UiTextField type="number" :label="t('admin.users.columns.concurrency')" :model-value="form.concurrency" @update:model-value="form.concurrency = Number($event) || 0" />
      <UiTextField type="number" min="0" step="1" :label="t('admin.users.form.rpmLimit')" :description="t('admin.users.form.rpmLimitHint')" :placeholder="t('admin.users.form.rpmLimitPlaceholder')" :model-value="form.rpm_limit" @update:model-value="form.rpm_limit = Number($event) || 0" />
      <UserAttributeForm v-model="form.customAttributes" :user-id="user?.id" />
    </form>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UiButton @click="$emit('close')" type="button">{{ t('common.cancel') }}</UiButton>
        <UiButton type="submit" form="edit-user-form" :loading="submitting" variant="primary">
          {{ submitting ? t('admin.users.updating') : t('common.update') }}
        </UiButton>
      </div>
    </template>
  </UiDialog>

  <!-- 角色提升为管理员时后端要求 step-up 2FA，弹出 TOTP 验证后自动重试 -->
  <TotpStepUpDialog :controller="stepUp" />
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { useClipboard } from '@/composables/useClipboard'
import { adminAPI } from '@/api/admin'
import type { AdminUser, UserAttributeValuesMap } from '@/types'
import UserAttributeForm from '@/components/user/UserAttributeForm.vue'
import { UiButton, UiDialog, UiIconButton, UiSelect, UiTextArea, UiTextField } from '@/components/ui'
import { useStepUp, isStepUpBlocked, isStepUpCancelled, stepUpBlockReason } from '@/composables/useStepUp'
import TotpStepUpDialog from '@/components/auth/TotpStepUpDialog.vue'

const props = defineProps<{ show: boolean, user: AdminUser | null }>()
const emit = defineEmits(['close', 'success'])
const { t } = useI18n(); const appStore = useAppStore(); const { copyToClipboard } = useClipboard()

const submitting = ref(false); const passwordCopied = ref(false)
const form = reactive({ email: '', password: '', username: '', notes: '', role: 'user', concurrency: 1, rpm_limit: 0, customAttributes: {} as UserAttributeValuesMap })

watch(() => props.user, (u) => {
  if (u) {
    Object.assign(form, { email: u.email, password: '', username: u.username || '', notes: u.notes || '', role: u.role || 'user', concurrency: u.concurrency, rpm_limit: u.rpm_limit ?? 0, customAttributes: {} })
    passwordCopied.value = false
  }
}, { immediate: true })

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*'
  let p = ''; for (let i = 0; i < 16; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
  form.password = p
}
const copyPassword = async () => {
  if (form.password && await copyToClipboard(form.password, t('admin.users.passwordCopied'))) {
    passwordCopied.value = true; setTimeout(() => passwordCopied.value = false, 2000)
  }
}
const stepUp = useStepUp()

const handleUpdateUser = async () => {
  if (!props.user) return
  if (!form.email.trim()) {
    appStore.showError(t('admin.users.emailRequired'))
    return
  }
  if (form.concurrency < 1) {
    appStore.showError(t('admin.users.concurrencyMin'))
    return
  }
  const userId = props.user.id
  submitting.value = true
  try {
    const data: any = { email: form.email, username: form.username, notes: form.notes, role: form.role, concurrency: form.concurrency, rpm_limit: form.rpm_limit }
    if (form.password.trim()) data.password = form.password.trim()
    // 提升为管理员属敏感操作：后端返回 STEP_UP_REQUIRED 时弹 TOTP 验证并重试
    await stepUp.run(() => adminAPI.users.update(userId, data))
    if (Object.keys(form.customAttributes).length > 0) await adminAPI.userAttributes.updateUserAttributeValues(userId, form.customAttributes)
    appStore.showSuccess(t('admin.users.userUpdated'))
    emit('success'); emit('close')
  } catch (e: any) {
    if (isStepUpCancelled(e)) {
      // 用户主动取消二次验证：静默返回，表单保持打开。
    } else if (isStepUpBlocked(e)) {
      appStore.showError(
        stepUpBlockReason(e) === 'STEP_UP_ADMIN_API_KEY_FORBIDDEN'
          ? t('stepUp.adminApiKeyForbidden')
          : t('stepUp.notEnabled')
      )
    } else {
      appStore.showError(e?.message || t('admin.users.failedToUpdate'))
    }
  } finally { submitting.value = false }
}
</script>

<style scoped>.user-modal-inline-field{display:flex;align-items:end;gap:8px}.user-modal-inline-field>.ui-form-field{min-width:0;flex:1}</style>
