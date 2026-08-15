<template>
  <section class="group-exclusive-field">
    <div class="group-exclusive-field__label">
      <span>{{ t('admin.groups.form.exclusive') }}</span>
      <UiFieldHelp :content="helpContent" />
    </div>
    <div class="group-exclusive-field__control">
      <UiSwitch
        :model-value="modelValue"
        :label="t('admin.groups.form.exclusive')"
        @update:model-value="emit('update:modelValue', $event)"
      />
      <span>{{ modelValue ? t('admin.groups.exclusive') : t('admin.groups.public') }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { UiFieldHelp, UiSwitch } from '@/components/ui'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
const { t } = useI18n()

const helpContent = computed(() => [
  t('admin.groups.exclusiveTooltip.title'),
  t('admin.groups.exclusiveTooltip.description'),
  `${t('admin.groups.exclusiveTooltip.example')}: ${t('admin.groups.exclusiveTooltip.exampleContent')}`
].join('\n'))
</script>

<style scoped>
.group-exclusive-field{display:grid;gap:6px}
.group-exclusive-field__label{display:flex;align-items:center;gap:4px;color:var(--ui-text);font-size:12px;font-weight:600;line-height:18px}
.group-exclusive-field__control{display:flex;min-height:28px;align-items:center;gap:9px;color:var(--ui-text-muted);font-size:12px}
</style>
