<template><component :is="to ? RouterLink : 'a'" :to="to" :href="to ? undefined : href" :target="external ? '_blank' : undefined" :rel="external ? 'noopener noreferrer' : undefined" class="ui-link ui-focus-ring"><slot /><Icon v-if="external" name="externalLink" size="xs" /></component></template>
<script setup lang="ts">

import { RouterLink } from 'vue-router';
import type { RouteLocationRaw } from 'vue-router';
import Icon from '@/components/icons/Icon.vue';
defineProps<{to?:RouteLocationRaw;
href?:string;
external?:boolean}>()

</script>
<style scoped>.ui-link{display:inline-flex;
align-items:center;
gap:4px;
color:var(--ui-text);
font-size:inherit;
font-weight:600;
text-decoration-line:underline;
text-decoration-color:var(--ui-border);
text-underline-offset:3px}.ui-link:hover{text-decoration-color:currentColor}</style>
