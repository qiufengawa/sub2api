<template>
  <section class="card overflow-hidden" data-testid="dashboard-getting-started">
    <div class="border-b border-gray-100 px-4 py-3 dark:border-dark-700">
      <h2 class="text-sm font-semibold text-gray-950 dark:text-white">
        {{ hasApiKey ? t('dashboard.overview.firstRequestTitle') : t('dashboard.overview.gettingStartedTitle') }}
      </h2>
      <p class="mt-1 text-xs text-gray-500 dark:text-dark-400">
        {{ hasApiKey ? t('dashboard.overview.firstRequestDescription') : t('dashboard.overview.gettingStartedDescription') }}
      </p>
    </div>

    <div class="grid grid-cols-1 gap-0 lg:grid-cols-5">
      <div class="border-b border-gray-100 p-4 dark:border-dark-700 lg:col-span-2 lg:border-b-0 lg:border-r">
        <ol class="space-y-3">
          <li v-for="step in steps" :key="step.index" class="flex items-start gap-3">
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border text-xs font-semibold"
              :class="step.complete ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300' : 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-900/25 dark:text-primary-300'"
            >
              <Icon v-if="step.complete" name="check" size="xs" :stroke-width="2" />
              <span v-else>{{ step.index }}</span>
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ step.label }}</p>
              <router-link v-if="step.to" :to="step.to" class="mt-0.5 inline-flex text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">
                {{ step.action }}
              </router-link>
              <span v-else class="mt-0.5 block text-xs text-gray-500 dark:text-dark-400">{{ step.action }}</span>
            </div>
          </li>
        </ol>
      </div>

      <div class="space-y-3 p-4 lg:col-span-3">
        <div>
          <div class="mb-1.5 flex items-center justify-between gap-3">
            <p class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('dashboard.overview.apiEndpoint') }}</p>
            <button type="button" class="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400" @click="copyEndpoint">
              {{ copied ? t('dashboard.overview.copied') : t('dashboard.overview.copy') }}
            </button>
          </div>
          <code class="block overflow-x-auto rounded-[3px] border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-dark-600 dark:bg-dark-900 dark:text-dark-200">
            {{ normalizedBaseUrl }}
          </code>
        </div>

        <div>
          <div class="mb-1.5 flex items-center justify-between gap-3">
            <p class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('dashboard.overview.requestExample') }}</p>
            <button type="button" class="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400" @click="copyRequest">
              {{ t('dashboard.overview.copyRequest') }}
            </button>
          </div>
          <pre class="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-[3px] border border-gray-200 bg-gray-950 px-3 py-2 text-[11px] leading-5 text-gray-100 dark:border-dark-600"><code>{{ requestExample }}</code></pre>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <router-link to="/available-channels" class="btn btn-secondary btn-sm">
            <Icon name="grid" size="xs" />
            {{ t('dashboard.overview.viewAvailableModels') }}
          </router-link>
          <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
            <Icon name="book" size="xs" />
            {{ t('dashboard.overview.fullDocumentation') }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useClipboard } from '@/composables/useClipboard'

const props = defineProps<{
  hasApiKey: boolean
  apiBaseUrl: string
  docUrl?: string
}>()

const { t } = useI18n()
const { copied, copyToClipboard } = useClipboard()
const normalizedBaseUrl = computed(() => (props.apiBaseUrl.trim() || window.location.origin).replace(/\/$/, ''))
const requestExample = computed(() => `curl ${normalizedBaseUrl.value}/v1/chat/completions \\
  -H "Authorization: Bearer $SUB2API_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4.1","messages":[{"role":"user","content":"Hello"}]}'`)

const steps = computed(() => [
  {
    index: 1,
    label: t('dashboard.overview.stepCreateKey'),
    action: props.hasApiKey ? t('dashboard.overview.completed') : t('dashboard.createApiKey'),
    to: '/keys',
    complete: props.hasApiKey,
  },
  {
    index: 2,
    label: t('dashboard.overview.stepChooseChannel'),
    action: t('dashboard.overview.viewAvailableModels'),
    to: '/available-channels',
    complete: false,
  },
  {
    index: 3,
    label: t('dashboard.overview.stepSendRequest'),
    action: t('dashboard.overview.requestExample'),
    to: '',
    complete: false,
  },
])

const copyEndpoint = () => copyToClipboard(normalizedBaseUrl.value)
const copyRequest = () => copyToClipboard(requestExample.value)
</script>
