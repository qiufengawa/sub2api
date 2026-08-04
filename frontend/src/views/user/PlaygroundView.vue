<template>
  <AppLayout>
    <div class="flex h-[calc(100dvh-5.5rem)] min-h-0 min-w-0 flex-col overflow-hidden bg-gray-50 md:h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-7rem)] dark:bg-dark-900">
      <header class="flex flex-none flex-col gap-2 border-b border-gray-200 bg-white px-3 py-2.5 sm:px-5 lg:gap-3 dark:border-dark-700 dark:bg-dark-900">
        <div class="flex min-w-0 items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="flex h-8 w-8 flex-none items-center justify-center rounded-[4px] bg-primary-50 text-primary-600 dark:bg-primary-950/30 dark:text-primary-300">
              <Icon :name="isImageMode ? 'sparkles' : 'chat'" size="sm" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <h1 class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ t('playground.title') }}</h1>
              <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-dark-400" aria-live="polite">
                <span
                  class="h-1.5 w-1.5 flex-none rounded-full"
                  :class="isGenerating ? 'bg-primary-500' : optionsError ? 'bg-red-500' : 'bg-green-500'"
                ></span>
                <span>{{ sessionStatus }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-none items-center gap-1">
            <button
              type="button"
              class="btn btn-secondary btn-sm h-8 px-2 sm:px-2.5"
              :disabled="isGenerating"
              :title="parameterTitle"
              :aria-label="parameterTitle"
              @click="showParameters = true"
            >
              <Icon name="cog" size="sm" class="sm:mr-1.5" />
              <span class="hidden md:inline">{{ parameterTitle }}</span>
              <span v-if="enabledParameterCount" class="ml-1 rounded-[3px] bg-primary-100 px-1 text-[10px] text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                {{ enabledParameterCount }}
              </span>
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm h-8 px-2 sm:px-2.5"
              :title="t('playground.actions.requestJson')"
              :aria-label="t('playground.actions.requestJson')"
              @click="showPreview = true"
            >
              <Icon name="document" size="sm" class="sm:mr-1.5" />
              <span class="hidden md:inline">{{ t('playground.actions.requestJson') }}</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm h-8 px-2 sm:px-2.5"
              :disabled="messages.length === 0"
              :title="t('playground.actions.newConversation')"
              :aria-label="t('playground.actions.newConversation')"
              @click="showClearConfirm = true"
            >
              <Icon name="plus" size="sm" class="sm:mr-1.5" />
              <span class="hidden md:inline">{{ t('playground.actions.newConversation') }}</span>
            </button>
          </div>
        </div>

        <div class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_auto] lg:items-start">
          <div class="min-w-0">
            <Select
              :model-value="config.keyId"
              :options="keyOptions"
              value-key="value"
              label-key="label"
              :disabled="isGenerating || isLoadingKeys"
              :placeholder="isLoadingKeys ? t('common.loading') : t('playground.composer.selectKey')"
              :empty-text="t('playground.empty.noKeys')"
              :aria-label="t('playground.composer.selectKey')"
              @update:model-value="changeKey"
            >
              <template #selected="{ option }">
                <span class="block min-w-0 truncate" :title="String(option?.label || '')">{{ option?.label }}</span>
              </template>
              <template #option="{ option, selected }">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm" :title="option.label">{{ option.label }}</div>
                  <div v-if="option.group" class="mt-0.5 truncate text-[11px] text-gray-400" :title="option.group">{{ option.group }}</div>
                </div>
                <Icon v-if="selected" name="check" size="sm" class="flex-none text-primary-500" />
              </template>
            </Select>
          </div>

          <Select
            v-model="config.model"
            class="min-w-0"
            :options="modelOptions"
            value-key="value"
            label-key="label"
            :disabled="isGenerating || isLoadingModels || !selectedKey"
            :placeholder="isLoadingModels ? t('common.loading') : t('playground.composer.selectModel')"
            :empty-text="t('playground.empty.noModels')"
            :aria-label="t('playground.composer.selectModel')"
            searchable
          >
            <template #selected="{ option }">
              <span class="flex min-w-0 items-center gap-1.5">
                <Icon v-if="option?.image" name="sparkles" size="xs" class="flex-none text-primary-500" />
                <span class="block min-w-0 truncate font-mono text-xs" :title="String(option?.label || '')">{{ option?.label }}</span>
              </span>
            </template>
            <template #option="{ option, selected }">
              <Icon v-if="option.image" name="sparkles" size="xs" class="flex-none text-primary-500" />
              <span class="min-w-0 flex-1 truncate font-mono text-xs" :title="option.label">{{ option.label }}</span>
              <Icon v-if="selected" name="check" size="sm" class="flex-none text-primary-500" />
            </template>
          </Select>

          <div class="flex min-w-0 items-center justify-between gap-3 px-0.5 text-[11px] text-gray-500 sm:col-span-2 lg:col-span-1 lg:min-w-44 lg:justify-end dark:text-dark-400">
            <span v-if="selectedKey" class="min-w-0 truncate" :title="`${selectedKey.group_name} / ${selectedKey.platform}`">
              {{ selectedKey.group_name || t('playground.composer.noGroup') }}<span v-if="selectedKey.platform"> / {{ selectedKey.platform }}</span>
            </span>
            <span v-else class="truncate">{{ t('playground.composer.noGroup') }}</span>
            <span v-if="isImageMode" class="inline-flex flex-none items-center gap-1.5 font-medium text-primary-600 dark:text-primary-300">
              <Icon name="sparkles" size="xs" />
              {{ t('playground.image.mode') }}
            </span>
            <label v-else class="inline-flex flex-none items-center gap-2">
              <Toggle v-model="config.stream" :disabled="isGenerating" :aria-label="t('playground.composer.stream')" />
              <span>{{ config.stream ? t('playground.composer.stream') : t('playground.composer.nonStream') }}</span>
            </label>
          </div>
        </div>
      </header>

      <div v-if="optionsError" class="flex flex-none items-start gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-300">
        <Icon name="exclamationCircle" size="sm" class="mt-0.5 flex-none" />
        <span class="min-w-0 flex-1 break-words">{{ optionsError }}</span>
        <button type="button" class="font-medium underline" @click="loadKeys">{{ t('common.retry') }}</button>
      </div>
      <div v-else-if="keysTruncated" class="flex-none border-b border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300">
        {{ t('playground.notices.keysTruncated') }}
      </div>
      <div v-else-if="storageWarning" class="flex-none border-b border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300">
        {{ t('playground.notices.storageUnavailable') }}
      </div>
      <div v-if="parameterErrors.length" class="flex-none border-b border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300">
        {{ t('playground.errors.invalidParameters') }}
      </div>

      <div ref="scrollRef" class="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/70 dark:bg-dark-900" @scroll="handleScroll">
        <div v-if="isLoadingKeys && keys.length === 0" class="flex h-full min-h-64 items-center justify-center">
          <LoadingSpinner />
        </div>

        <div v-else-if="keys.length === 0" class="flex h-full min-h-64 flex-col items-center justify-center px-5 text-center">
          <div class="mb-3 text-gray-400 dark:text-dark-500"><Icon name="key" size="lg" /></div>
          <p class="text-sm font-medium text-gray-800 dark:text-dark-100">{{ t('playground.empty.noKeys') }}</p>
          <router-link to="/keys" class="btn btn-primary btn-sm mt-4">
            <Icon name="plus" size="sm" class="mr-1.5" />
            {{ t('playground.empty.createKey') }}
          </router-link>
        </div>

        <div v-else-if="messages.length === 0" class="flex h-full min-h-64 flex-col items-center justify-center px-5 text-center">
          <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-[4px] border border-primary-100 bg-primary-50 text-primary-500 dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-300">
            <Icon :name="isImageMode ? 'sparkles' : 'chat'" size="lg" />
          </div>
          <p class="text-sm font-medium text-gray-800 dark:text-dark-100">{{ isImageMode ? t('playground.image.empty') : t('playground.empty.conversation') }}</p>
        </div>

        <div v-else class="mx-auto w-full max-w-5xl py-2 sm:py-4">
          <PlaygroundMessage
            v-for="(message, index) in messages"
            :key="message.id"
            :message="message"
            :disabled="isGenerating"
            @edit="editAndResend(index, $event)"
            @regenerate="regenerate(index)"
            @delete="deleteMessage(index)"
          />
        </div>

        <button
          v-if="showScrollButton"
          type="button"
          class="sticky bottom-3 left-full mr-3 flex h-8 w-8 -translate-x-3 items-center justify-center rounded-[3px] border border-gray-200 bg-white text-gray-500 shadow-sm hover:text-primary-600 dark:border-dark-600 dark:bg-dark-800 dark:text-dark-300"
          :title="t('playground.actions.scrollBottom')"
          :aria-label="t('playground.actions.scrollBottom')"
          @click="scrollToBottom('smooth')"
        >
          <Icon name="arrowDown" size="sm" />
        </button>
      </div>

      <PlaygroundComposer
        v-model="draft"
        :model="config.model"
        :stream="config.stream"
        :image-mode="isImageMode"
        :image-size="config.imageSize"
        :image-quality="config.imageQuality"
        :image-format="config.imageFormat"
        :image-count="config.imageCount"
        :generating="isGenerating"
        :can-send="canSend"
        @submit="submit"
        @stop="stop"
        @open-parameters="showParameters = true"
      />
    </div>

    <PlaygroundParametersPanel v-model="config" :show="showParameters" :image-mode="isImageMode" @close="showParameters = false" />
    <PlaygroundRequestPreview :show="showPreview" :content="requestPreview" @close="showPreview = false" />
    <ConfirmDialog
      :show="showClearConfirm"
      :title="t('playground.clear.title')"
      :message="t('playground.clear.message')"
      :confirm-text="t('playground.actions.newConversation')"
      danger
      @confirm="confirmClear"
      @cancel="showClearConfirm = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import PlaygroundComposer from '@/components/playground/PlaygroundComposer.vue'
