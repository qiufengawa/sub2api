<template>
  <UiDialog
    :show="show"
    :title="t('admin.users.createUser')"
    width="normal"
    @close="$emit('close')"
  >
    <form id="create-user-form" class="user-modal-form" @submit.prevent="submit">
      <UiTextField v-model="form.email" type="email" required :label="t('admin.users.email')" :placeholder="t('admin.users.enterEmail')" />
      <div class="user-modal-inline-field"><UiTextField v-model="form.password" type="text" required :label="t('admin.users.password')" :placeholder="t('admin.users.enterPassword')" /><UiIconButton icon="refresh" density="compact" :label="t('common.refresh')" @click="generateRandomPassword" /></div>
      <UiTextField v-model="form.username" :label="t('admin.users.username')" :placeholder="t('admin.users.enterUsername')" />
      <UiSelect v-model="form.role" :label="t('admin.users.form.roleLabel')" :options="[{ value: 'user', label: t('admin.users.roles.user') }, { value: 'admin', label: t('admin.users.roles.admin') }]" />
      <div class="user-modal-grid">
        <UiTextField v-model="form.balance" type="number" step="any" :label="t('admin.users.columns.balance')" />
        <UiTextField type="number" :label="t('admin.users.columns.concurrency')" :model-value="form.concurrency" @update:model-value="form.concurrency = Number($event) || 0" />
      </div>
      <UiTextField type="number" min="0" step="1" :label="t('admin.users.form.rpmLimit')" :description="t('admin.users.form.rpmLimitHint')" :placeholder="t('admin.users.form.rpmLimitPlaceholder')" :model-value="form.rpm_limit" @update:model-value="form.rpm_limit = Number($event) || 0" />
    </form>
    <template #footer>
      <UiButton density="compact" @click="$emit('close')" type="button">{{ t('common.cancel') }}</UiButton>
      <UiButton density="compact" type="submit" form="create-user-form" :loading="loading" variant="primary">
        {{ loading ? t('admin.users.creating') : t('common.create') }}
      </UiButton>
    </template>
  </UiDialog>

  <!-- 创建管理员账号时后端要求 step-up 2FA，弹出 TOTP 验证后自动重试 -->
  <TotpStepUpDialog :controller="stepUp" />
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'; import { adminAPI } from '@/api/admin'
import { useAppStore } from '@/stores/app'
import { UiButton, UiDialog, UiIconButton, UiSelect, UiTextField } from '@/components/ui'
import { useStepUp, isStepUpBlocked, isStepUpCancelled, stepUpBlockReason } from '@/composables/useStepUp'
import TotpStepUpDialog from '@/components/auth/TotpStepUpDialog.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits(['close', 'success']); const { t } = useI18n()
const appStore = useAppStore()

const form = reactive({ email: '', password: '', username: '', notes: '', role: 'user' as 'user' | 'admin', balance: '', concurrency: 1, rpm_limit: 0 })

const stepUp = useStepUp()
const loading = ref(false)

const submit = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const { balance: rawBalance, ...rest } = { ...form }
    const balance = String(rawBalance).trim()
    const payload: typeof rest & { balance?: number } = { ...rest }
    if (balance !== '') {
      payload.balance = Number(balance)
    }
    // 创建管理员属敏感操作：后端返回 STEP_UP_REQUIRED 时弹 TOTP 验证并重试
    await stepUp.run(() => adminAPI.users.create(payload))
    appStore.showSuccess(t('admin.users.userCreated'))
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
      appStore.showError(e?.message || t('admin.users.failedToCreate'))
    }
  } finally { loading.value = false }
}

watch(() => props.show, (v) => { if(v) Object.assign(form, { email: '', password: '', username: '', notes: '', role: 'user', balance: '', concurrency: 1, rpm_limit: 0 }) })

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*'
  let p = ''; for (let i = 0; i < 16; i++) p += chars.charAt(Math.floor(Math.random() * chars.length))
  form.password = p
}
</script>

<style scoped>
.user-modal-form{display:grid;gap:14px}.user-modal-inline-field{display:flex;align-items:end;gap:8px}.user-modal-inline-field>.ui-form-field{min-width:0;flex:1}.user-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(max-width:640px){.user-modal-grid{grid-template-columns:1fr}}
</style>
