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
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
.auth-form-panel {
  --auth-control-text: #0a0a0a;
  --auth-control-muted: #6c6762;
  --auth-control-soft: #9c9690;
  --auth-control-line: #ddd7d1;
  --auth-control-line-soft: #eee9e4;
  --auth-control-beige: #f6f2ed;
  width: 100%;
  color: var(--auth-control-text);
}

.auth-form-panel__heading {
  margin-bottom: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--auth-control-line-soft);
  text-align: left;
}

.auth-form-panel__heading h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0;
}

.auth-form-panel__heading p {
  margin: 7px 0 0;
  color: var(--auth-control-muted);
  font-size: 13px;
  line-height: 1.6;
}

.auth-form-panel :deep(.auth-form) {
  display: grid;
  gap: 14px;
}

.auth-form-panel :deep(.auth-primary) {
  display: inline-flex;
  width: 100%;
  height: 32px !important;
  min-height: 32px !important;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 6px;
  padding: 0 12px;
  border: 1px solid #0c0c0c !important;
  border-radius: 6px !important;
  background: #0c0c0c !important;
  color: #fff !important;
  font-size: 12px;
  font-weight: 600;
  box-shadow: none !important;
}

.auth-form-panel :deep(.auth-primary:hover:not(:disabled)) {
  background: #292929 !important;
}

.auth-form-panel :deep(.auth-primary:disabled) {
  cursor: not-allowed;
  opacity: 0.45;
}

.auth-form-panel :deep(.auth-alternatives) {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.auth-form-panel :deep(.auth-divider) {
  display: flex;
  align-items: center;
  gap: 13px;
  margin: 2px 0 3px;
}

.auth-form-panel :deep(.auth-divider::before),
.auth-form-panel :deep(.auth-divider::after) {
  height: 1px;
  flex: 1;
  background: var(--auth-control-line-soft);
  content: "";
}

.auth-form-panel :deep(.auth-divider span) {
  color: var(--auth-control-soft);
  font-size: 11px;
  line-height: 1;
}

.auth-form-panel :deep(.auth-secondary),
.auth-form-panel :deep(.auth-alternatives .btn-secondary) {
  height: 32px !important;
  min-height: 32px !important;
  border: 1px solid var(--auth-control-line) !important;
  border-radius: 6px !important;
  background: #fff !important;
  color: var(--auth-control-text) !important;
  font-size: 12px;
  box-shadow: none !important;
}

.auth-form-panel :deep(.auth-secondary:hover:not(:disabled)),
.auth-form-panel :deep(.auth-alternatives .btn-secondary:hover:not(:disabled)) {
  border-color: #b8b1aa !important;
  background: var(--auth-control-beige) !important;
}

.auth-form-panel__footer {
  margin-top: 28px;
  color: var(--auth-control-muted);
  font-size: 14px;
  text-align: center;
}

.auth-form-panel__footer :deep(.auth-register-footer) {
  margin: 0;
}

.auth-form-panel__footer :deep(.auth-text-link),
.auth-form-panel :deep(.auth-text-link) {
  margin-left: 4px;
  color: var(--auth-control-text);
  font-size: 13px;
  font-weight: 600;
  text-decoration-line: underline;
  text-decoration-color: #c7c0ba;
  text-underline-offset: 4px;
}

.auth-form-panel__footer :deep(.auth-text-link:hover),
.auth-form-panel :deep(.auth-text-link:hover) {
  text-decoration-color: var(--auth-control-text);
}

:global(.dark) .auth-form-panel {
  --auth-control-text: #f5f3f0;
  --auth-control-muted: #aaa49d;
  --auth-control-soft: #77716b;
  --auth-control-line: #393632;
  --auth-control-line-soft: #2c2926;
  --auth-control-beige: #24211e;
}

:global(.dark) .auth-form-panel :deep(.auth-secondary),
:global(.dark) .auth-form-panel :deep(.auth-alternatives .btn-secondary) {
  background: #111110 !important;
}

@media (max-width: 640px) {
  .auth-form-panel__heading {
    margin-bottom: 22px;
    padding-bottom: 16px;
  }
}
</style>