import PlaygroundMessage from '@/components/playground/PlaygroundMessage.vue'
import PlaygroundParametersPanel from '@/components/playground/PlaygroundParametersPanel.vue'
import PlaygroundRequestPreview from '@/components/playground/PlaygroundRequestPreview.vue'
import { isPlaygroundImageModel, usePlayground } from '@/composables/usePlayground'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()
const {
  config,
  messages,
  keys,
  keysTruncated,
  models,
  selectedKey,
  isImageMode,
  canSend,
  parameterErrors,
  isLoadingKeys,
  isLoadingModels,
  isGenerating,
  optionsError,
  storageWarning,
  requestPreview,
  loadKeys,
  selectKey,
  submit,
  stop,
  regenerate,
  editAndResend,
  deleteMessage,
  clearMessages,
} = usePlayground(authStore.user?.id || 0)

const draft = ref('')
const showParameters = ref(false)
const showPreview = ref(false)
const showClearConfirm = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
const followOutput = ref(true)
const showScrollButton = ref(false)

const keyOptions = computed(() => keys.value.map((key) => ({
  value: key.id,
  label: key.name || `#${key.id}`,
  group: key.group_name,
  disabled: key.status !== 'active' || key.group_id === null,
})))
const modelOptions = computed(() => models.value.map((model) => ({
  value: model.id,
  label: model.id,
  image: isPlaygroundImageModel(model.id),
})))
const enabledParameterCount = computed(() => isImageMode.value
  ? 4
  : Object.values(config.value.parameterEnabled).filter(Boolean).length)
