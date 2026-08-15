<template>
  <div class="flex flex-wrap items-center gap-2">
    <slot name="before"></slot>
    <UiIconButton icon="refresh" density="compact" :label="t('common.refresh')" :disabled="loading" @click="$emit('refresh')" />
    <slot name="after"></slot>
    <slot name="beforeCreate"></slot>
    <UiButton variant="primary" density="compact" @click="$emit('create')">
      <template #icon><Icon name="plus" size="sm" /></template>
      {{ t('admin.accounts.createAccount') }}
    </UiButton>
    <slot name="afterCreate"></slot>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiIconButton } from '@/components/ui'

defineProps(['loading'])
defineEmits(['refresh', 'create'])

const { t } = useI18n()
</script>
