<template>
  <UiSheet
    v-if="isMobile"
    :show="show"
    :title="title"
    :close-label="t('common.close')"
    @close="emit('close')"
  >
    <PlaygroundParametersForm v-model="model" :image-mode="imageMode" />
  </UiSheet>

  <UiDrawer
    v-else
    :show="show"
    :title="title"
    :close-label="t('common.close')"
    side="right"
    @close="emit('close')"
  >
    <PlaygroundParametersForm v-model="model" :image-mode="imageMode" />
  </UiDrawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { UiDrawer, UiSheet } from '@/components/ui'
import PlaygroundParametersForm from './PlaygroundParametersForm.vue'
import type { PlaygroundConfig } from '@/types/playground'

const props = defineProps<{ show: boolean; imageMode?: boolean }>()
const model = defineModel<PlaygroundConfig>({ required: true })
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const isMobile = useMediaQuery('(max-width: 640px)')
const title = computed(() => props.imageMode
  ? t('playground.image.parametersTitle')
  : t('playground.parameters.title'))
</script>
