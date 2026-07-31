<template>
  <div>
    <button
      type="button"
      class="relative flex h-8 w-8 items-center justify-center rounded-[3px] text-gray-600 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 dark:text-gray-400 dark:hover:bg-dark-800"
      :class="{ 'text-primary-600 dark:text-primary-400': unreadCount > 0 }"
      :aria-label="t('announcements.title')"
      :aria-expanded="isModalOpen"
      @click="openModal"
    >
      <Icon name="bell" size="md" />
      <span v-if="unreadCount > 0" class="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"></span>
    </button>

    <BaseDialog
      :show="isModalOpen"
      :title="dialogTitle"
      :width="selectedAnnouncement ? 'wide' : 'normal'"
      :z-index="100"
      @close="closeModal"
    >
      <AnnouncementDetail
        v-if="selectedAnnouncement"
        :announcement="selectedAnnouncement"
        :read-state="selectedAnnouncement.read_at ? 'read' : 'unread'"
      />

      <div v-else class="-mx-4 -my-3 sm:-mx-4">
        <div
          v-if="unreadCount > 0"
          class="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 dark:border-dark-700"
        >
          <p class="text-xs text-gray-500 dark:text-dark-400">
            {{ t('announcements.newCount', { count: unreadCount }) }}
          </p>
          <button
            type="button"
            class="btn btn-ghost btn-sm shrink-0"
            :disabled="loading"
            @click="markAllAsRead"
          >
            {{ t('announcements.markAllRead') }}
          </button>
        </div>

        <div v-if="loading" class="flex min-h-40 items-center justify-center" role="status">
          <span class="spinner h-6 w-6 text-primary-600" aria-hidden="true"></span>
          <span class="sr-only">{{ t('common.loading') }}</span>
        </div>

        <div v-else-if="announcements.length > 0" class="divide-y divide-gray-100 dark:divide-dark-700">
          <button
            v-for="item in announcements"
            :key="item.id"
            type="button"
            class="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/30 dark:hover:bg-dark-700/50"
            @click="openDetail(item)"
          >
            <span class="min-w-0">
              <span class="flex min-w-0 items-center gap-2">
                <span
                  v-if="!item.read_at"
                  class="h-2 w-2 shrink-0 rounded-full bg-primary-500"
                  aria-hidden="true"
                ></span>
                <span class="truncate text-sm font-medium text-gray-900 dark:text-white" :title="item.title">
                  {{ item.title }}
                </span>
              </span>
              <span class="mt-1 line-clamp-2 block text-xs leading-5 text-gray-500 dark:text-dark-400">
                {{ item.content }}
              </span>
              <time :datetime="item.created_at" class="mt-1 block text-[11px] text-gray-400 dark:text-dark-500">
                {{ formatRelativeTime(item.created_at) }}
              </time>
            </span>
            <Icon
              name="chevronRight"
              size="sm"
              class="mt-1 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
              aria-hidden="true"
            />
          </button>
        </div>

        <div v-else class="flex min-h-48 flex-col items-center justify-center px-4 py-8 text-center">
          <Icon name="inbox" size="xl" class="mb-3 text-gray-300 dark:text-dark-600" aria-hidden="true" />
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('announcements.empty') }}</p>
          <p class="mt-1 max-w-sm text-xs text-gray-500 dark:text-dark-400">
            {{ t('announcements.emptyDescription') }}
          </p>
        </div>
      </div>

      <template #footer>
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            v-if="selectedAnnouncement"
            type="button"
            class="btn btn-secondary btn-sm w-full sm:w-auto"
            @click="selectedAnnouncement = null"
          >
            <Icon name="chevronLeft" size="sm" />
            {{ t('common.back') }}
          </button>
          <button type="button" class="btn btn-primary btn-sm w-full sm:w-auto" @click="closeModal">
            {{ t('common.close') }}
          </button>
        </div>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useAppStore } from '@/stores/app'
import { useAnnouncementStore } from '@/stores/announcements'
import { formatRelativeTime } from '@/utils/format'
import type { UserAnnouncement } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import AnnouncementDetail from '@/components/common/AnnouncementDetail.vue'

const { t } = useI18n()
const appStore = useAppStore()
const announcementStore = useAnnouncementStore()
const { announcements, loading } = storeToRefs(announcementStore)

const isModalOpen = ref(false)
const selectedAnnouncement = ref<UserAnnouncement | null>(null)
const unreadCount = computed(() => announcementStore.unreadCount)
const dialogTitle = computed(() => selectedAnnouncement.value?.title || t('announcements.title'))

function openModal() {
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
  selectedAnnouncement.value = null
}

function openDetail(announcement: UserAnnouncement) {
  selectedAnnouncement.value = announcement
  if (!announcement.read_at) void markAsRead(announcement.id)
}

async function markAsRead(id: number) {
  try {
    await announcementStore.markAsRead(id)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : t('common.unknownError')
    appStore.showError(message)
  }
}

async function markAllAsRead() {
  try {
    await announcementStore.markAllAsRead()
    appStore.showSuccess(t('announcements.allMarkedAsRead'))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : t('common.unknownError')
    appStore.showError(message)
  }
}
</script>
