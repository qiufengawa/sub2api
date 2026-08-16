<template>
  <section class="auth-form-panel">
    <header class="auth-form-panel__heading">
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </header>

    <slot />

    <footer v-if="$slots.footer" class="auth-form-panel__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<script setup lang="ts">
import './auth-form.css'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
.auth-form-panel {
  width: 100%;
  color: var(--ui-text);
}

.auth-form-panel__heading {
  margin-bottom: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--ui-border-soft);
  text-align: left;
}

.auth-form-panel__heading h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0;
}

.auth-form-panel__heading p {
  margin: 7px 0 0;
  color: var(--ui-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.auth-form-panel__footer {
  margin-top: 28px;
  color: var(--ui-text-muted);
  text-align: center;
}

@media (max-width: 640px) {
  .auth-form-panel__heading {
    margin-bottom: 22px;
    padding-bottom: 16px;
  }
}
</style>
