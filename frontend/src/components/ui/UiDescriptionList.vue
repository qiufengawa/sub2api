<template><dl class="ui-description-list" :class="`ui-description-list--${columns}`"><div v-for="item in items" :key="item.label"><dt>{{ item.label }}</dt><dd :class="{'ui-numeric':item.numeric}"><slot :name="item.key||item.label" :item="item">{{ item.value }}</slot></dd></div></dl></template>
<script setup lang="ts">
withDefaults(defineProps<{items:Array<{key?:string;
label:string;
value:string|number;
numeric?:boolean}>;
columns?:1|2|3}>(),{columns:2})
</script>
<style scoped>.ui-description-list{display:grid;
grid-template-columns:repeat(2,minmax(0,1fr));
margin:0;
border-top:1px solid var(--ui-border-soft)}.ui-description-list--1{grid-template-columns:1fr}.ui-description-list--3{grid-template-columns:repeat(3,minmax(0,1fr))}.ui-description-list>div{display:grid;
grid-template-columns:minmax(90px,.7fr) minmax(0,1fr);
gap:12px;
padding:10px 0;
border-bottom:1px solid var(--ui-border-soft)}.ui-description-list dt{color:var(--ui-text-soft);
font-size:11px}.ui-description-list dd{min-width:0;
margin:0;
color:var(--ui-text);
font-size:12px;
overflow-wrap:anywhere}@media(max-width:640px){.ui-description-list{grid-template-columns:1fr}}</style>
