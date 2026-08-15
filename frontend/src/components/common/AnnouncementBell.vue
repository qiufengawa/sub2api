<template>
  <div>
    <UiNotificationDot :count="unreadCount" dot>
      <UiIconButton
        icon="bell"
        variant="ghost"
        density="compact"
        :label="t('announcements.title')"
        :aria-expanded="isModalOpen"
        @click="openModal"
      />
    </UiNotificationDot>

    <UiDialog
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

      <div v-else class="announcement-center">
        <div
          v-if="unreadCount > 0"
          class="announcement-center__summary"
        >
          <p>
            {{ t('announcements.newCount', { count: unreadCount }) }}
          </p>
          <UiButton
            variant="quiet"
            density="dense"
            :disabled="loading"
            @click="markAllAsRead"
          >
            {{ t('announcements.markAllRead') }}
          </UiButton>
        </div>

        <div v-if="loading" class="announcement-center__loading">
          <UiSpinner size="lg" :label="t('common.loading')" />
        </div>

        <div v-else-if="announcements.length > 0" class="announcement-center__list">
          <button
            v-for="item in announcements"
            :key="item.id"
            type="button"
            class="announcement-center__item ui-focus-ring"
            @click="openDetail(item)"
          >
            <span class="announcement-center__copy">
              <span class="announcement-center__title">
                <span
                  v-if="!item.read_at"
                  class="announcement-center__unread"
                  aria-hidden="true"
                ></span>
                <span :title="item.title">
                  {{ item.title }}
                </span>
              </span>
              <span class="announcement-center__excerpt">
                {{ item.content }}
              </span>
              <time :datetime="item.created_at" class="announcement-center__time ui-numeric">
                {{ formatRelativeTime(item.created_at) }}
              </time>
            </span>
            <Icon
              name="chevronRight"
              size="sm"
              class="announcement-center__chevron"
              aria-hidden="true"
            />
          </button>
        </div>

        <UiEmptyState v-else :title="t('announcements.empty')" :description="t('announcements.emptyDescription')" />
      </div>

      <template #footer>
        <div class="announcement-center__footer">
          <UiButton
            v-if="selectedAnnouncement"
            type="button"
            density="compact"
            @click="selectedAnnouncement = null"
          >
            <template #icon><Icon name="chevronLeft" size="sm" /></template>
            {{ t('common.back') }}
          </UiButton>
          <UiButton type="button" variant="primary" density="compact" @click="closeModal">
            {{ t('common.close') }}
          </UiButton>
        </div>
      </template>
    </UiDialog>
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
import AnnouncementDetail from '@/components/common/AnnouncementDetail.vue'
import {
  UiButton,
  UiDialog,
  UiEmptyState,
  UiIconButton,
  UiNotificationDot,
  UiSpinner,
} from '@/components/ui'

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

<style scoped>
.announcement-center { margin: -8px -4px; }
.announcement-center__summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--ui-border-soft); }
.announcement-center__summary p { margin: 0; color: var(--ui-text-soft); font-size: 12px; }
.announcement-center__loading { display: grid; min-height: 160px; place-items: center; }
.announcement-center__list { display: grid; }
.announcement-center__item { display: grid; width: 100%; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 12px; padding: 11px 12px; border: 0; border-bottom: 1px solid var(--ui-border-soft); color: var(--ui-text); background: transparent; text-align: left; cursor: pointer; transition: background var(--ui-motion-fast); }
.announcement-center__item:hover { background: var(--ui-surface-muted); }
.announcement-center__copy { min-width: 0; }
.announcement-center__title { display: flex; min-width: 0; align-items: center; gap: 7px; }
.announcement-center__title > span:last-child { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.announcement-center__unread { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--ui-info); }
.announcement-center__excerpt { display: -webkit-box; margin-top: 4px; overflow: hidden; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.announcement-center__time { display: block; margin-top: 4px; color: var(--ui-text-soft); font-size: 10px; }
.announcement-center__chevron { margin-top: 2px; color: var(--ui-text-soft); }
.announcement-center__footer { display: flex; width: 100%; justify-content: flex-end; gap: 8px; }
@media (max-width: 640px) {
  .announcement-center__footer { flex-direction: column-reverse; }
  .announcement-center__footer :deep(.ui-button) { width: 100%; }
}
</style>
