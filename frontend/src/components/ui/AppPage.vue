<template><main class="app-page" :class="[`app-page--${width}`,`app-page--${density}`]"><slot/></main></template>
<script setup lang="ts">
withDefaults(defineProps<{width?:'normal'|'wide'|'full';
density?:'comfortable'|'compact'}>(),{width:'wide',density:'comfortable'})
</script>
<style scoped>.app-page{width:100%;
margin:0;
color:var(--ui-text)}.app-page--normal,.app-page--wide,.app-page--full{max-width:none}.app-page--comfortable{padding:16px}.app-page--compact{padding:12px 16px 32px}@media(max-width:640px){.app-page--comfortable,.app-page--compact{padding:12px 12px 28px}}</style>
