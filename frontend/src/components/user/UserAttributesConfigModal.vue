<template>
  <UiDialog :show="show" :title="t('admin.users.attributes.title')" width="wide" @close="emit('close')">
    <div class="space-y-4">
      <!-- Header with Add Button -->
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-500 dark:text-dark-400">
          {{ t('admin.users.attributes.description') }}
        </p>
        <UiButton @click="openCreateModal" variant="primary" density="compact"><template #icon><Icon name="plus" size="sm" /></template>{{ t('admin.users.attributes.addAttribute') }}</UiButton>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center py-12">
        <UiSpinner size="lg" :label="t('common.loading')" />
      </div>

      <!-- Empty State -->
      <div v-else-if="attributes.length === 0" class="py-12 text-center">
        <Icon name="inbox" size="xl" class="mx-auto text-gray-400" />
        <p class="mt-2 text-sm text-gray-500 dark:text-dark-400">
          {{ t('admin.users.attributes.noAttributes') }}
        </p>
        <p class="text-xs text-gray-400 dark:text-dark-500">
          {{ t('admin.users.attributes.noAttributesHint') }}
        </p>
      </div>

      <!-- Attributes List -->
      <div v-else class="max-h-96 space-y-2 overflow-y-auto">
        <div
          v-for="attr in attributes"
          :key="attr.id"
          class="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-dark-600 dark:bg-dark-800"
        >
          <!-- Drag Handle -->
          <div class="cursor-move text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" :title="t('admin.users.attributes.dragToReorder')">
            <Icon name="menu" size="md" />
          </div>

          <!-- Attribute Info -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium text-gray-900 dark:text-white">{{ attr.name }}</span>
              <span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 dark:bg-dark-700 dark:text-dark-400">
                {{ attr.key }}
              </span>
              <UiBadge v-if="attr.required" tone="danger">
                {{ t('admin.users.attributes.required') }}
              </UiBadge>
              <UiBadge v-if="!attr.enabled">
                {{ t('common.disabled') }}
              </UiBadge>
            </div>
            <div class="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-dark-400">
              <UiBadge>{{ t(`admin.users.attributes.types.${attr.type}`) }}</UiBadge>
              <span v-if="attr.description" class="truncate">{{ attr.description }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1">
            <UiIconButton
              @click="openEditModal(attr)"
              variant="ghost" :label="t('common.edit')"
              :title="t('common.edit')"
            >
              <Icon name="edit" size="sm" />
            </UiIconButton>
            <UiIconButton
              @click="confirmDelete(attr)"
              variant="danger" :label="t('common.delete')"
              :title="t('common.delete')"
            >
              <Icon name="trash" size="sm" />
            </UiIconButton>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <UiButton @click="emit('close')">{{ t('common.close') }}</UiButton>
      </div>
    </template>
  </UiDialog>

  <!-- Create/Edit Attribute Modal -->
  <UiDialog
    :show="showEditModal"
    :title="editingAttribute ? t('admin.users.attributes.editAttribute') : t('admin.users.attributes.addAttribute')"
    width="normal"
    @close="closeEditModal"
  >
    <form id="attribute-form" @submit.prevent="handleSave" class="space-y-4">
      <!-- Key -->
      <div>
        <label class="ui-field-label">{{ t('admin.users.attributes.key') }}</label>
        <UiTextField
          v-model="form.key"
          type="text"
          required
          pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
          density="compact" monospace
          :placeholder="t('admin.users.attributes.keyHint')"
          :disabled="!!editingAttribute"
        />
        <p class="ui-field-hint">{{ t('admin.users.attributes.keyHint') }}</p>
      </div>

      <!-- Name -->
      <div>
        <label class="ui-field-label">{{ t('admin.users.attributes.name') }}</label>
        <UiTextField
          v-model="form.name"
          type="text"
          required
          density="compact"
          :placeholder="t('admin.users.attributes.nameHint')"
        />
      </div>

      <!-- Type -->
      <div>
        <label class="ui-field-label">{{ t('admin.users.attributes.type') }}</label>
        <UiSelect
          v-model="form.type"
          :options="attributeTypes.map(type => ({ value: type, label: t(`admin.users.attributes.types.${type}`) }))"
        />
      </div>

      <!-- Options (for select/multi_select) -->
      <div v-if="form.type === 'select' || form.type === 'multi_select'" class="space-y-2">
        <label class="ui-field-label">{{ t('admin.users.attributes.options') }}</label>
        <div v-for="(option, index) in form.options" :key="getOptionKey(option)" class="flex items-center gap-2">
          <UiTextField
            v-model="option.value"
            type="text"
            density="compact" monospace
            :placeholder="t('admin.users.attributes.optionValue')"
            required
          />
          <UiTextField
            v-model="option.label"
            type="text"
            density="compact"
            :placeholder="t('admin.users.attributes.optionLabel')"
            required
          />
          <UiIconButton
            type="button"
            @click="removeOption(index)"
            variant="danger" :label="t('common.delete')"
          >
            <Icon name="x" size="sm" :stroke-width="2" />
          </UiIconButton>
        </div>
        <UiButton type="button" @click="addOption" density="compact"><template #icon><Icon name="plus" size="sm" /></template>{{ t('admin.users.attributes.addOption') }}</UiButton>
      </div>

      <!-- Description -->
      <div>
        <label class="ui-field-label">{{ t('admin.users.attributes.fieldDescription') }}</label>
        <UiTextField
          v-model="form.description"
          type="text"
          density="compact"
          :placeholder="t('admin.users.attributes.fieldDescriptionHint')"
        />
      </div>

      <!-- Placeholder -->
      <div>
        <label class="ui-field-label">{{ t('admin.users.attributes.placeholder') }}</label>
        <UiTextField
          v-model="form.placeholder"
          type="text"
          density="compact"
          :placeholder="t('admin.users.attributes.placeholderHint')"
        />
      </div>

      <!-- Required & Enabled -->
      <div class="flex items-center gap-6">
        <label class="flex items-center gap-2">
          <UiCheckbox v-model="form.required" :label="t('admin.users.attributes.required')" />
        </label>
        <label class="flex items-center gap-2">
          <UiCheckbox v-model="form.enabled" :label="t('admin.users.attributes.enabled')" />
        </label>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UiButton @click="closeEditModal" type="button">{{ t('common.cancel') }}</UiButton>
        <UiButton type="submit" form="attribute-form" :disabled="saving" :loading="saving" variant="primary">{{ saving ? t('common.saving') : (editingAttribute ? t('common.update') : t('common.create')) }}</UiButton>
      </div>
    </template>
  </UiDialog>

  <!-- Delete Confirmation -->
  <UiConfirmDialog
    :show="showDeleteDialog"
    :title="t('admin.users.attributes.deleteAttribute')"
    :message="t('admin.users.attributes.deleteConfirm', { name: deletingAttribute?.name })"
    :confirm-text="t('common.delete')"
    :cancel-text="t('common.cancel')"
    :danger="true"
    :pending="deletePending"
    @confirm="handleDelete"
    @cancel="showDeleteDialog = false; deletingAttribute = null"
  />
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import { adminAPI } from '@/api/admin'
import type { UserAttributeDefinition, UserAttributeType, UserAttributeOption } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import { UiBadge, UiButton, UiCheckbox, UiConfirmDialog, UiDialog, UiIconButton, UiSelect, UiSpinner, UiTextField } from '@/components/ui'
import { createStableObjectKeyResolver } from '@/utils/stableObjectKey'

const { t } = useI18n()
const appStore = useAppStore()

interface Props {
  show: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const attributeTypes: UserAttributeType[] = ['text', 'textarea', 'number', 'email', 'url', 'date', 'select', 'multi_select']

const loading = ref(false)
const saving = ref(false)
const attributes = ref<UserAttributeDefinition[]>([])
const showEditModal = ref(false)
const showDeleteDialog = ref(false)
const deletePending = ref(false)
const editingAttribute = ref<UserAttributeDefinition | null>(null)
const deletingAttribute = ref<UserAttributeDefinition | null>(null)
const getOptionKey = createStableObjectKeyResolver<UserAttributeOption>('user-attr-option')

const form = reactive({
  key: '',
  name: '',
  type: 'text' as UserAttributeType,
  description: '',
  placeholder: '',
  required: false,
  enabled: true,
  options: [] as UserAttributeOption[]
})

const loadAttributes = async () => {
  loading.value = true
  try {
    attributes.value = await adminAPI.userAttributes.listDefinitions()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.users.attributes.failedToLoad'))
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  editingAttribute.value = null
  form.key = ''
  form.name = ''
  form.type = 'text'
  form.description = ''
  form.placeholder = ''
  form.required = false
  form.enabled = true
  form.options = []
  showEditModal.value = true
}

const openEditModal = (attr: UserAttributeDefinition) => {
  editingAttribute.value = attr
  form.key = attr.key
  form.name = attr.name
  form.type = attr.type
  form.description = attr.description || ''
  form.placeholder = attr.placeholder || ''
  form.required = attr.required
  form.enabled = attr.enabled
  form.options = attr.options ? attr.options.map((opt) => ({ ...opt })) : []
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingAttribute.value = null
}

const addOption = () => {
  form.options.push({ value: '', label: '' })
}

const removeOption = (index: number) => {
  form.options.splice(index, 1)
}

const handleSave = async () => {
  if (!form.key.trim()) {
    appStore.showError(t('admin.users.attributes.keyRequired'))
    return
  }
  if (!form.name.trim()) {
    appStore.showError(t('admin.users.attributes.nameRequired'))
    return
  }
  if ((form.type === 'select' || form.type === 'multi_select') && form.options.length === 0) {
    appStore.showError(t('admin.users.attributes.optionsRequired'))
    return
  }
  saving.value = true
  try {
    const data = {
      key: form.key,
      name: form.name,
      type: form.type,
      description: form.description || undefined,
      placeholder: form.placeholder || undefined,
      required: form.required,
      enabled: form.enabled,
      options: (form.type === 'select' || form.type === 'multi_select') ? form.options : undefined
    }

    if (editingAttribute.value) {
      await adminAPI.userAttributes.updateDefinition(editingAttribute.value.id, data)
      appStore.showSuccess(t('admin.users.attributes.updated'))
    } else {
      await adminAPI.userAttributes.createDefinition(data)
      appStore.showSuccess(t('admin.users.attributes.created'))
    }

    closeEditModal()
    loadAttributes()
  } catch (error: any) {
    const msg = editingAttribute.value
      ? t('admin.users.attributes.failedToUpdate')
      : t('admin.users.attributes.failedToCreate')
    appStore.showError(error.response?.data?.detail || msg)
  } finally {
    saving.value = false
  }
}

const confirmDelete = (attr: UserAttributeDefinition) => {
  deletingAttribute.value = attr
  showDeleteDialog.value = true
}

const handleDelete = async () => {
  if (deletePending.value || !deletingAttribute.value) return
  const attribute = deletingAttribute.value
  deletePending.value = true

  try {
    await adminAPI.userAttributes.deleteDefinition(attribute.id)
    appStore.showSuccess(t('admin.users.attributes.deleted'))
    showDeleteDialog.value = false
    deletingAttribute.value = null
    loadAttributes()
  } catch (error: any) {
    appStore.showError(error.response?.data?.detail || t('admin.users.attributes.failedToDelete'))
  } finally {
    deletePending.value = false
  }
}

watch(() => props.show, (isShow) => {
  if (isShow) {
    loadAttributes()
  }
})
</script>
