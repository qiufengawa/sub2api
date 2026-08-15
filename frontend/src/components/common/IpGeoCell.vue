<template>
  <div v-if="entry.status === 'idle'" class="ip-geo-cell">
    <UiButton variant="quiet" density="mini" class="ip-geo-cell__action" @click="handleFetch">
      {{ t('usage.ipGeo.fetch') }}
    </UiButton>
  </div>

  <div
    v-else-if="entry.status === 'loading'"
    class="ip-geo-cell ip-geo-cell--muted"
  >
    <UiSpinner size="sm" :label="t('usage.ipGeo.fetching')" />
    {{ t('usage.ipGeo.fetching') }}
  </div>

  <div v-else-if="entry.status === 'success'" class="ip-geo-cell">
    <UiTooltip v-if="tooltipText" :content="tooltipText">
      <UiLink :href="detailUrl" external class="ip-geo-cell__location">
        {{ entry.label }}
      </UiLink>
    </UiTooltip>
    <UiLink v-else :href="detailUrl" external class="ip-geo-cell__location">
      {{ entry.label }}
    </UiLink>
    <UiIconButton
      icon="refresh"
      density="mini"
      variant="ghost"
      :label="t('usage.ipGeo.refreshTitle')"
      @click="handleRefresh"
    />
  </div>

  <div v-else-if="entry.status === 'error'" class="ip-geo-cell">
    <UiButton
      variant="quiet"
      density="mini"
      class="ip-geo-cell__action ip-geo-cell__action--danger"
      @click="handleFetch"
    >
      {{ t('usage.ipGeo.failed') }}
    </UiButton>
  </div>

  <div v-else class="ip-geo-cell ip-geo-cell--muted">
    {{ t('usage.ipGeo.private') }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UiButton, UiIconButton, UiLink, UiSpinner, UiTooltip } from '@/components/ui'
import { fetchOne, getEntry } from '@/utils/ipGeoLookup'

const props = defineProps<{ ip: string }>()
const { t } = useI18n()

const entry = computed(() => getEntry(props.ip))
const detailUrl = computed(
  () => `https://www.iplocation.net/ip-lookup?query=${encodeURIComponent(props.ip)}`
)

const tooltipText = computed(() => {
  const detail = entry.value.detail
  if (!detail) return ''
  const lines = [
    detail.organization ? `${t('usage.ipGeo.detailOrg')}: ${detail.organization}` : '',
    detail.timezone ? `${t('usage.ipGeo.detailTimezone')}: ${detail.timezone}` : '',
    detail.accuracy != null ? `${t('usage.ipGeo.detailAccuracy')}: ${detail.accuracy}km` : '',
    detail.latitude && detail.longitude
      ? `${t('usage.ipGeo.detailCoordinates')}: ${detail.latitude}, ${detail.longitude}`
      : '',
  ].filter(Boolean)
  return lines.join('\n')
})

const handleFetch = () => {
  void fetchOne(props.ip)
}

const handleRefresh = () => {
  void fetchOne(props.ip, true)
}
</script>

<style scoped>
.ip-geo-cell {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 18px;
}

.ip-geo-cell--muted {
  color: var(--ui-text-soft);
}

.ip-geo-cell__action {
  min-width: 0;
  height: auto;
  padding: 0;
  color: var(--ui-text-muted);
  line-height: 18px;
  text-decoration: underline;
  text-decoration-color: var(--ui-border);
  text-decoration-style: dashed;
  text-underline-offset: 3px;
}

.ip-geo-cell__action:hover {
  color: var(--ui-text);
  background: transparent;
  text-decoration-color: currentColor;
}

.ip-geo-cell__action--danger,
.ip-geo-cell__action--danger:hover {
  color: var(--ui-danger);
}

.ip-geo-cell__location {
  min-width: 0;
  max-width: 180px;
  overflow: hidden;
  color: var(--ui-text-muted);
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
