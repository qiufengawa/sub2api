<template>
  <div class="geetest-captcha-wrapper">
    <button
      ref="buttonRef"
      type="button"
      class="geetest-captcha-button"
      :disabled="state === 'loading' || state === 'verified'"
      @click="open"
    >
      <span v-if="state === 'verified'">✓ {{ verifiedText }}</span>
      <span v-else-if="state === 'loading'">{{ loadingText }}</span>
      <span v-else>{{ buttonText }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

export interface GeetestCaptchaProof {
  lot_number: string
  captcha_output: string
  pass_token: string
  gen_time: string
}

declare global {
  interface Window {
    initGeetest4?: (
      config: { captchaId: string; product?: 'popup' | 'float' | 'bind' },
      callback: (captcha: GeetestInstance) => void
    ) => void
  }
}

interface GeetestInstance {
  appendTo?: (target: HTMLElement | string) => void
  onReady?: (callback: () => void) => void
  onSuccess?: (callback: () => void) => void
  onError?: (callback: (error?: unknown) => void) => void
  onClose?: (callback: () => void) => void
  getValidate?: () => GeetestCaptchaProof | false
  reset?: () => void
  destroy?: () => void
  showCaptcha?: () => void
}

const props = withDefaults(defineProps<{
  captchaId: string
  buttonText?: string
  loadingText?: string
  verifiedText?: string
}>(), {
  buttonText: '验证后继续',
  loadingText: '验证码加载中…',
  verifiedText: '验证通过'
})

const emit = defineEmits<{
  verify: [proof: GeetestCaptchaProof]
  expire: []
  error: []
}>()

const buttonRef = ref<HTMLButtonElement | null>(null)
const state = ref<'idle' | 'loading' | 'verified'>('loading')
let captcha: GeetestInstance | null = null
let pending: { resolve: (proof: GeetestCaptchaProof | null) => void; reject: (error: unknown) => void } | null = null
let scriptPromise: Promise<void> | null = null
let lastProof: GeetestCaptchaProof | null = null
const scriptSrc = 'https://static.geetest.com/v4/gt4.js'

function loadScript(): Promise<void> {
  if (window.initGeetest4) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('GeeTest script failed to load')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = scriptSrc
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('GeeTest script failed to load'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

function init(): void {
  if (!props.captchaId || !window.initGeetest4) {
    state.value = 'idle'
    return
  }
  window.initGeetest4({ captchaId: props.captchaId, product: 'popup' }, (instance) => {
    captcha = instance
    instance.onReady?.(() => { state.value = 'idle' })
    instance.onSuccess?.(() => {
      const proof = instance.getValidate?.()
      if (!proof) {
        state.value = 'idle'
        emit('error')
        pending?.reject(new Error('GeeTest proof is empty'))
        pending = null
        return
      }
      state.value = 'verified'
      lastProof = proof
      emit('verify', proof)
      pending?.resolve(proof)
      pending = null
    })
    instance.onError?.((error) => {
      state.value = 'idle'
      lastProof = null
      emit('error')
      pending?.reject(error ?? new Error('GeeTest verification failed'))
      pending = null
    })
    instance.onClose?.(() => {
      const completed = state.value === 'verified'
      if (!completed) {
        state.value = 'idle'
        lastProof = null
      }
      pending?.resolve(null)
      pending = null
    })
  })
}

function open(): Promise<GeetestCaptchaProof | null> {
  // A successful proof is emitted immediately when the user completes the
  // visible GeeTest challenge. Reuse it when the form submits afterwards;
  // opening the widget a second time would otherwise return null and abort
  // the login request before it reaches the backend.
  if (state.value === 'verified') return Promise.resolve(lastProof)
  if (pending) return new Promise((resolve, reject) => {
    const original = pending
    pending = {
      resolve: (proof) => { original?.resolve(proof); resolve(proof) },
      reject: (error) => { original?.reject(error); reject(error) }
    }
  })
  if (!captcha) {
    emit('error')
    return Promise.resolve(null)
  }
  state.value = 'loading'
  return new Promise((resolve, reject) => {
    pending = { resolve, reject }
    captcha?.showCaptcha?.()
  })
}

function reset(): void {
  captcha?.reset?.()
  state.value = 'idle'
  lastProof = null
  pending?.resolve(null)
  pending = null
}

onMounted(() => {
  void loadScript().then(init).catch(() => {
    state.value = 'idle'
    emit('error')
  })
})
onBeforeUnmount(() => {
  pending?.resolve(null)
  pending = null
  lastProof = null
  captcha?.destroy?.()
  captcha = null
})

defineExpose({ verify: open, reset })
</script>

<style scoped>
.geetest-captcha-wrapper { width: 100%; }
.geetest-captcha-button {
  min-height: 36px;
  width: 100%;
  border: 1px solid var(--ui-border-default, #d1d5db);
  border-radius: 8px;
  background: var(--ui-surface-muted, #f9fafb);
  color: var(--ui-text-secondary, #4b5563);
  font: inherit;
  cursor: pointer;
}
.geetest-captcha-button:disabled { cursor: default; opacity: .75; }
</style>
