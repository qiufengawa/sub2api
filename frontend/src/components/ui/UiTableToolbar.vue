<template><div class="ui-table-toolbar"><div class="ui-table-toolbar__primary"><slot/></div><div v-if="$slots.actions" class="ui-table-toolbar__actions"><slot name="actions"/></div></div></template>
<style scoped>.ui-table-toolbar{display:flex;
min-height:44px;
align-items:center;
justify-content:space-between;
gap:12px;
padding:6px 0}.ui-table-toolbar__primary,.ui-table-toolbar__actions{display:flex;
min-width:0;
align-items:center;
gap:8px}.ui-table-toolbar__primary{flex:1}.ui-table-toolbar__actions{flex:none}@media(max-width:640px){.ui-table-toolbar{align-items:stretch;
flex-direction:column}.ui-table-toolbar__actions{justify-content:flex-end}}</style>
