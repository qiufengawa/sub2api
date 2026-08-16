<template>
  <AppLayout>
    <AppPage width="full" density="compact">
      <AppPageHeader
        :title="t('availableChannels.title')"
        :description="t('availableChannels.description')"
      />

      <AppSection>
        <UiTableToolbar>
          <UiSearchInput
            v-model="searchQuery"
            class="available-channels-search"
            density="compact"
            :placeholder="t('availableChannels.searchPlaceholder')"
            :aria-label="t('availableChannels.searchPlaceholder')"
            :disabled="initialLoading"
          />
          <template #actions>
            <UiBadge data-testid="available-channel-count">
              {{ t('availableChannels.resultCount', { count: filteredChannels.length }) }}
            </UiBadge>
            <UiIconButton
              icon="refresh"
              density="compact"
              :label="t('common.refresh')"
              :disabled="loading"
              @click="loadChannels"
            />
          </template>
        </UiTableToolbar>

        <UiErrorState
          v-if="loadError && channels.length === 0 && !initialLoading"
          :title="t('common.error')"
          :description="loadError"
          :retry-text="t('common.retry')"
          @retry="loadChannels"
        />
        <AppStack v-else :gap="12">
          <UiAlert v-if="loadError" tone="danger" :message="loadError" />
          <UiLoadingOverlay :show="refreshing" :label="t('common.loading')">
            <AvailableChannelsTable
              :columns="columnLabels"
              :rows="filteredChannels"
              :loading="initialLoading"
              :user-group-rates="userGroupRates"
              pricing-key-prefix="availableChannels.pricing"
              :no-pricing-label="t('availableChannels.noPricing')"
              :no-models-label="t('availableChannels.noModels')"
              :empty-label="t('availableChannels.empty')"
            />
          </UiLoadingOverlay>
        </AppStack>
      </AppSection>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AvailableChannelsTable from '@/components/channels/AvailableChannelsTable.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  AppStack,
  UiAlert,
  UiBadge,
  UiErrorState,
  UiIconButton,
  UiLoadingOverlay,
  UiSearchInput,
  UiTableToolbar
} from '@/components/ui'
import userChannelsAPI, { type UserAvailableChannel } from '@/api/channels'
import userGroupsAPI from '@/api/groups'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'

const { t } = useI18n()
const appStore = useAppStore()

const channels = ref<UserAvailableChannel[]>([])
const userGroupRates = ref<Record<number, number>>({})
const loading = ref(false)
const loadError = ref('')
const searchQuery = ref('')
const initialLoading = computed(() => loading.value && channels.value.length === 0)
const refreshing = computed(() => loading.value && channels.value.length > 0)

let requestController: AbortController | null = null
let requestSequence = 0

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const requestError = error as { name?: string; code?: string }
  return requestError.name === 'AbortError' || requestError.code === 'ERR_CANCELED'
}

const columnLabels = computed(() => ({
  channelInfo: t('availableChannels.columns.channelInfo'),
  name: t('availableChannels.columns.name'),
  description: t('availableChannels.columns.description'),
  platform: t('availableChannels.columns.platform'),
  groups: t('availableChannels.columns.groups'),
  supportedModels: t('availableChannels.columns.supportedModels')
}))

const filteredChannels = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return channels.value

  return channels.value
    .map((channel) => {
      const nameMatches = channel.name.toLowerCase().includes(query)
      const descriptionMatches = (channel.description || '').toLowerCase().includes(query)
      if (nameMatches || descriptionMatches) return channel

      const matchingPlatforms = channel.platforms.filter(
        (platform) =>
          platform.platform.toLowerCase().includes(query) ||
          platform.groups.some((group) => group.name.toLowerCase().includes(query)) ||
          platform.supported_models.some((model) => model.name.toLowerCase().includes(query))
      )
      if (matchingPlatforms.length === 0) return null
      return { ...channel, platforms: matchingPlatforms }
    })
    .filter((channel): channel is UserAvailableChannel => channel !== null)
})

async function loadChannels(): Promise<void> {
  requestController?.abort()
  const controller = new AbortController()
  const sequence = ++requestSequence
  requestController = controller
  loading.value = true
  loadError.value = ''
  const fallbackRates = userGroupRates.value
  try {
    const [list, rates] = await Promise.all([
      userChannelsAPI.getAvailable({ signal: controller.signal }),
      userGroupsAPI.getUserGroupRates({ signal: controller.signal }).catch((error: unknown) => {
        if (isAbortError(error)) throw error
        console.error('Failed to load user group rates:', error)
        return fallbackRates
      })
    ])
    if (controller.signal.aborted || sequence !== requestSequence) return
    channels.value = list
    userGroupRates.value = rates
  } catch (error: unknown) {
    if (controller.signal.aborted || sequence !== requestSequence || isAbortError(error)) return
    loadError.value = extractApiErrorMessage(error, t('common.error'))
    appStore.showError(loadError.value)
  } finally {
    if (requestController === controller) {
      loading.value = false
      requestController = null
    }
  }
}

onMounted(loadChannels)
onBeforeUnmount(() => {
  requestSequence += 1
  requestController?.abort()
  requestController = null
})
</script>

<style scoped>
.available-channels-search {
  width: min(100%, 360px);
}
</style>
