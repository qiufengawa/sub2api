<template>
  <div class="legal-prose" v-html="html" />
</template>

<script setup lang="ts">
defineProps<{ html: string }>()
</script>

<style scoped>
.legal-prose {
  min-width: 0;
  color: var(--ui-text);
  font-size: 14px;
  line-height: 1.78;
  overflow-wrap: anywhere;
}

.legal-prose :deep(h1),
.legal-prose :deep(h2),
.legal-prose :deep(h3),
.legal-prose :deep(h4) {
  color: var(--ui-text);
  letter-spacing: 0;
  scroll-margin-top: 24px;
}

.legal-prose :deep(h1) {
  margin: 0 0 24px;
  font-size: 24px;
  line-height: 34px;
}

.legal-prose :deep(h2) {
  margin: 36px 0 12px;
  padding-top: 4px;
  border-top: 1px solid var(--ui-border-soft);
  font-size: 19px;
  line-height: 28px;
}

.legal-prose :deep(h3) {
  margin: 28px 0 10px;
  font-size: 16px;
  line-height: 24px;
}

.legal-prose :deep(h4) {
  margin: 22px 0 8px;
  font-size: 14px;
  line-height: 22px;
}

.legal-prose :deep(p),
.legal-prose :deep(ul),
.legal-prose :deep(ol),
.legal-prose :deep(blockquote),
.legal-prose :deep(pre),
.legal-prose :deep(table) {
  margin: 0 0 18px;
}

.legal-prose :deep(ul),
.legal-prose :deep(ol) {
  padding-left: 22px;
}

.legal-prose :deep(li + li) {
  margin-top: 5px;
}

.legal-prose :deep(a) {
  color: var(--ui-text);
  font-weight: 600;
  text-decoration-color: var(--ui-border);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.legal-prose :deep(a:hover) {
  text-decoration-color: currentColor;
}

.legal-prose :deep(blockquote) {
  padding: 10px 14px;
  border-left: 2px solid var(--ui-text);
  color: var(--ui-text-muted);
  background: var(--ui-surface-muted);
}

.legal-prose :deep(code) {
  border-radius: var(--ui-radius-dense);
  padding: 2px 5px;
  background: var(--ui-surface-strong);
  font-family: var(--ui-font-mono);
  font-size: 12px;
}

.legal-prose :deep(pre) {
  overflow-x: auto;
  padding: 14px 16px;
  border: 1px solid var(--ui-border);
  border-radius: var(--ui-radius);
  color: var(--ui-text);
  background: var(--ui-surface);
}

.legal-prose :deep(pre code) {
  padding: 0;
  background: transparent;
}

.legal-prose :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  white-space: nowrap;
}

.legal-prose :deep(th),
.legal-prose :deep(td) {
  padding: 8px 10px;
  border: 1px solid var(--ui-border);
  text-align: left;
}

.legal-prose :deep(th) {
  background: var(--ui-surface-muted);
  font-size: 12px;
  font-weight: 600;
}

.legal-prose :deep(img) {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  margin: 20px auto;
  border-radius: var(--ui-radius);
}

.legal-prose :deep(hr) {
  margin: 28px 0;
  border: 0;
  border-top: 1px solid var(--ui-border-soft);
}

@media (max-width: 640px) {
  .legal-prose {
    font-size: 13px;
    line-height: 1.72;
  }

  .legal-prose :deep(h1) {
    font-size: 21px;
    line-height: 30px;
  }

  .legal-prose :deep(h2) {
    font-size: 17px;
    line-height: 26px;
  }
}
</style>
