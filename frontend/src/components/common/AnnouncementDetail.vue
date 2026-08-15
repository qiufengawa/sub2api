<template>
  <div class="announcement-detail">
    <div class="announcement-detail__meta">
      <span>
        <Icon name="clock" size="sm" aria-hidden="true" />
        <time :datetime="announcement.created_at">{{ formatRelativeWithDateTime(announcement.created_at) }}</time>
      </span>
      <span v-if="readState">
        <Icon name="eye" size="sm" aria-hidden="true" />
        {{ readState === 'read' ? t('announcements.read') : t('announcements.unread') }}
      </span>
    </div>

    <div class="announcement-detail__content">
      <div
        class="markdown-body prose prose-sm max-w-none break-words dark:prose-invert"
        v-html="renderedContent"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import Icon from '@/components/icons/Icon.vue'
import { formatRelativeWithDateTime } from '@/utils/format'
import type { Announcement, UserAnnouncement } from '@/types'
import '@/styles/announcement-markdown.css'

type AnnouncementContent = Pick<Announcement | UserAnnouncement, 'content' | 'created_at'>

const props = defineProps<{
  announcement: AnnouncementContent
  readState?: 'read' | 'unread'
}>()

const { t } = useI18n()

marked.setOptions({
  breaks: true,
  gfm: true,
})

const renderedContent = computed(() => {
  const html = marked.parse(props.announcement.content || '') as string
  return DOMPurify.sanitize(html)
})
</script>

<style scoped>
.announcement-detail { min-width: 0; }
.announcement-detail__meta { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--ui-text-soft); font-size: 12px; }
.announcement-detail__meta span { display: inline-flex; align-items: center; gap: 6px; }
.announcement-detail__content { margin-top: 14px; }
</style>
