<template>
  <dl class="grid grid-cols-2 gap-x-4 gap-y-1 border-y border-gray-100 py-2 md:border-y-0 md:py-0 dark:border-dark-700/60">
    <div class="min-w-0">
      <dt class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        <Icon :name="primaryIcon" size="xs" />
        <span>{{ primaryLabel }}</span>
      </dt>
      <dd class="mt-1 font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {{ primaryValue }}<span class="ml-0.5 text-[10px] font-normal text-gray-400">{{ primaryUnit }}</span>
      </dd>
    </div>
    <div class="min-w-0">
      <dt class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        <Icon :name="secondaryIcon" size="xs" />
        <span>{{ secondaryLabel }}</span>
      </dt>
      <dd class="mt-1 font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {{ secondaryValue }}<span class="ml-0.5 text-[10px] font-normal text-gray-400">{{ secondaryUnit }}</span>
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
