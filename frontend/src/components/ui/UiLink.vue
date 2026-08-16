<template>
  <RouterLink
    v-if="to"
    :to="to"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
    class="ui-link ui-focus-ring"
    :class="`ui-link--${variant}`"
  >
    <slot />
    <Icon v-if="external" name="externalLink" size="xs" />
  </RouterLink>
  <a
    v-else
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
    class="ui-link ui-focus-ring"
    :class="`ui-link--${variant}`"
  >
    <slot />
    <Icon v-if="external" name="externalLink" size="xs" />
  </a>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'

withDefaults(defineProps<{
  to?: RouteLocationRaw
  href?: string
  external?: boolean
  variant?: 'inline' | 'standalone' | 'muted' | 'brand'
}>(), {
  variant: 'inline',
})
</script>

<style scoped>
.ui-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ui-text);
  font-size: inherit;
  font-weight: 600;
  text-decoration-line: underline;
  text-decoration-color: var(--ui-border);
  text-underline-offset: 3px;
}

.ui-link:hover {
  text-decoration-color: currentColor;
}

.ui-link--muted {
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 500;
}

.ui-link--brand {
  text-decoration: none;
}

.ui-link--standalone {
  font-size: 13px;
}
</style>
