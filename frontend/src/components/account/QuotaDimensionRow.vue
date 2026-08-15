<template>
  <AppStack :gap="6" class="quota-dimension">
    <AppGrid min="180px" :gap="8">
      <UiTextField
        :model-value="limit ?? ''"
        type="number"
        density="dense"
        :label="label"
        :placeholder="t('admin.accounts.quotaLimitPlaceholder')"
        :min="0"
        :step="0.01"
        @update:model-value="updateLimit"
      >
        <template #prefix>$</template>
      </UiTextField>
      <QuotaNotifyToggle
        v-if="quotaNotifyGlobalEnabled && limit && limit > 0"
        :enabled="notifyEnabled"
        :threshold="notifyThreshold"
        :threshold-type="notifyThresholdType"
        @update:enabled="emit('update:notifyEnabled', $event)"
        @update:threshold="emit('update:notifyThreshold', $event)"
        @update:threshold-type="emit('update:notifyThresholdType', $event)"
      />
    </AppGrid>

    <template v-if="hasResetMode">
      <AppGrid min="140px" :gap="8" class="quota-dimension__reset-grid">
        <UiSelect
          :model-value="resetMode || 'rolling'"
          :options="resetModeOptions"
          density="dense"
          :label="t('admin.accounts.quotaResetMode')"
          @update:model-value="updateResetMode"
        />
        <UiSelect
          v-if="resetMode === 'fixed' && dim === 'weekly'"
          :model-value="resetDay ?? 1"
          :options="daySelectOptions"
          density="dense"
          :label="t('admin.accounts.quotaWeeklyResetDay')"
          @update:model-value="emit('update:resetDay', Number($event))"
        />
        <UiSelect
          v-if="resetMode === 'fixed'"
          :model-value="resetHour ?? 0"
          :options="hourSelectOptions"
          density="dense"
          :label="t('admin.accounts.quotaResetHour')"
          @update:model-value="emit('update:resetHour', Number($event))"
        />
        <UiSelect
          v-if="resetMode === 'fixed' && timezoneOptions?.length"
          :model-value="resetTimezone || 'UTC'"
          :options="timezoneSelectOptions"
          density="dense"
          :label="t('admin.accounts.quotaResetTimezone')"
          @update:model-value="emit('update:resetTimezone', String($event))"
        />
      </AppGrid>
      <p class="quota-dimension__hint">{{ resetMode === 'fixed' ? hintFixed : hintRolling }}</p>
    </template>
    <p v-else class="quota-dimension__hint">{{ hintRolling }}</p>
  </AppStack>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppGrid, AppStack, UiSelect, UiTextField } from '@/components/ui'
import QuotaNotifyToggle from './QuotaNotifyToggle.vue'
import type { QuotaThresholdType, QuotaResetMode } from '@/constants/account'

const { t } = useI18n()
const props = defineProps<{
  dim: 'daily' | 'weekly' | 'total'
  label: string
  limit: number | null
  quotaNotifyGlobalEnabled: boolean
  notifyEnabled: boolean | null
  notifyThreshold: number | null
  notifyThresholdType: QuotaThresholdType | null
  resetMode: QuotaResetMode | null
  resetHour: number | null
  resetDay: number | null
  resetTimezone: string | null
  hintRolling: string
  hintFixed: string
  hourOptions: number[]
  dayOptions: { value: number; key: string }[]
  timezoneOptions?: string[]
}>()

const emit = defineEmits<{
  'update:limit': [value: number | null]
  'update:notifyEnabled': [value: boolean | null]
  'update:notifyThreshold': [value: number | null]
  'update:notifyThresholdType': [value: QuotaThresholdType | null]
  'update:resetMode': [value: QuotaResetMode | null]
  'update:resetHour': [value: number | null]
  'update:resetDay': [value: number | null]
  'update:resetTimezone': [value: string | null]
}>()

const hasResetMode = props.dim !== 'total'
const resetModeOptions = computed(() => [
  { value: 'rolling', label: t('admin.accounts.quotaResetModeRolling') },
  { value: 'fixed', label: t('admin.accounts.quotaResetModeFixed') }
])
const daySelectOptions = computed(() => props.dayOptions.map(day => ({
  value: day.value,
  label: t(`admin.accounts.dayOfWeek.${day.key}`)
})))
const hourSelectOptions = computed(() => props.hourOptions.map(hour => ({
  value: hour,
  label: `${String(hour).padStart(2, '0')}:00`
})))
const timezoneSelectOptions = computed(() => (props.timezoneOptions || []).map(timezone => ({
  value: timezone,
  label: `${timezone} (${getTimezoneOffsetLabel(timezone)})`
})))

function updateLimit(value: string | number): void {
  const parsed = Number(value)
  emit('update:limit', value === '' || Number.isNaN(parsed) ? null : parsed)
}

function updateResetMode(value: string | number | boolean | null): void {
  const mode = String(value) as QuotaResetMode
  emit('update:resetMode', mode)
  if (mode !== 'fixed') return
  if (props.resetHour == null) emit('update:resetHour', 0)
  if (props.dim === 'weekly' && props.resetDay == null) emit('update:resetDay', 1)
  if (!props.resetTimezone) emit('update:resetTimezone', 'UTC')
}

function getTimezoneOffsetLabel(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    })
    const zone = formatter.formatToParts(new Date()).find(part => part.type === 'timeZoneName')
    return zone ? (zone.value === 'GMT' ? 'GMT+0' : zone.value) : ''
  } catch {
    return ''
  }
}
</script>

<style scoped>
.quota-dimension{min-width:0;padding:8px 0;border-bottom:1px solid var(--ui-border-soft)}
.quota-dimension:last-child{border-bottom:0}
.quota-dimension__reset-grid{align-items:end}
.quota-dimension__hint{margin:0;color:var(--ui-text-soft);font-size:11px;line-height:17px}
</style>
