<template>
  <UiDropdownMenu
    :items="menuItems"
    placement="bottom-end"
    @select="selectLocale"
  >
    <template #trigger="{ open }">
      <UiIconButton
        v-if="compact"
        icon="globe"
        variant="ghost"
        density="compact"
        :disabled="switching"
        :label="triggerLabel"
        aria-haspopup="menu"
        :aria-expanded="open"
      />
      <UiButton
        v-else
        variant="quiet"
        density="compact"
        :disabled="switching"
        :aria-label="triggerLabel"
        aria-haspopup="menu"
        :aria-expanded="open"
      >
        <template #icon><Icon name="globe" size="sm" /></template>
        {{ currentLocale?.code.toUpperCase() }}
      </UiButton>
    </template>
  </UiDropdownMenu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { availableLocales, setLocale } from '@/i18n'
import Icon from '@/components/icons/Icon.vue'
import {
  UiButton,
  UiDropdownMenu,
  UiIconButton,
  type UiMenuItem,
} from '@/components/ui'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { locale } = useI18n()
const switching = ref(false)
const currentLocale = computed(() => availableLocales.find(item => item.code === locale.value))
const triggerLabel = computed(() => currentLocale.value?.name || locale.value)
const menuItems = computed<UiMenuItem[]>(() => availableLocales.map(item => ({
  key: item.code,
  label: item.name,
  icon: item.code === locale.value ? 'check' : 'globe',
  disabled: switching.value,
})))

async function selectLocale(item: UiMenuItem) {
  if (switching.value || item.key === locale.value) return
  switching.value = true
  try {
    await setLocale(item.key)
  } finally {
    switching.value = false
  }
}
</script>
