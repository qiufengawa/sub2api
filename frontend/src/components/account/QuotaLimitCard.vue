<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppStack, UiIconButton, UiSwitch } from '@/components/ui'
import QuotaDimensionRow from './QuotaDimensionRow.vue'
import type { QuotaThresholdType, QuotaResetMode } from '@/constants/account'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  totalLimit: number | null
  dailyLimit: number | null
  weeklyLimit: number | null
  dailyResetMode: QuotaResetMode | null
  dailyResetHour: number | null
  weeklyResetMode: QuotaResetMode | null
  weeklyResetDay: number | null
  weeklyResetHour: number | null
  resetTimezone: string | null
  quotaNotifyGlobalEnabled?: boolean
  quotaNotifyDailyEnabled?: boolean | null
  quotaNotifyDailyThreshold?: number | null
  quotaNotifyDailyThresholdType?: QuotaThresholdType | null
  quotaNotifyWeeklyEnabled?: boolean | null
  quotaNotifyWeeklyThreshold?: number | null
  quotaNotifyWeeklyThresholdType?: QuotaThresholdType | null
  quotaNotifyTotalEnabled?: boolean | null
  quotaNotifyTotalThreshold?: number | null
  quotaNotifyTotalThresholdType?: QuotaThresholdType | null
}>(), {
  quotaNotifyGlobalEnabled: false,
  quotaNotifyDailyEnabled: null,
  quotaNotifyDailyThreshold: null,
  quotaNotifyDailyThresholdType: null,
  quotaNotifyWeeklyEnabled: null,
  quotaNotifyWeeklyThreshold: null,
  quotaNotifyWeeklyThresholdType: null,
  quotaNotifyTotalEnabled: null,
  quotaNotifyTotalThreshold: null,
  quotaNotifyTotalThresholdType: null,
})

const emit = defineEmits<{
  'update:totalLimit': [value: number | null]
  'update:dailyLimit': [value: number | null]
  'update:weeklyLimit': [value: number | null]
  'update:dailyResetMode': [value: QuotaResetMode | null]
  'update:dailyResetHour': [value: number | null]
  'update:weeklyResetMode': [value: QuotaResetMode | null]
  'update:weeklyResetDay': [value: number | null]
  'update:weeklyResetHour': [value: number | null]
  'update:resetTimezone': [value: string | null]
  'update:quotaNotifyDailyEnabled': [value: boolean | null]
  'update:quotaNotifyDailyThreshold': [value: number | null]
  'update:quotaNotifyDailyThresholdType': [value: QuotaThresholdType | null]
  'update:quotaNotifyWeeklyEnabled': [value: boolean | null]
  'update:quotaNotifyWeeklyThreshold': [value: number | null]
  'update:quotaNotifyWeeklyThresholdType': [value: QuotaThresholdType | null]
  'update:quotaNotifyTotalEnabled': [value: boolean | null]
  'update:quotaNotifyTotalThreshold': [value: number | null]
  'update:quotaNotifyTotalThresholdType': [value: QuotaThresholdType | null]
}>()

const enabled = computed(() =>
  (props.totalLimit != null && props.totalLimit > 0) ||
  (props.dailyLimit != null && props.dailyLimit > 0) ||
  (props.weeklyLimit != null && props.weeklyLimit > 0)
)

const localEnabled = ref(enabled.value)
const collapsed = ref(false)

// Sync when props change externally
watch(enabled, (val) => {
  localEnabled.value = val
})

// When toggle is turned off, clear all values and expand
watch(localEnabled, (val) => {
  if (!val) {
    collapsed.value = false
    emit('update:totalLimit', null)
    emit('update:dailyLimit', null)
    emit('update:weeklyLimit', null)
    emit('update:dailyResetMode', null)
    emit('update:dailyResetHour', null)
    emit('update:weeklyResetMode', null)
    emit('update:weeklyResetDay', null)
    emit('update:weeklyResetHour', null)
    emit('update:resetTimezone', null)
  }
})

// Common timezone options
const timezoneOptions = [
  'UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Singapore', 'Asia/Kolkata',
  'Asia/Dubai', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Australia/Sydney', 'Pacific/Auckland',
]

// Hours for dropdown (0-23)
const hourOptions = Array.from({ length: 24 }, (_, i) => i)

// Day of week options
const dayOptions = [
  { value: 1, key: 'monday' },
  { value: 2, key: 'tuesday' },
  { value: 3, key: 'wednesday' },
  { value: 4, key: 'thursday' },
  { value: 5, key: 'friday' },
  { value: 6, key: 'saturday' },
  { value: 0, key: 'sunday' },
]

// Precomputed hint strings for the weekly fixed mode
const weeklyFixedHint = computed(() => {
  const dayKey = dayOptions.find(d => d.value === (props.weeklyResetDay ?? 1))?.key || 'monday'
  return t('admin.accounts.quotaWeeklyLimitHintFixed', {
    day: t('admin.accounts.dayOfWeek.' + dayKey),
    hour: String(props.weeklyResetHour ?? 0).padStart(2, '0'),
    timezone: props.resetTimezone || 'UTC',
  })
})

const dailyFixedHint = computed(() =>
  t('admin.accounts.quotaDailyLimitHintFixed', {
    hour: String(props.dailyResetHour ?? 0).padStart(2, '0'),
    timezone: props.resetTimezone || 'UTC',
  })
)
</script>

