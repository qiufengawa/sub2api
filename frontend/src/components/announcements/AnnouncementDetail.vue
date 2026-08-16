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

    <div class="announcement-prose" v-html="renderedContent" />
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
  const html = DOMPurify.sanitize(marked.parse(props.announcement.content || '') as string)
  const container = document.createElement('div')
  container.innerHTML = html
  container.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    if (/^https?:\/\//i.test(href)) {
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
    }
  })
  return container.innerHTML
})
</script>

<style scoped>
.announcement-detail {
  min-width: 0;
}

.announcement-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--ui-text-soft);
  font-size: 12px;
}

.announcement-detail__meta span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.announcement-prose {
  min-width: 0;
  margin-top: 14px;
  color: var(--ui-text-muted);
  font-size: 14px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.announcement-prose :deep(h1),
.announcement-prose :deep(h2),
.announcement-prose :deep(h3),
.announcement-prose :deep(h4) {
  color: var(--ui-text);
  letter-spacing: 0;
}

.announcement-prose :deep(h1) {
  margin: 28px 0 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ui-border-soft);
  font-size: 22px;
  line-height: 30px;
}

.announcement-prose :deep(h2) {
  margin: 26px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ui-border-soft);
  font-size: 18px;
  line-height: 27px;
}

.announcement-prose :deep(h3) {
  margin: 22px 0 10px;
  font-size: 16px;
  line-height: 24px;
}

.announcement-prose :deep(h4) {
  margin: 20px 0 8px;
  font-size: 14px;
  line-height: 22px;
}

.announcement-prose :deep(p),
.announcement-prose :deep(ul),
.announcement-prose :deep(ol),
.announcement-prose :deep(blockquote),
.announcement-prose :deep(pre),
.announcement-prose :deep(table) {
  margin: 0 0 16px;
}

.announcement-prose :deep(ul),
.announcement-prose :deep(ol) {
  padding-left: 22px;
}

.announcement-prose :deep(li + li) {
  margin-top: 5px;
}

.announcement-prose :deep(a) {
  color: var(--ui-text);
  font-weight: 600;
  text-decoration-color: var(--ui-border);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.announcement-prose :deep(a:hover) {
  text-decoration-color: currentColor;
}

.announcement-prose :deep(blockquote) {
  padding: 10px 14px;
  border-left: 2px solid var(--ui-text);
  color: var(--ui-text-muted);
  background: var(--ui-surface-muted);
}

.announcement-prose :deep(code) {
  padding: 2px 5px;
  border-radius: var(--ui-radius-dense);
  background: var(--ui-surface-strong);
  font-family: var(--ui-font-mono);
  font-size: 12px;
}

.announcement-prose :deep(pre) {
  overflow-x: auto;
  padding: 14px 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  color: var(--ui-text);
  background: var(--ui-surface);
}

.announcement-prose :deep(pre code) {
  padding: 0;
  background: transparent;
}

.announcement-prose :deep(hr) {
  margin: 24px 0;
  border: 0;
  border-top: 1px solid var(--ui-border-soft);
}

.announcement-prose :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  white-space: nowrap;
}

.announcement-prose :deep(th),
.announcement-prose :deep(td) {
  padding: 8px 10px;
  border: 1px solid var(--ui-border);
  text-align: left;
}

.announcement-prose :deep(th) {
  color: var(--ui-text);
  background: var(--ui-surface-muted);
  font-size: 12px;
  font-weight: 600;
}

.announcement-prose :deep(img) {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  margin: 18px auto;
  border-radius: var(--ui-radius);
}

.announcement-prose :deep(strong) {
  color: var(--ui-text);
  font-weight: 600;
}
</style>
