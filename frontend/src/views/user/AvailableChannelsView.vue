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
            :disabled="loading && channels.length === 0"
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
          v-if="loadError && channels.length === 0 && !loading"
          :title="t('common.error')"
          :description="loadError"
          :retry-text="t('common.retry')"
          @retry="loadChannels"
        />
        <AvailableChannelsTable
          v-else
          :columns="columnLabels"
          :rows="filteredChannels"
          :loading="loading"
          :user-group-rates="userGroupRates"
          pricing-key-prefix="availableChannels.pricing"
          :no-pricing-label="t('availableChannels.noPricing')"
          :no-models-label="t('availableChannels.noModels')"
          :empty-label="t('availableChannels.empty')"
        />
      </AppSection>
    </AppPage>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AvailableChannelsTable from '@/components/channels/AvailableChannelsTable.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import {
  AppPage,
  AppPageHeader,
  AppSection,
  UiBadge,
  UiErrorState,
  UiIconButton,
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
  loading.value = true
  loadError.value = ''
  try {
    const [list, rates] = await Promise.all([
      userChannelsAPI.getAvailable(),
      userGroupsAPI.getUserGroupRates().catch((error: unknown) => {
        console.error('Failed to load user group rates:', error)
        return {} as Record<number, number>
      })
    ])
    channels.value = list
    userGroupRates.value = rates
  } catch (error: unknown) {
    loadError.value = extractApiErrorMessage(error, t('common.error'))
    appStore.showError(loadError.value)
  } finally {
    loading.value = false
  }
}

onMounted(loadChannels)
</script>

<style scoped>
.available-channels-search {
  width: min(100%, 360px);
}
</style>