<template>
  <AppStack :gap="8" class="quota-limit">
      <div class="quota-limit__header">
        <UiIconButton
          v-if="localEnabled"
          :label="t('admin.accounts.quotaLimitToggle')"
          icon="chevronDown"
          variant="ghost"
          density="dense"
          :aria-expanded="!collapsed"
          :class="{ 'quota-limit__collapse--closed': collapsed }"
          @click="collapsed = !collapsed"
        />
        <div class="quota-limit__heading">
          <strong>{{ t('admin.accounts.quotaLimitToggle') }}</strong>
          <p>{{ t('admin.accounts.quotaLimitToggleHint') }}</p>
        </div>
        <UiSwitch
          v-model="localEnabled"
          :label="t('admin.accounts.quotaLimitToggle')"
        />
      </div>

      <!-- Collapsible content -->
      <AppStack v-if="localEnabled && !collapsed" :gap="0" class="quota-limit__content">
        <!-- Daily quota -->
        <QuotaDimensionRow
          dim="daily"
          :label="t('admin.accounts.quotaDailyLimit')"
          :limit="dailyLimit"
          :quota-notify-global-enabled="quotaNotifyGlobalEnabled"
          :notify-enabled="props.quotaNotifyDailyEnabled"
          :notify-threshold="props.quotaNotifyDailyThreshold"
          :notify-threshold-type="props.quotaNotifyDailyThresholdType"
          :reset-mode="dailyResetMode"
          :reset-hour="dailyResetHour"
          :reset-day="null"
          :reset-timezone="resetTimezone"
          :hint-rolling="t('admin.accounts.quotaDailyLimitHint')"
          :hint-fixed="dailyFixedHint"
          :hour-options="hourOptions"
          :day-options="dayOptions"
          :timezone-options="timezoneOptions"
          @update:limit="emit('update:dailyLimit', $event)"
          @update:notify-enabled="emit('update:quotaNotifyDailyEnabled', $event)"
          @update:notify-threshold="emit('update:quotaNotifyDailyThreshold', $event)"
          @update:notify-threshold-type="emit('update:quotaNotifyDailyThresholdType', $event)"
          @update:reset-mode="emit('update:dailyResetMode', $event)"
          @update:reset-hour="emit('update:dailyResetHour', $event)"
          @update:reset-timezone="emit('update:resetTimezone', $event)"
        />

        <!-- Weekly quota -->
        <QuotaDimensionRow
          dim="weekly"
          :label="t('admin.accounts.quotaWeeklyLimit')"
          :limit="weeklyLimit"
          :quota-notify-global-enabled="quotaNotifyGlobalEnabled"
          :notify-enabled="props.quotaNotifyWeeklyEnabled"
          :notify-threshold="props.quotaNotifyWeeklyThreshold"
          :notify-threshold-type="props.quotaNotifyWeeklyThresholdType"
          :reset-mode="weeklyResetMode"
          :reset-hour="weeklyResetHour"
          :reset-day="weeklyResetDay"
          :reset-timezone="resetTimezone"
          :hint-rolling="t('admin.accounts.quotaWeeklyLimitHint')"
          :hint-fixed="weeklyFixedHint"
          :hour-options="hourOptions"
          :day-options="dayOptions"
          :timezone-options="timezoneOptions"
          @update:limit="emit('update:weeklyLimit', $event)"
          @update:notify-enabled="emit('update:quotaNotifyWeeklyEnabled', $event)"
          @update:notify-threshold="emit('update:quotaNotifyWeeklyThreshold', $event)"
          @update:notify-threshold-type="emit('update:quotaNotifyWeeklyThresholdType', $event)"
          @update:reset-mode="emit('update:weeklyResetMode', $event)"
          @update:reset-hour="emit('update:weeklyResetHour', $event)"
          @update:reset-day="emit('update:weeklyResetDay', $event)"
          @update:reset-timezone="emit('update:resetTimezone', $event)"
        />

        <!-- Total quota -->
        <QuotaDimensionRow
          dim="total"
          :label="t('admin.accounts.quotaTotalLimit')"
          :limit="totalLimit"
          :quota-notify-global-enabled="quotaNotifyGlobalEnabled"
          :notify-enabled="props.quotaNotifyTotalEnabled"
          :notify-threshold="props.quotaNotifyTotalThreshold"
          :notify-threshold-type="props.quotaNotifyTotalThresholdType"
          :reset-mode="null"
          :reset-hour="null"
          :reset-day="null"
          :reset-timezone="null"
          :hint-rolling="t('admin.accounts.quotaTotalLimitHint')"
          hint-fixed=""
          :hour-options="hourOptions"
          :day-options="dayOptions"
          @update:limit="emit('update:totalLimit', $event)"
          @update:notify-enabled="emit('update:quotaNotifyTotalEnabled', $event)"
          @update:notify-threshold="emit('update:quotaNotifyTotalThreshold', $event)"
          @update:notify-threshold-type="emit('update:quotaNotifyTotalThresholdType', $event)"
        />
      </AppStack>
  </AppStack>
</template>

<style scoped>
.quota-limit{min-width:0;padding:10px 0;border-block:1px solid var(--ui-border)}
.quota-limit__header{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px}
.quota-limit__heading{display:grid;gap:2px;min-width:0}
.quota-limit__heading strong{font-size:13px;font-weight:600;line-height:20px}
.quota-limit__heading p{margin:0;color:var(--ui-text-soft);font-size:12px;line-height:18px}
.quota-limit__collapse--closed{transform:rotate(-90deg)}
.quota-limit__content{padding-left:36px}
@media(max-width:540px){.quota-limit__content{padding-left:0}}
@media(prefers-reduced-motion:reduce){.quota-limit__collapse--closed{transition:none}}
</style>
