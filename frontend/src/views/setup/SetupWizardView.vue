<template>
  <div
    class="min-h-screen bg-gray-50 px-4 py-8 dark:bg-dark-950 sm:px-6 sm:py-10"
  >
    <div class="mx-auto w-full max-w-3xl">
      <!-- Logo & Title -->
      <div class="mb-7 flex items-start gap-4">
        <div
          class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[4px] border border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/30"
        >
          <Icon name="cog" size="lg" class="text-primary-600 dark:text-primary-400" />
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('setup.title') }}</h1>
          <p class="mt-1 text-sm leading-6 text-gray-500 dark:text-dark-400">{{ t('setup.description') }}</p>
        </div>
      </div>

      <!-- Progress Steps -->
      <div class="mb-5" :aria-label="t('setup.title')">
        <ol class="flex items-center" role="list">
          <li
            v-for="(step, index) in steps"
            :key="step.id"
            class="flex min-w-0 items-center"
            :class="index < steps.length - 1 ? 'flex-1' : 'flex-none'"
            :aria-current="currentStep === index ? 'step' : undefined"
          >
            <div
              :class="[
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                currentStep > index
                  ? 'bg-primary-500 text-white'
                  : currentStep === index
                    ? 'bg-primary-600 text-white ring-2 ring-primary-100 dark:ring-primary-900'
                    : 'bg-gray-200 text-gray-500 dark:bg-dark-700 dark:text-dark-400'
              ]"
            >
              <Icon
                v-if="currentStep > index"
                name="check"
                size="md"
                :stroke-width="2"
              />
              <span v-else>{{ index + 1 }}</span>
            </div>
            <span
              class="ml-2 hidden truncate text-sm font-medium sm:inline"
              :class="
                currentStep >= index
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-dark-500'
              "
            >
              {{ step.title }}
            </span>
            <span
              v-if="index < steps.length - 1"
              aria-hidden="true"
              class="mx-2 h-px min-w-4 flex-1 sm:mx-3"
              :class="currentStep > index ? 'bg-primary-500' : 'bg-gray-200 dark:bg-dark-700'"
            ></span>
          </li>
        </ol>
        <p class="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200 sm:hidden">
          {{ steps[currentStep]?.title }}
        </p>
      </div>

      <!-- Step Content -->
      <div class="rounded-[4px] border border-gray-200 bg-white p-4 dark:border-dark-700 dark:bg-dark-900 sm:p-6">
        <!-- Step 1: Database -->
        <div v-if="currentStep === 0" class="space-y-6">
          <div class="border-b border-gray-100 pb-4 dark:border-dark-800">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ t('setup.database.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">
              {{ t('setup.database.description') }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="setup-database-host" class="input-label">{{ t('setup.database.host') }}</label>
              <input
                id="setup-database-host"
                v-model="formData.database.host"
                type="text"
                class="input"
                placeholder="localhost"
              />
            </div>
            <div>
              <label for="setup-database-port" class="input-label">{{ t('setup.database.port') }}</label>
              <input
                id="setup-database-port"
                v-model.number="formData.database.port"
                type="number"
                class="input"
                placeholder="5432"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="setup-database-user" class="input-label">{{ t('setup.database.username') }}</label>
              <input
                id="setup-database-user"
                v-model="formData.database.user"
                type="text"
                class="input"
                placeholder="postgres"
              />
            </div>
            <div>
              <label for="setup-database-password" class="input-label">{{ t('setup.database.password') }}</label>
              <input
                id="setup-database-password"
                v-model="formData.database.password"
                type="password"
                class="input"
                :placeholder="t('setup.database.passwordPlaceholder')"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="setup-database-name" class="input-label">{{ t('setup.database.databaseName') }}</label>
              <input
                id="setup-database-name"
                v-model="formData.database.dbname"
                type="text"
                class="input"
                placeholder="sub2api"
              />
            </div>
            <div>
              <label for="setup-database-ssl" class="input-label">{{ t('setup.database.sslMode') }}</label>
              <Select
                id="setup-database-ssl"
                v-model="formData.database.sslmode"
                :aria-label="t('setup.database.sslMode')"
                :options="[
                  { value: 'disable', label: t('setup.database.ssl.disable') },
                  { value: 'require', label: t('setup.database.ssl.require') },
                  { value: 'verify-ca', label: t('setup.database.ssl.verifyCa') },
                  { value: 'verify-full', label: t('setup.database.ssl.verifyFull') }
                ]"
              />
            </div>
          </div>

          <button
            type="button"
            @click="testDatabaseConnection"
            :disabled="testingDb"
            class="btn btn-secondary w-full"
          >
            <svg
              v-if="testingDb"
              class="-ml-1 mr-2 h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <Icon v-else-if="dbConnected" name="check" size="md" class="mr-2 text-green-500" :stroke-width="2" />
            {{
              testingDb
                ? t('setup.status.testing')
                : dbConnected
                  ? t('setup.status.success')
                  : t('setup.status.testConnection')
            }}
          </button>
        </div>

        <!-- Step 2: Redis -->
        <div v-if="currentStep === 1" class="space-y-6">
          <div class="border-b border-gray-100 pb-4 dark:border-dark-800">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ t('setup.redis.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">
              {{ t('setup.redis.description') }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="setup-redis-host" class="input-label">{{ t('setup.redis.host') }}</label>
              <input
                id="setup-redis-host"
                v-model="formData.redis.host"
                type="text"
                class="input"
                placeholder="localhost"
              />
            </div>
            <div>
              <label for="setup-redis-port" class="input-label">{{ t('setup.redis.port') }}</label>
              <input
                id="setup-redis-port"
                v-model.number="formData.redis.port"
                type="number"
                class="input"
                placeholder="6379"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="setup-redis-user" class="input-label">{{ t('setup.redis.username') }}</label>
              <input
                id="setup-redis-user"
                v-model="formData.redis.username"
                type="text"
                class="input"
                :placeholder="t('setup.redis.usernamePlaceholder')"
              />
            </div>
            <div>
              <label for="setup-redis-password" class="input-label">{{ t('setup.redis.password') }}</label>
              <input
                id="setup-redis-password"
                v-model="formData.redis.password"
                type="password"
                class="input"
                :placeholder="t('setup.redis.passwordPlaceholder')"
              />
            </div>
            <div>
              <label for="setup-redis-database" class="input-label">{{ t('setup.redis.database') }}</label>
              <input
                id="setup-redis-database"
                v-model.number="formData.redis.db"
                type="number"
                class="input"
                placeholder="0"
              />
            </div>
          </div>

          <div class="flex items-center justify-between gap-4 border-y border-gray-100 py-3 dark:border-dark-800">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ t("setup.redis.enableTls") }}
              </p>
              <p class="text-xs text-gray-500 dark:text-dark-400">
                {{ t("setup.redis.enableTlsHint") }}
              </p>
            </div>
            <Toggle
              v-model="formData.redis.enable_tls"
              :aria-label="t('setup.redis.enableTls')"
            />
          </div>

          <button
            type="button"
            @click="testRedisConnection"
            :disabled="testingRedis"
            class="btn btn-secondary w-full"
          >
            <svg
              v-if="testingRedis"
              class="-ml-1 mr-2 h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <Icon
              v-else-if="redisConnected"
              name="check"
              size="md"
              class="mr-2 text-green-500"
              :stroke-width="2"
            />
            {{
              testingRedis
                ? t('setup.status.testing')
                : redisConnected
                  ? t('setup.status.success')
                  : t('setup.status.testConnection')
            }}
          </button>
        </div>

        <!-- Step 3: Admin -->
        <div v-if="currentStep === 2" class="space-y-6">
          <div class="border-b border-gray-100 pb-4 dark:border-dark-800">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ t('setup.admin.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">
              {{ t('setup.admin.description') }}
            </p>
          </div>

          <div>
            <label for="setup-admin-email" class="input-label">{{ t('setup.admin.email') }}</label>
            <input
              id="setup-admin-email"
              v-model="formData.admin.email"
              type="email"
              autocomplete="email"
              class="input"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label for="setup-admin-password" class="input-label">{{ t('setup.admin.password') }}</label>
            <input
              id="setup-admin-password"
              v-model="formData.admin.password"
              type="password"
              autocomplete="new-password"
              class="input"
              :placeholder="t('setup.admin.passwordPlaceholder')"
            />
          </div>

          <div>
            <label for="setup-admin-confirm-password" class="input-label">{{ t('setup.admin.confirmPassword') }}</label>
            <input
              id="setup-admin-confirm-password"
              v-model="confirmPassword"
              type="password"
              autocomplete="new-password"
              :aria-invalid="Boolean(confirmPassword && formData.admin.password !== confirmPassword)"
              aria-describedby="setup-admin-password-error"
              class="input"
              :placeholder="t('setup.admin.confirmPasswordPlaceholder')"
            />
            <p
              id="setup-admin-password-error"
              v-if="confirmPassword && formData.admin.password !== confirmPassword"
              class="input-error-text"
            >
              {{ t('setup.admin.passwordMismatch') }}
            </p>
          </div>
        </div>

        <!-- Step 4: Complete -->
        <div v-if="currentStep === 3" class="space-y-6">
          <div class="border-b border-gray-100 pb-4 dark:border-dark-800">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ t('setup.ready.title') }}
            </h2>
            <p class="mt-1 text-sm text-gray-500 dark:text-dark-400">
              {{ t('setup.ready.description') }}
            </p>
          </div>

          <dl class="divide-y divide-gray-100 border-y border-gray-100 dark:divide-dark-800 dark:border-dark-800">
            <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt class="text-sm font-medium text-gray-500 dark:text-dark-400">
                {{ t('setup.ready.database') }}
              </dt>
              <dd class="break-all text-sm text-gray-900 dark:text-white">
                {{ formData.database.user }}@{{ formData.database.host }}:{{
                  formData.database.port
                }}/{{ formData.database.dbname }}
              </dd>
            </div>

            <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt class="text-sm font-medium text-gray-500 dark:text-dark-400">
                {{ t('setup.ready.redis') }}
              </dt>
              <dd class="break-all text-sm text-gray-900 dark:text-white">
                {{ formData.redis.host }}:{{ formData.redis.port }}
              </dd>
            </div>

            <div class="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
              <dt class="text-sm font-medium text-gray-500 dark:text-dark-400">
                {{ t('setup.ready.adminEmail') }}
              </dt>
              <dd class="break-all text-sm text-gray-900 dark:text-white">{{ formData.admin.email }}</dd>
            </div>
          </dl>
        </div>

        <!-- Error Message -->
        <div
          v-if="errorMessage"
          class="mt-6 rounded-[4px] border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-900/20"
          role="alert"
        >
          <div class="flex items-start gap-3">
            <Icon name="exclamationCircle" size="md" class="flex-shrink-0 text-red-500" />
            <p class="text-sm text-red-700 dark:text-red-400">{{ errorMessage }}</p>
          </div>
        </div>

        <!-- Success Message -->
        <div
          v-if="installSuccess"
          class="mt-6 rounded-[4px] border border-green-200 bg-green-50 p-4 dark:border-green-800/50 dark:bg-green-900/20"
          role="status"
        >
          <div class="flex items-start gap-3">
            <svg
              v-if="!serviceReady"
              class="h-5 w-5 flex-shrink-0 animate-spin text-green-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <Icon v-else name="checkCircle" size="md" class="flex-shrink-0 text-green-500" />
            <div>
              <p class="text-sm font-medium text-green-700 dark:text-green-400">
                {{ t('setup.status.completed') }}
              </p>
              <p class="mt-1 text-sm text-green-600 dark:text-green-500">
                {{
                  serviceReady
                    ? t('setup.status.redirecting')
                    : t('setup.status.restarting')
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Navigation Buttons -->
        <div class="mt-6 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5 dark:border-dark-800">
          <button
            v-if="currentStep > 0 && !installSuccess"
            type="button"
            @click="currentStep--"
            class="btn btn-secondary mr-auto"
          >
            <Icon name="chevronLeft" size="sm" class="mr-2" :stroke-width="2" />
            {{ t('common.back') }}
          </button>

          <button
            v-if="currentStep < 3"
            type="button"
            @click="nextStep"
            :disabled="!canProceed"
            class="btn btn-primary"
          >
            {{ t('common.next') }}
            <Icon name="chevronRight" size="sm" class="ml-2" :stroke-width="2" />
          </button>

          <button
            v-else-if="!installSuccess"
            type="button"
            @click="performInstall"
            :disabled="installing"
            class="btn btn-primary"
          >
            <svg
              v-if="installing"
              class="-ml-1 mr-2 h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {{ installing ? t('setup.status.installing') : t('setup.status.completeInstallation') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { testDatabase, testRedis, install, type InstallRequest } from '@/api/setup'
import { buildGatewayUrl } from '@/api/client'
import Select from '@/components/common/Select.vue'
import Toggle from '@/components/common/Toggle.vue'
import Icon from '@/components/icons/Icon.vue'

const { t } = useI18n()

const steps = computed(() => [
  { id: 'database', title: t('setup.database.title') },
  { id: 'redis', title: t('setup.redis.title') },
  { id: 'admin', title: t('setup.admin.title') },
  { id: 'complete', title: t('setup.ready.title') }
])

const currentStep = ref(0)
const errorMessage = ref('')
const installSuccess = ref(false)

// Connection test states
const testingDb = ref(false)
const testingRedis = ref(false)
const dbConnected = ref(false)
const redisConnected = ref(false)
const installing = ref(false)
const confirmPassword = ref('')
const serviceReady = ref(false)

// Default server port
const getCurrentPort = (): number => {
  const port = window.location.port
  if (port) {
    return parseInt(port, 10)
  }

  return window.location.protocol === 'https:' ? 443 : 80
}

const formData = reactive<InstallRequest>({
  database: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    dbname: 'sub2api',
    sslmode: 'disable'
  },
  redis: {
    host: 'localhost',
    port: 6379,
    username: '',
    password: '',
    db: 0,
    enable_tls: false
  },
  admin: {
    email: '',
    password: ''
  },
  server: {
    host: '0.0.0.0',
    port: getCurrentPort(), // Use current port from browser
    mode: 'release'
  }
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0:
      return dbConnected.value
    case 1:
      return redisConnected.value
    case 2:
      return (
        formData.admin.email &&
        formData.admin.password.length >= 8 &&
        formData.admin.password === confirmPassword.value
      )
    default:
      return true
  }
})

