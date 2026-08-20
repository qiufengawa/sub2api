<template>
  <div v-if="attributes.length > 0" class="space-y-4">
    <div v-for="attr in attributes" :key="attr.id">
      <!-- Text Input -->
      <UiTextField
        v-if="attr.type === 'text' || attr.type === 'email' || attr.type === 'url'"
        v-model="localValues[attr.id]"
        :type="attr.type === 'text' ? 'text' : attr.type"
        :label="attr.name"
        :required="attr.required"
        :description="attr.description"
        :placeholder="attr.placeholder"
        density="compact"
        @input="emitChange"
      />

      <!-- Number Input -->
      <UiTextField
        v-else-if="attr.type === 'number'"
        v-model="localValues[attr.id]"
        type="number"
        :label="attr.name"
        :required="attr.required"
        :description="attr.description"
        :placeholder="attr.placeholder"
        :min="attr.validation?.min"
        :max="attr.validation?.max"
        density="compact"
        @input="emitChange"
      />

      <!-- Date Input -->
      <UiTextField
        v-else-if="attr.type === 'date'"
        v-model="localValues[attr.id]"
        type="date"
        :label="attr.name"
        :required="attr.required"
        :description="attr.description"
        density="compact"
        @input="emitChange"
      />

      <!-- Textarea -->
      <UiTextArea
        v-else-if="attr.type === 'textarea'"
        v-model="localValues[attr.id]"
        :label="attr.name"
        :required="attr.required"
        :description="attr.description"
        :placeholder="attr.placeholder"
        :rows="3"
        @input="emitChange"
      />

      <!-- Select -->
      <UiSelect
        v-else-if="attr.type === 'select'"
        v-model="localValues[attr.id]"
        :label="attr.name"
        :required="attr.required"
        :description="attr.description"
        :options="attr.options || []"
        density="compact"
        @change="emitChange"
      />

      <!-- Multi-Select (Checkboxes) -->
      <div v-else-if="attr.type === 'multi_select'" class="space-y-2">
        <p class="text-sm font-medium text-gray-900 dark:text-white">
          {{ attr.name }}<span v-if="attr.required" class="text-red-500">*</span>
        </p>
        <UiCheckbox
          v-for="opt in attr.options"
          :key="opt.value"
          full-width
          :model-value="isOptionSelected(attr.id, opt.value)"
          @update:model-value="toggleMultiSelectOption(attr.id, opt.value)"
        >
          {{ opt.label }}
        </UiCheckbox>
        <p v-if="attr.description" class="ui-field-hint">{{ attr.description }}</p>
      </div>

      <!-- Description -->
    </div>
  </div>

  <!-- Loading State -->
  <div v-else-if="loading" class="flex justify-center py-4">
    <UiSpinner size="sm" :label="t('common.loading')" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { adminAPI } from '@/api/admin'
import type { UserAttributeDefinition, UserAttributeValuesMap } from '@/types'
import { UiCheckbox, UiSelect, UiSpinner, UiTextArea, UiTextField } from '@/components/ui'

interface Props {
  userId?: number
  modelValue: UserAttributeValuesMap
}

interface Emits {
  (e: 'update:modelValue', value: UserAttributeValuesMap): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

const loading = ref(false)
const attributes = ref<UserAttributeDefinition[]>([])
const localValues = ref<UserAttributeValuesMap>({})

const loadAttributes = async () => {
  loading.value = true
  try {
    attributes.value = await adminAPI.userAttributes.listEnabledDefinitions()
  } catch (error) {
    console.error('Failed to load attributes:', error)
  } finally {
    loading.value = false
  }
}

const loadUserValues = async () => {
  if (!props.userId) return

  try {
    const values = await adminAPI.userAttributes.getUserAttributeValues(props.userId)
    const valuesMap: UserAttributeValuesMap = {}
    values.forEach(v => {
      valuesMap[v.attribute_id] = v.value
    })
    localValues.value = { ...valuesMap }
    emit('update:modelValue', localValues.value)
  } catch (error) {
    console.error('Failed to load user attribute values:', error)
  }
}

const emitChange = () => {
  emit('update:modelValue', { ...localValues.value })
}

const isOptionSelected = (attrId: number, optionValue: string): boolean => {
  const value = localValues.value[attrId]
  if (!value) return false
  try {
    const arr = JSON.parse(value)
    return Array.isArray(arr) && arr.includes(optionValue)
  } catch {
    return false
  }
}

const toggleMultiSelectOption = (attrId: number, optionValue: string) => {
  let arr: string[] = []
  const value = localValues.value[attrId]
  if (value) {
    try {
      arr = JSON.parse(value)
      if (!Array.isArray(arr)) arr = []
    } catch {
      arr = []
    }
  }

  const index = arr.indexOf(optionValue)
  if (index > -1) {
    arr.splice(index, 1)
  } else {
    arr.push(optionValue)
  }

  localValues.value[attrId] = JSON.stringify(arr)
  emitChange()
}

watch(() => props.modelValue, (newVal) => {
  if (newVal && Object.keys(newVal).length > 0) {
    localValues.value = { ...newVal }
  }
}, { immediate: true })

watch(() => props.userId, (newUserId) => {
  if (newUserId) {
    loadUserValues()
  } else {
    // Reset for new user
    localValues.value = {}
  }
}, { immediate: true })

onMounted(() => {
  loadAttributes()
})
</script>
