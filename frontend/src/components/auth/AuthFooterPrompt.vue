<template>
  <p class="auth-footer-prompt">
    <span>{{ text }}</span>
    <UiLink :to="to">{{ linkText }}</UiLink>
  </p>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { UiLink } from '@/components/ui'

defineProps<{
  text: string
  linkText: string
  to: RouteLocationRaw
}>()
</script>

<style scoped>
.auth-footer-prompt {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: 20px;
}
</style>