async function testDatabaseConnection() {
  testingDb.value = true
  errorMessage.value = ''
  dbConnected.value = false

  try {
    await testDatabase(formData.database)
    dbConnected.value = true
  } catch (error: unknown) {
    const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string }
    errorMessage.value =
      err.response?.data?.detail || err.response?.data?.message || err.message || 'Connection failed'
  } finally {
    testingDb.value = false
  }
}

async function testRedisConnection() {
  testingRedis.value = true
  errorMessage.value = ''
  redisConnected.value = false

  try {
    await testRedis(formData.redis)
    redisConnected.value = true
  } catch (error: unknown) {
    const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string }
    errorMessage.value =
      err.response?.data?.detail || err.response?.data?.message || err.message || 'Connection failed'
  } finally {
    testingRedis.value = false
  }
}

function nextStep() {
  if (canProceed.value) {
    errorMessage.value = ''
    currentStep.value++
  }
}

async function performInstall() {
  installing.value = true
  errorMessage.value = ''

  try {
    await install(formData)
    installSuccess.value = true
    // Start polling for service restart
    waitForServiceRestart()
  } catch (error: unknown) {
    const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string }
    errorMessage.value =
      err.response?.data?.detail || err.response?.data?.message || err.message || 'Installation failed'
  } finally {
    installing.value = false
  }
}

// Wait for service to restart and become available
async function waitForServiceRestart() {
  const maxAttempts = 60 // Increase to 60 attempts, ~60 seconds max
  const interval = 1000 // 1 second between attempts

  // Wait a moment for the service to start restarting
  await new Promise((resolve) => setTimeout(resolve, 3000))

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Use setup status endpoint as it tells us the real mode
      // Service might return 404 or connection refused while restarting
      const response = await fetch(buildGatewayUrl('/setup/status'), {
        method: 'GET',
        cache: 'no-store'
      })

      if (response.ok) {
        const data = await response.json()
        // If needs_setup is false, service has restarted in normal mode
        if (data.data && !data.data.needs_setup) {
          serviceReady.value = true
          // Redirect to login page after a short delay
          setTimeout(() => {
            window.location.href = '/login'
          }, 1500)
          return
        }
      }
    } catch {
      // Service not ready or network error during restart, continue polling
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  // If we reach here, service didn't restart in time
  // Show a message to refresh manually
  errorMessage.value = t('setup.status.timeout')
}
</script>
