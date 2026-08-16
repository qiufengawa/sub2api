<template>
  <section class="oauth-profile-panel">
    <header>
      <h3>{{ t('auth.oauthFlow.profileDetailsTitle', { providerName }) }}</h3>
      <p>{{ t('auth.oauthFlow.profileDetailsDescription', { providerName }) }}</p>
    </header>

    <div class="oauth-profile-panel__options">
      <div v-if="displayName" class="oauth-profile-option">
        <UiCheckbox
          :model-value="adoptDisplayName"
          @update:model-value="emit('update:adoptDisplayName', $event)"
        >
          <span class="oauth-profile-option__copy">
            <strong>{{ t('auth.oauthFlow.useDisplayName') }}</strong>
            <span>{{ displayName }}</span>
          </span>
        </UiCheckbox>
      </div>

      <div v-if="avatarUrl" class="oauth-profile-option">
        <UiCheckbox
          :model-value="adoptAvatar"
          @update:model-value="emit('update:adoptAvatar', $event)"
        >
          <span class="oauth-profile-option__avatar">
            <UiAvatar
              :src="avatarUrl"
              :name="t('auth.oauthFlow.avatarAlt', { providerName })"
              size="lg"
            />
            <span class="oauth-profile-option__copy">
              <strong>{{ t('auth.oauthFlow.useAvatar') }}</strong>
              <span class="oauth-profile-option__url">{{ avatarUrl }}</span>
            </span>
          </span>
        </UiCheckbox>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { UiAvatar, UiCheckbox } from '@/components/ui'

defineProps<{
  providerName: string
  displayName?: string
  avatarUrl?: string
  adoptDisplayName: boolean
  adoptAvatar: boolean
}>()

const emit = defineEmits<{
  'update:adoptDisplayName': [value: boolean]
  'update:adoptAvatar': [value: boolean]
}>()

const { t } = useI18n()
</script>

<style scoped>
.oauth-profile-panel { display: grid; gap: 12px; }
.oauth-profile-panel h3, .oauth-profile-panel p { margin: 0; }
.oauth-profile-panel h3 { color: var(--ui-text); font-size: 13px; font-weight: 600; line-height: 20px; }
.oauth-profile-panel p { margin-top: 2px; color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.oauth-profile-panel__options { display: grid; gap: 8px; }
.oauth-profile-option { min-width: 0; padding: 10px; border: 1px solid var(--ui-border-soft); border-radius: var(--ui-radius); background: var(--ui-surface); }
.oauth-profile-option__avatar { display: flex; min-width: 0; align-items: center; gap: 10px; }
.oauth-profile-option__copy { display: grid; min-width: 0; gap: 1px; }
.oauth-profile-option__copy strong { color: var(--ui-text); font-size: 13px; font-weight: 600; line-height: 20px; }
.oauth-profile-option__copy > span { color: var(--ui-text-muted); font-size: 12px; line-height: 18px; }
.oauth-profile-option__url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--ui-font-mono); }
</style>
