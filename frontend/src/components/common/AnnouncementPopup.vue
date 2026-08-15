<template>
  <UiDialog
    :show="Boolean(displayedAnnouncement)"
    :title="displayedAnnouncement?.title || t('announcements.title')"
    width="normal"
    :z-index="120"
    :close-on-escape="true"
    :show-close-button="preview"
    @close="handleDismiss"
  >
    <AnnouncementDetail
      v-if="displayedAnnouncement"
      :announcement="displayedAnnouncement"
      :read-state="preview ? undefined : 'unread'"
    />

    <template #footer>
      <UiButton
        type="button"
        data-testid="announcement-popup-dismiss"
        variant="primary"
        density="compact"
        @click="handleDismiss"
      >
        <template #icon><Icon :name="preview ? 'x' : 'check'" size="sm" /></template>
        {{ preview ? t('common.close') : t('announcements.markRead') }}
      </UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnnouncementStore } from '@/stores/announcements'
import type { Announcement, UserAnnouncement } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import { UiButton, UiDialog } from '@/components/ui'
import AnnouncementDetail from '@/components/common/AnnouncementDetail.vue'

type PreviewAnnouncement = Pick<Announcement | UserAnnouncement, 'title' | 'content' | 'created_at'>

const props = withDefaults(defineProps<{
  announcement?: PreviewAnnouncement | null
  preview?: boolean
}>(), {
  announcement: null,
  preview: false,
})

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const announcementStore = useAnnouncementStore()
const displayedAnnouncement = computed(() => (
  props.preview ? props.announcement : announcementStore.currentPopup
))

function handleDismiss() {
  if (props.preview) {
    emit('close')
    return
  }
  void announcementStore.dismissPopup()
}
</script>
