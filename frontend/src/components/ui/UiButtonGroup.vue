<template><div class="ui-button-group" role="group" :aria-label="label"><slot /></div></template>
<script setup lang="ts">

defineProps<{ label?:string }>()

</script>
<style scoped>
.ui-button-group{display:inline-flex}.ui-button-group :deep(.ui-button),.ui-button-group :deep(.ui-icon-button){border-radius:0}.ui-button-group :deep(:first-child){border-radius:var(--ui-radius) 0 0 var(--ui-radius)}.ui-button-group :deep(:last-child){border-radius:0 var(--ui-radius) var(--ui-radius) 0}.ui-button-group :deep(:not(:first-child)){margin-left:-1px}
</style>
