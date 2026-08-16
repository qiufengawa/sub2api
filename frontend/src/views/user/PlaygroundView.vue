<template>
  <AppLayout>
    <div class="playground-page">

      <UiAlert v-if="optionsError" tone="danger" :message="optionsError">
        <template #default>{{ optionsError }} <UiButton variant="quiet" density="dense" @click="loadKeys">{{ t('common.retry') }}</UiButton></template>
      </UiAlert>
      <UiAlert v-else-if="keysTruncated" tone="warning" :message="t('playground.notices.keysTruncated')" />
      <UiAlert v-else-if="storageWarning" tone="warning" :message="t('playground.notices.storageUnavailable')" />
      <UiAlert v-if="parameterErrors.length" tone="warning" :message="t('playground.errors.invalidParameters')" />

      <div ref="scrollRef" class="playground-scroll" @scroll="handleScroll">
        <div v-if="isLoadingKeys && keys.length === 0" class="playground-state">
          <UiSpinner size="md" />
        </div>

        <div v-else-if="keys.length === 0" class="playground-state">
          <Icon name="key" size="lg" class="playground-state__icon" />
          <p>{{ t('playground.empty.noKeys') }}</p>
          <UiButton to="/keys" variant="primary" density="compact">
            <template #icon><Icon name="plus" size="sm" /></template>
            {{ t('playground.empty.createKey') }}
          </UiButton>
        </div>

        <div v-else-if="messages.length === 0" class="playground-state">
          <span class="playground-state__icon-wrap"><Icon :name="isImageMode ? 'sparkles' : 'chat'" size="lg" /></span>
          <p>{{ isImageMode ? t('playground.image.empty') : t('playground.empty.conversation') }}</p>
        </div>

        <div v-else class="playground-messages">
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

        <UiIconButton
          v-if="showScrollButton"
          class="playground-scroll-button"
          icon="arrowDown"
          density="compact"
          variant="outlined"
          :label="t('playground.actions.scrollBottom')"
          @click="scrollToBottom('smooth')"
        />
      </div>

      <PlaygroundComposer
        v-model="draft"
        :key-id="config.keyId"
        :key-options="keyOptions"
        :model-options="modelOptions"
        :selected-key="selectedKey"
        :model="config.model"
        :stream="config.stream"
        :loading-keys="isLoadingKeys"
        :loading-models="isLoadingModels"
        :image-mode="isImageMode"
        :image-size="config.imageSize"
        :image-quality="config.imageQuality"
        :image-format="config.imageFormat"
        :image-count="config.imageCount"
        :generating="isGenerating"
        :can-send="canSend"
        :has-messages="messages.length > 0"
        :options-error="Boolean(optionsError)"
        :session-status="sessionStatus"
        :parameter-title="parameterTitle"
        :enabled-parameter-count="enabledParameterCount"
        @submit="submit"
        @stop="stop"
        @select-key="changeKey"
        @select-model="changeModel"
        @update-stream="changeStream"
        @open-parameters="showParameters = true"
        @open-preview="showPreview = true"
        @new-conversation="showClearConfirm = true"
      />
    </div>

    <PlaygroundParametersPanel v-model="config" :show="showParameters" :image-mode="isImageMode" @close="showParameters = false" />
    <PlaygroundRequestPreview :show="showPreview" :content="requestPreview" @close="showPreview = false" />
    <UiConfirmDialog
      :show="showClearConfirm"
      :title="t('playground.clear.title')"
      :message="t('playground.clear.message')"
      :confirm-text="t('playground.actions.newConversation')"
      :cancel-text="t('common.cancel')"
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
import Icon from '@/components/icons/Icon.vue'
import PlaygroundComposer from '@/components/playground/PlaygroundComposer.vue'
import PlaygroundMessage from '@/components/playground/PlaygroundMessage.vue'
import PlaygroundParametersPanel from '@/components/playground/PlaygroundParametersPanel.vue'
import PlaygroundRequestPreview from '@/components/playground/PlaygroundRequestPreview.vue'
import { isPlaygroundImageModel, usePlayground } from '@/composables/usePlayground'
import { useAuthStore } from '@/stores/auth'
import { UiAlert, UiButton, UiConfirmDialog, UiIconButton, UiSpinner } from '@/components/ui'

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
  platform: key.platform,
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

function changeModel(value: string): void {
  config.value.model = value
}

function changeStream(value: boolean): void {
  config.value.stream = value
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
  if (!followOutput.value) return
  scrollToBottom()
}, { deep: true })

onMounted(async () => {
  await loadKeys()
  await nextTick()
  scrollToBottom()
})
</script>

<style scoped>
.playground-page { display: flex; min-height: calc(100dvh - 7rem); min-width: 0; flex-direction: column; overflow: hidden; color: var(--ui-text); background: var(--ui-bg); }
.playground-page > .ui-alert { flex: 0 0 auto; margin: 0 12px 4px; }
.playground-scroll { position: relative; min-height: 0; min-width: 0; flex: 1 1 auto; overflow: auto; background: var(--ui-bg); }
.playground-state { display: flex; min-height: 260px; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; color: var(--ui-text-muted); text-align: center; }
.playground-state p { margin: 0; font-size: 13px; }
.playground-state__icon { color: var(--ui-text-soft); }
.playground-state__icon-wrap { display: grid; width: 40px; height: 40px; place-items: center; border: 1px solid var(--ui-border); border-radius: var(--ui-radius); color: var(--ui-info); background: var(--ui-surface-muted); }
.playground-messages { width: min(100%, 960px); margin: 0 auto; padding: 8px 16px 20px; }
.playground-scroll-button { position: sticky; right: 16px; bottom: 16px; z-index: 2; display: flex; margin: -48px 16px 16px auto; }
@media (max-width: 640px) { .playground-page { min-height: calc(100dvh - 5.5rem); } .playground-messages { padding-inline: 10px; } }
</style>
