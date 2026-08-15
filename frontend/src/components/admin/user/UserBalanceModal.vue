<template>
  <UiDialog :show="show" :title="operation === 'add' ? t('admin.users.deposit') : t('admin.users.withdraw')" width="narrow" @close="$emit('close')">
    <form v-if="user" id="balance-form" @submit.prevent="handleBalanceSubmit" class="space-y-5">
      <UiDescriptionList :columns="1" :items="balanceSummary" />
      <div class="balance-modal__amount">
          <UiTextField :model-value="form.amount" @update:model-value="form.amount = Number($event)" type="number" step="any" min="0" required density="compact" :label="operation === 'add' ? t('admin.users.depositAmount') : t('admin.users.withdrawAmount')">
            <template #prefix>$</template>
          </UiTextField>
          <UiButton v-if="operation === 'subtract'" type="button" density="compact" @click="fillAllBalance">{{ t('admin.users.withdrawAll') }}</UiButton>
      </div>
      <UiTextArea v-model="form.notes" :label="t('admin.users.notes')" :rows="3" />
      <UiDescriptionList v-if="form.amount > 0" :columns="1" :items="newBalanceSummary" />
    </form>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UiButton @click="$emit('close')">{{ t('common.cancel') }}</UiButton>
        <UiButton type="submit" form="balance-form" :disabled="submitting || !form.amount" :loading="submitting" :variant="operation === 'add' ? 'primary' : 'danger'">{{ submitting ? t('common.saving') : t('common.confirm') }}</UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { AdminUser } from '@/types'
import { UiButton, UiDescriptionList, UiDialog, UiTextArea, UiTextField } from '@/components/ui'

const props = defineProps<{ show: boolean, user: AdminUser | null, operation: 'add' | 'subtract' }>()
const emit = defineEmits(['close', 'success']); const { t } = useI18n(); const appStore = useAppStore()

const submitting = ref(false); const form = reactive({ amount: 0, notes: '' })
watch(() => props.show, (v) => { if(v) { form.amount = 0; form.notes = '' } })

// 格式化余额：显示完整精度，去除尾部多余的0
const formatBalance = (value: number) => {
  if (value === 0) return '0.00'
  // 最多保留8位小数，去除尾部的0
  const formatted = value.toFixed(8).replace(/\.?0+$/, '')
  // 确保至少有2位小数
  const parts = formatted.split('.')
  if (parts.length === 1) return formatted + '.00'
  if (parts[1].length === 1) return formatted + '0'
  return formatted
}

// 填入全部余额
const fillAllBalance = () => {
  if (props.user) {
    form.amount = props.user.balance
  }
}

const calculateNewBalance = () => {
  if (!props.user) return 0
  const result = props.operation === 'add' ? props.user.balance + form.amount : props.user.balance - form.amount
  // 避免浮点数精度问题导致的 -0.00 显示
  return Math.abs(result) < 1e-10 ? 0 : result
}
const balanceSummary = computed(() => [
  { label: t('admin.users.email'), value: props.user?.email || '' },
  { label: t('admin.users.currentBalance'), value: `$${formatBalance(props.user?.balance || 0)}`, numeric: true },
])
const newBalanceSummary = computed(() => [
  { label: t('admin.users.newBalance'), value: `$${formatBalance(calculateNewBalance())}`, numeric: true },
])
const handleBalanceSubmit = async () => {
  if (!props.user) return
  if (!form.amount || form.amount <= 0) {
    appStore.showError(t('admin.users.amountRequired'))
    return
  }
  // 退款时验证金额不超过实际余额
  if (props.operation === 'subtract' && form.amount > props.user.balance) {
    appStore.showError(t('admin.users.insufficientBalance'))
    return
  }
  submitting.value = true
  try {
    await adminAPI.users.updateBalance(props.user.id, form.amount, props.operation, form.notes)
    appStore.showSuccess(t('common.success')); emit('success'); emit('close')
  } catch (e: any) {
    console.error('Failed to update balance:', e)
    appStore.showError(e.response?.data?.detail || t('common.error'))
  } finally { submitting.value = false }
}
</script>

<style scoped>
.balance-modal__amount{display:flex;align-items:end;gap:8px}.balance-modal__amount>.ui-form-field{min-width:0;flex:1}@media(max-width:440px){.balance-modal__amount{align-items:stretch;flex-direction:column}}
</style>
