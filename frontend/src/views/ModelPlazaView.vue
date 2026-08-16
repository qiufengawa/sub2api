<template>
  <!-- 后台内嵌形态:?embedded=1 且已登录,套完整后台布局 -->
  <AppLayout v-if="isEmbedded">
    <ModelPlazaContent
      :response="data"
      :loading="loading"
      :error="loadFailed"
      embedded
      @retry="loadPlaza"
    />
  </AppLayout>

  <!-- 独立形态:自带导航条(logo/站名 + 登录/回后台) -->
  <div v-else class="model-plaza-public">
    <PlazaNavBar />
    <AppPage width="wide" density="comfortable" class="model-plaza-public__page">
      <ModelPlazaContent
        :response="data"
        :loading="loading"
        :error="loadFailed"
        @retry="loadPlaza"
      />
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import PlazaNavBar from '@/components/modelPlaza/PlazaNavBar.vue'
import ModelPlazaContent from '@/components/modelPlaza/ModelPlazaContent.vue'
import { AppPage } from '@/components/ui'
import { getModelPlaza, type ModelPlazaResponse } from '@/api/modelPlaza'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()

// embedded=1 但未登录(如转发的链接)自动降级为独立形态。
const isEmbedded = computed(() => route.query.embedded === '1' && authStore.isAuthenticated)

const data = ref<ModelPlazaResponse | null>(null)
const loading = ref(true)
const loadFailed = ref(false)
let requestSequence = 0

async function loadPlaza(): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  loadFailed.value = false
  try {
    const response = await getModelPlaza()
    if (sequence === requestSequence) data.value = response
  } catch {
    if (sequence === requestSequence) loadFailed.value = true
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

onMounted(() => {
  // The public header can use the injected settings cache while the plaza request is pending.
  void appStore.fetchPublicSettings()
  void loadPlaza()
})

onBeforeUnmount(() => {
  requestSequence += 1
})
</script>

<style scoped>
.model-plaza-public {
  min-height: 100vh;
  color: var(--ui-text);
  background: var(--ui-bg);
}

.model-plaza-public__page {
  max-width: 1540px;
  margin: 0 auto;
}
</style>
