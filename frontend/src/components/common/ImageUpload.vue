<template>
  <div class="flex items-start gap-3">
    <!-- Preview Box -->
    <div class="flex-shrink-0">
      <div
        class="flex items-center justify-center overflow-hidden rounded-[4px] border border-dashed border-gray-300 bg-gray-50 dark:border-dark-600 dark:bg-dark-800"
        :class="[previewSizeClass, { 'border-solid': !!modelValue }]"
      >
        <!-- SVG mode: render inline -->
        <span
          v-if="mode === 'svg' && modelValue"
          class="text-gray-600 dark:text-gray-300 [&>svg]:h-full [&>svg]:w-full"
          :class="innerSizeClass"
          v-html="sanitizedValue"
        ></span>
        <!-- Image mode: show as img -->
        <img
          v-else-if="mode === 'image' && modelValue"
          :src="modelValue"
          alt=""
          class="h-full w-full object-contain"
        />
        <!-- Empty placeholder -->
        <Icon
          v-else
          name="image"
          class="text-gray-400 dark:text-dark-500"
          :class="placeholderSizeClass"
          :stroke-width="1.5"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- Controls -->
    <div class="flex-1 space-y-2">
      <div class="flex items-center gap-2">
        <UiButton type="button" density="compact" @click="openFilePicker">
          <template #icon><Icon name="upload" size="sm" :stroke-width="2" /></template>
          {{ resolvedUploadLabel }}
        </UiButton>
        <input
          ref="fileInput"
          type="file"
          :accept="acceptTypes"
          class="hidden"
          @change="handleUpload"
        />
        <UiButton
          v-if="modelValue"
          type="button"
          variant="danger"
          density="compact"
          @click="$emit('update:modelValue', '')"
        >
          <template #icon><Icon name="trash" size="sm" :stroke-width="2" /></template>
          {{ resolvedRemoveLabel }}
        </UiButton>
      </div>
      <p v-if="hint" class="text-xs text-gray-500 dark:text-gray-400">{{ hint }}</p>
      <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { UiButton } from '@/components/ui'
import { sanitizeSvg } from '@/utils/sanitize'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue: string
  mode?: 'image' | 'svg'
  size?: 'sm' | 'md'
  aspect?: 'square' | 'wide'
  uploadLabel?: string
  removeLabel?: string
  hint?: string
  maxSize?: number // bytes
}>(), {
  mode: 'image',
  size: 'md',
  aspect: 'square',
  uploadLabel: '',
  removeLabel: '',
  hint: '',
  maxSize: 300 * 1024,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const resolvedUploadLabel = computed(() => props.uploadLabel || t('common.upload'))
const resolvedRemoveLabel = computed(() => props.removeLabel || t('common.remove'))

const acceptTypes = computed(() => props.mode === 'svg' ? '.svg' : 'image/*')

const sanitizedValue = computed(() =>
  props.mode === 'svg' ? sanitizeSvg(props.modelValue ?? '') : ''
)

const previewSizeClass = computed(() => {
  if (props.aspect === 'wide') {
    return props.size === 'sm' ? 'h-10 w-40' : 'h-16 w-64 max-w-full'
  }
  return props.size === 'sm' ? 'h-12 w-12' : 'h-16 w-16'
})
const innerSizeClass = computed(() => props.size === 'sm' ? 'h-6 w-6' : 'h-9 w-9')
const placeholderSizeClass = computed(() => props.size === 'sm' ? 'h-5 w-5' : 'h-8 w-8')

function openFilePicker() {
  fileInput.value?.click()
}

function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  error.value = ''

  if (!file) return

  if (props.maxSize && file.size > props.maxSize) {
    error.value = t('common.fileTooLargeKb', {
      size: (file.size / 1024).toFixed(1),
      max: (props.maxSize / 1024).toFixed(0)
    })
    input.value = ''
    return
  }

  const reader = new FileReader()
  if (props.mode === 'svg') {
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (text) emit('update:modelValue', text.trim())
    }
    reader.readAsText(file)
  } else {
    if (!file.type.startsWith('image/')) {
      error.value = t('common.selectImageFile')
      input.value = ''
      return
    }
    reader.onload = (e) => {
      emit('update:modelValue', e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  reader.onerror = () => {
    error.value = t('common.fileReadFailed')
  }
  input.value = ''
}
</script>
