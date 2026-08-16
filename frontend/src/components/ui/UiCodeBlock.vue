<template><div class="ui-code-block"><div v-if="label" class="ui-code-block__head"><span>{{ label }}</span><UiCopyButton :value="code" :label="copyLabel" :success-text="copySuccessText" variant="ghost" @error="emit('copyError',$event)"/></div><pre><code>{{ code }}</code></pre></div></template>
<script setup lang="ts">
import UiCopyButton from './UiCopyButton.vue';
defineProps<{code:string;
label?:string;
copyLabel?:string;
copySuccessText?:string}>()
const emit=defineEmits<{copyError:[unknown]}>()
</script>
<style scoped>.ui-code-block{overflow:hidden;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
background:#171615;
color:#f5f3f0}.ui-code-block__head{display:flex;
height:32px;
align-items:center;
justify-content:space-between;
padding:0 6px 0 10px;
border-bottom:1px solid #373431;
color:#aaa49d;
font-size:10px}.ui-code-block pre{max-width:100%;
margin:0;
padding:12px;
overflow:auto}.ui-code-block code{font-family:var(--ui-font-mono);
font-size:11px;
line-height:18px;
white-space:pre}</style>