const parameterTitle = computed(() => isImageMode.value
  ? t('playground.image.parametersTitle')
  : t('playground.parameters.title'))

const sessionStatus = computed(() => {
  if (isGenerating.value) return t('playground.status.generating')
  if (optionsError.value) return t('playground.status.error')
  return t('playground.status.ready')
})

function changeKey(value: string | number | boolean | null): void {
  const keyId = Number(value)
  if (Number.isSafeInteger(keyId) && keyId > 0) void selectKey(keyId)
}

function handleScroll(): void {
  const element = scrollRef.value
  if (!element) return
  const distance = element.scrollHeight - element.scrollTop - element.clientHeight
  followOutput.value = distance < 96
  showScrollButton.value = !followOutput.value
}

function scrollToBottom(behavior: 'auto' | 'smooth' = 'auto'): void {
  const element = scrollRef.value
  if (!element) return
  element.scrollTo({ top: element.scrollHeight, behavior })
  followOutput.value = true
  showScrollButton.value = false
}

function confirmClear(): void {
  clearMessages()
  showClearConfirm.value = false
}

watch(messages, async () => {
  if (!followOutput.value) return
  await nextTick()
  scrollToBottom()
}, { deep: true })

onMounted(async () => {
  await loadKeys()
  await nextTick()
  scrollToBottom()
})
</script>
