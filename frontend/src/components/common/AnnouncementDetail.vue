<template>
  <div class="min-w-0">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-dark-400">
      <span class="inline-flex items-center gap-1.5">
        <Icon name="clock" size="sm" aria-hidden="true" />
        <time :datetime="announcement.created_at">{{ formatRelativeWithDateTime(announcement.created_at) }}</time>
      </span>
      <span v-if="readState" class="inline-flex items-center gap-1.5">
        <Icon name="eye" size="sm" aria-hidden="true" />
        {{ readState === 'read' ? t('announcements.read') : t('announcements.unread') }}
      </span>
    </div>

    <div class="mt-4 border-l-2 border-primary-500 pl-3 sm:pl-4">
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
