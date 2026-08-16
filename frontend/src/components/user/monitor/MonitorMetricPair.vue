<template>
  <dl class="monitor-metric-pair">
    <div>
      <dt>
        <Icon :name="primaryIcon" size="xs" />
        <span>{{ primaryLabel }}</span>
      </dt>
      <dd class="ui-numeric">
        {{ primaryValue }}<span>{{ primaryUnit }}</span>
      </dd>
    </div>
    <div>
      <dt>
        <Icon :name="secondaryIcon" size="xs" />
        <span>{{ secondaryLabel }}</span>
      </dt>
      <dd class="ui-numeric">
        {{ secondaryValue }}<span>{{ secondaryUnit }}</span>
      </dd>
    </div>
  </dl>
</template>

<script setup lang="ts">
import Icon from '@/components/icons/Icon.vue'

defineProps<{
  primaryLabel: string
  primaryValue: string
  primaryUnit: string
  primaryIcon: 'bolt' | 'globe' | 'clock' | 'link'
  secondaryLabel: string
  secondaryValue: string
  secondaryUnit: string
  secondaryIcon: 'bolt' | 'globe' | 'clock' | 'link'
}>()
</script>

<style scoped>
.monitor-metric-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 0; }
.monitor-metric-pair > div { min-width: 0; }
.monitor-metric-pair dt { display: flex; align-items: center; gap: 5px; color: var(--ui-text-soft); font-size: 10px; font-weight: 600; }
.monitor-metric-pair dd { margin: 4px 0 0; color: var(--ui-text); font-size: 13px; font-weight: 600; }
.monitor-metric-pair dd span { margin-left: 2px; color: var(--ui-text-soft); font-size: 10px; font-weight: 400; }
</style>
