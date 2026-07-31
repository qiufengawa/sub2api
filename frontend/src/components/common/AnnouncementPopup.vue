<template>
  <BaseDialog
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
      <button
        type="button"
        data-testid="announcement-popup-dismiss"
        class="btn btn-primary btn-sm w-full sm:w-auto"
        @click="handleDismiss"
      >
        <Icon :name="preview ? 'x' : 'check'" size="sm" />
        {{ preview ? t('common.close') : t('announcements.markRead') }}
      </button>
    </template>
  </BaseDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnnouncementStore } from '@/stores/announcements'
import type { Announcement, UserAnnouncement } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
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
