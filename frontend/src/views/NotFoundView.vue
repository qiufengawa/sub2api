<template>
  <AppPage width="normal" class="not-found-page">
    <div class="not-found-content">
      <UiEmptyState
        icon="exclamationCircle"
        :title="t('errors.pageNotFound')"
        :description="t('errors.pageNotFoundDescription')"
      >
        <template #action>
          <AppInline :gap="8" justify="center">
            <UiButton density="compact" data-testid="not-found-back" @click="goBack">
              <template #icon><Icon name="arrowLeft" size="sm" /></template>
              {{ t('common.back') }}
            </UiButton>
            <UiLink :to="primaryDestination" data-testid="not-found-primary">
              <Icon name="home" size="sm" />
              {{ isAuthenticated ? t('home.goToDashboard') : t('common.goHome') }}
            </UiLink>
          </AppInline>
        </template>
      </UiEmptyState>

      <p v-if="contactInfo" class="not-found-contact" data-testid="not-found-contact">
        <strong>{{ t('common.contactSupport') }}:</strong>
        <span>{{ contactInfo }}</span>
      </p>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Icon from '@/components/icons/Icon.vue'
import { AppInline, AppPage, UiButton, UiEmptyState, UiLink } from '@/components/ui'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const primaryDestination = computed(() => (isAuthenticated.value ? '/dashboard' : '/home'))
const contactInfo = computed(() => appStore.contactInfo.trim())

function goBack(): void {
  router.back()
}

onMounted(() => {
  if (!appStore.publicSettingsLoaded) {
    void appStore.fetchPublicSettings()
  }
})
</script>

<style scoped>
.not-found-page {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  background: var(--ui-page);
}

.not-found-content {
  width: min(100%, 520px);
}

.not-found-contact {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  margin: 8px 24px 0;
  padding-top: 16px;
  border-top: 1px solid var(--ui-border-soft);
  color: var(--ui-text-muted);
  font-size: 12px;
  line-height: 19px;
  text-align: center;
  overflow-wrap: anywhere;
}

.not-found-contact strong {
  color: var(--ui-text);
  font-weight: 600;
}

@media (max-width: 640px) {
  .not-found-contact {
    margin-inline: 12px;
  }
}
</style>
