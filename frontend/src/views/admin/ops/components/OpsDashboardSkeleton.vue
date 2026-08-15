<script setup lang="ts">
import { UiSkeleton } from '@/components/ui'

withDefaults(defineProps<{ fullscreen?: boolean }>(), { fullscreen: false })
</script>

<template>
  <div class="ops-skeleton" :class="{ 'ops-skeleton--fullscreen': fullscreen }" aria-busy="true">
    <section class="ops-skeleton__overview">
      <header class="ops-skeleton__toolbar">
        <UiSkeleton variant="text" width="256px" />
        <div v-if="!fullscreen" class="ops-skeleton__toolbar-actions">
          <UiSkeleton v-for="index in 6" :key="index" width="96px" height="32px" />
        </div>
      </header>

      <UiSkeleton v-if="!fullscreen" class="ops-skeleton__notice" height="48px" />

      <div class="ops-skeleton__summary">
        <div class="ops-skeleton__health">
          <UiSkeleton variant="circle" width="128px" height="128px" />
          <UiSkeleton variant="text" width="96px" />
        </div>
        <div class="ops-skeleton__metrics">
          <UiSkeleton v-for="index in 6" :key="index" height="88px" />
        </div>
      </div>

      <UiSkeleton variant="text" width="96px" />
      <div class="ops-skeleton__resources">
        <UiSkeleton v-for="index in 6" :key="index" height="108px" />
      </div>
    </section>

    <section class="ops-skeleton__section">
      <UiSkeleton variant="text" width="160px" />
      <div class="ops-skeleton__traffic-grid">
        <div class="ops-skeleton__traffic-trends">
          <UiSkeleton height="340px" />
          <UiSkeleton height="190px" />
        </div>
        <UiSkeleton class="ops-skeleton__concurrency" />
      </div>
    </section>

    <section class="ops-skeleton__section">
      <UiSkeleton variant="text" width="192px" />
      <div class="ops-skeleton__quality-grid">
        <UiSkeleton height="456px" />
        <div class="ops-skeleton__quality-side">
          <UiSkeleton v-for="index in 2" :key="index" height="220px" />
        </div>
      </div>
    </section>

    <section
      v-for="section in ['alerts', 'tokens', 'logs']"
      :key="section"
      :data-testid="`ops-skeleton-${section}`"
      class="ops-skeleton__table"
    >
      <header>
        <UiSkeleton variant="text" width="160px" />
        <UiSkeleton width="176px" height="32px" />
      </header>
      <UiSkeleton v-for="index in section === 'logs' ? 8 : 5" :key="index" height="43px" />
    </section>
  </div>
</template>

<style scoped>
.ops-skeleton{display:grid;width:100%;min-width:0;gap:20px}.ops-skeleton--fullscreen{padding:8px}.ops-skeleton__overview{display:grid;gap:12px;padding:16px 0;border-bottom:1px solid var(--ui-border-soft)}.ops-skeleton__toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:1px solid var(--ui-border-soft)}.ops-skeleton__toolbar-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.ops-skeleton__notice{display:block}.ops-skeleton__summary{display:grid;grid-template-columns:200px minmax(0,1fr);min-height:352px;border-block:1px solid var(--ui-border-soft)}.ops-skeleton__health{display:grid;place-content:center;justify-items:center;gap:16px;border-right:1px solid var(--ui-border-soft)}.ops-skeleton__metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-content:stretch;gap:8px;padding:12px}.ops-skeleton__resources{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.ops-skeleton__section{display:grid;gap:12px}.ops-skeleton__traffic-grid,.ops-skeleton__quality-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:16px}.ops-skeleton__traffic-trends,.ops-skeleton__quality-side{display:grid;gap:16px}.ops-skeleton__traffic-trends{grid-template-rows:340px 190px}.ops-skeleton__concurrency{height:546px}.ops-skeleton__quality-side{grid-template-rows:repeat(2,minmax(0,1fr))}.ops-skeleton__table{display:grid;gap:1px;padding-top:12px;border-top:1px solid var(--ui-border-soft);background:var(--ui-border-soft)}.ops-skeleton__table>header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 0 12px;background:var(--ui-surface)}@media(max-width:1023px){.ops-skeleton__resources{grid-template-columns:repeat(3,minmax(0,1fr))}.ops-skeleton__traffic-grid,.ops-skeleton__quality-grid{grid-template-columns:minmax(0,1fr)}.ops-skeleton__concurrency{height:420px}.ops-skeleton__quality-side{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:auto}}@media(max-width:640px){.ops-skeleton__toolbar{align-items:flex-start;flex-direction:column}.ops-skeleton__toolbar-actions{justify-content:flex-start}.ops-skeleton__summary{grid-template-columns:minmax(0,1fr)}.ops-skeleton__health{min-height:220px;border-right:0;border-bottom:1px solid var(--ui-border-soft)}.ops-skeleton__metrics,.ops-skeleton__resources,.ops-skeleton__quality-side{grid-template-columns:minmax(0,1fr)}.ops-skeleton__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
