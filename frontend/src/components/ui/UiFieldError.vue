<template><p class="ui-field-error" role="alert"><Icon name="exclamationCircle" size="xs" /><span>{{ message }}</span></p></template>
<script setup lang="ts">

import Icon from '@/components/icons/Icon.vue';
defineProps<{message:string}>()

</script>
<style scoped>.ui-field-error{display:flex;
align-items:flex-start;
gap:4px;
margin:0;
color:var(--ui-danger);
font-size:11px;
line-height:16px}</style>
