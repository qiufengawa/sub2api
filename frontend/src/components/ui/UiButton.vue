<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    :type="to ? undefined : type"
    :disabled="to ? undefined : disabled || loading"
    :aria-busy="loading || undefined"
    class="ui-button ui-focus-ring ui-motion"
    :class="[`ui-button--${variant}`, `ui-button--${density}`, { 'ui-button--block': block }]"
  >
    <span v-if="loading" class="ui-button__spinner" aria-hidden="true" />
    <slot name="icon" />
    <span><slot /></span>
  </component>
</template>

<script setup lang="ts">


import { RouterLink } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import type { UiButtonVariant, UiDensity } from './types'

withDefaults(defineProps<{
  variant?: UiButtonVariant
  density?: UiDensity
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  block?: boolean
  to?: RouteLocationRaw
}>(), {
  variant: 'secondary', density: 'default', type: 'button', disabled: false, loading: false, block: false
})


</script>

<style scoped>
.ui-button { display:inline-flex;
align-items:center;
justify-content:center;
gap:4px;
padding:0 13px;
border:1px solid var(--ui-border);
border-radius:var(--ui-radius);
color:var(--ui-text);
background:var(--ui-surface);
font-size:13px;
font-weight:500;
line-height:1;
text-decoration:none;
cursor:pointer;
transition:background var(--ui-motion-fast),border-color var(--ui-motion-fast),color var(--ui-motion-fast),opacity var(--ui-motion-fast);
}
.ui-button--dense { height:var(--ui-control-dense);
padding-inline:10px;
}
.ui-button--mini { height:var(--ui-control-mini); padding-inline:8px; }
.ui-button--compact { height:var(--ui-control-compact);
}
.ui-button--default { height:var(--ui-control-default);
}
.ui-button--large { height:var(--ui-control-large); padding-inline:16px; }
.ui-button--block { width:100%;
}
.ui-button--primary { border-color:var(--ui-text);
color:var(--ui-inverse);
background:var(--ui-text);
}
.ui-button--primary:hover { opacity:.84;
}
.ui-button--secondary:hover { border-color:var(--ui-text-soft);
background:var(--ui-surface-muted);
}
.ui-button--quiet { border-color:transparent;
background:transparent;
}
.ui-button--quiet:hover { background:var(--ui-surface-muted);
}
.ui-button--danger { border-color:var(--ui-danger);
color:#fff;
background:var(--ui-danger);
}
.ui-button:disabled { cursor:not-allowed;
opacity:.45;
}
.ui-button__spinner { width:13px;
height:13px;
border:1.5px solid currentColor;
border-right-color:transparent;
border-radius:50%;
animation:ui-button-spin .7s linear infinite;
}
@keyframes ui-button-spin { to { transform:rotate(360deg);
} }
@media (prefers-reduced-motion:reduce) { .ui-button,.ui-button__spinner { transition:none;
animation:none;
} }
</style>
