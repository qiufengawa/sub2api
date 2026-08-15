<template>
  <AppStack :gap="8">
    <div v-if="rows.length" class="header-override__rows">
      <div v-for="(row, index) in rows" :key="getHeaderOverrideRowKey(row)" class="header-override__row">
        <UiTextField
          v-model="row.name"
          density="dense"
          :placeholder="t('admin.accounts.headerOverride.namePlaceholder')"
          :input-attrs="{ 'aria-label': t('admin.accounts.headerOverride.namePlaceholder') }"
        />
        <UiTextField
          v-model="row.value"
          density="dense"
          :placeholder="t('admin.accounts.headerOverride.valuePlaceholder')"
          :input-attrs="{ 'aria-label': t('admin.accounts.headerOverride.valuePlaceholder') }"
        />
        <UiIconButton
          :label="t('common.delete')"
          variant="danger"
          density="dense"
          @click="removeRow(index)"
        >
          <Icon name="trash" size="sm" />
        </UiIconButton>
      </div>
    </div>

    <UiButton block density="dense" variant="secondary" @click="addRow">
      <template #icon><Icon name="plus" size="sm" /></template>
      {{ t('admin.accounts.headerOverride.addRow') }}
    </UiButton>

    <HeaderOverrideJsonTools :rows="rows" @update:rows="emit('update:rows', $event)" />
    <p class="header-override__hint">{{ t('admin.accounts.headerOverride.emptyValueHint') }}</p>
  </AppStack>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { createStableObjectKeyResolver } from '@/utils/stableObjectKey'
import Icon from '@/components/icons/Icon.vue'
import { AppStack, UiButton, UiIconButton, UiTextField } from '@/components/ui'
import HeaderOverrideJsonTools from './HeaderOverrideJsonTools.vue'
import type { HeaderOverrideRow } from './credentialsBuilder'

const props = defineProps<{
  rows: HeaderOverrideRow[]
}>()

const emit = defineEmits<{
  (e: 'update:rows', rows: HeaderOverrideRow[]): void
}>()

const { t } = useI18n()

const getHeaderOverrideRowKey = createStableObjectKeyResolver<HeaderOverrideRow>(
  'header-override-row'
)

const addRow = () => {
  emit('update:rows', [...props.rows, { name: '', value: '' }])
}

const removeRow = (index: number) => {
  emit('update:rows', props.rows.filter((_, i) => i !== index))
}
</script>

<style scoped>
.header-override__rows{display:grid;gap:6px}
.header-override__row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 28px;align-items:center;gap:6px}
.header-override__hint{margin:0;color:var(--ui-text-soft);font-size:12px;line-height:18px}
@media(max-width:540px){.header-override__row{grid-template-columns:minmax(0,1fr) 28px}.header-override__row>:nth-child(2){grid-column:1/2}}
</style>
