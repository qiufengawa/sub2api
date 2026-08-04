import { computed, defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const playgroundHarness = vi.hoisted(() => ({
  usePlayground: vi.fn(),
}))

vi.mock('@/composables/usePlayground', () => ({
  usePlayground: playgroundHarness.usePlayground,
  isPlaygroundImageModel: (model: string) => /(^|[/:])gpt-image(?:-|$)/i.test(model),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 7 } }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

import PlaygroundView from '../PlaygroundView.vue'

function activeKey() {
  return {
    id: 1,
    name: 'A very long production API key name',
    status: 'active',
    group_id: 10,
    group_name: 'OpenAI subscription group',
    platform: 'openai',
  }
}

function createState() {
  const config = ref({
    keyId: 1,
    model: 'gpt-test',
    systemPrompt: '',
    stream: true,
    temperature: 0.7,
    top_p: 1,
    max_tokens: 4096,
    frequency_penalty: 0,
    presence_penalty: 0,
    seed: null,
    imageSize: '1024x1024' as const,
    imageQuality: 'auto' as const,
    imageFormat: 'png' as const,
    imageCount: 1,
    parameterEnabled: {
      temperature: false,
      top_p: false,
      max_tokens: false,
      frequency_penalty: false,
      presence_penalty: false,
      seed: false,
    },
  })
  const keys = ref<ReturnType<typeof activeKey>[]>([])
  const messages = ref<any[]>([])
  const isImageMode = computed(() => /^gpt-image-/.test(config.value.model))
  return {
    config,
    messages,
    keys,
    keysTruncated: ref(false),
    models: ref([{ id: 'gpt-test' }]),
    selectedKey: computed(() => keys.value.find((key) => key.id === config.value.keyId) || null),
    isImageMode,
    canSend: ref(true),
    parameterErrors: ref<string[]>([]),
    isLoadingKeys: ref(false),
    isLoadingModels: ref(false),
    isGenerating: ref(false),
    optionsError: ref(''),
    storageWarning: ref(false),
    requestPreview: ref('{"model":"gpt-test"}'),
    loadKeys: vi.fn().mockResolvedValue(undefined),
    selectKey: vi.fn(),
    submit: vi.fn(),
    stop: vi.fn(),
    regenerate: vi.fn(),
    editAndResend: vi.fn(),
    deleteMessage: vi.fn(),
    clearMessages: vi.fn(),
  }
}

const ComposerStub = defineComponent({
  name: 'PlaygroundComposer',
  props: ['modelValue', 'keyId', 'keyOptions', 'modelOptions', 'selectedKey', 'model', 'stream', 'imageMode'],
  emits: [
    'update:modelValue',
    'submit',
    'stop',
    'selectKey',
    'selectModel',
    'updateStream',
    'openParameters',
    'openPreview',
    'newConversation',
  ],
  template: `
    <div data-test="composer">
      <button data-test="composer-submit" @click="$emit('submit', 'hello')">send</button>
      <button data-test="composer-stop" @click="$emit('stop')">stop</button>
      <button data-test="composer-key" @click="$emit('selectKey', 2)">key</button>
      <button data-test="composer-model" @click="$emit('selectModel', 'gpt-next')">model</button>
      <button data-test="composer-stream" @click="$emit('updateStream', false)">stream</button>
      <button data-test="composer-parameters" @click="$emit('openParameters')">parameters</button>
      <button data-test="composer-preview" @click="$emit('openPreview')">preview</button>
      <button data-test="composer-new" @click="$emit('newConversation')">new</button>
    </div>
  `,
})

const MessageStub = defineComponent({
  name: 'PlaygroundMessage',
  props: ['message', 'disabled'],
  emits: ['edit', 'regenerate', 'delete'],
  template: `
    <div data-test="message">
      <button data-test="message-edit" @click="$emit('edit', 'updated message')">edit</button>
      <button data-test="message-regenerate" @click="$emit('regenerate')">regenerate</button>
      <button data-test="message-delete" @click="$emit('delete')">delete</button>
    </div>
  `,
})

const scrollToMock = vi.fn()

function mountView() {
  return mount(PlaygroundView, {
    global: {
      stubs: {
        AppLayout: { template: '<main><slot /></main>' },
        Icon: true,
        LoadingSpinner: { template: '<div data-test="loading"></div>' },
        Select: { template: '<div data-test="select"></div>' },
        Toggle: { template: '<button type="button" data-test="toggle"></button>' },
        PlaygroundComposer: ComposerStub,
        PlaygroundMessage: MessageStub,
        PlaygroundParametersPanel: {
          props: ['show', 'modelValue'],
          emits: ['close', 'update:modelValue'],
          template: '<div v-if="show" data-test="parameters"></div>',
        },
        PlaygroundRequestPreview: {
          props: ['show', 'content'],
          emits: ['close'],
          template: '<div v-if="show" data-test="preview">{{ content }}</div>',
        },
        ConfirmDialog: {
          props: ['show'],
          emits: ['confirm', 'cancel'],
          template: '<div v-if="show" data-test="confirm"><button data-test="confirm-clear" @click="$emit(\'confirm\')">confirm</button></div>',
        },
        RouterLink: {
          props: ['to'],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  })
}

describe('PlaygroundView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scrollToMock.mockClear()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollToMock,
    })
  })

  it('loads keys and links the empty state to API key creation', async () => {
    const state = createState()
    playgroundHarness.usePlayground.mockReturnValue(state)

    const wrapper = mountView()
    await flushPromises()

    expect(playgroundHarness.usePlayground).toHaveBeenCalledWith(7)
    expect(state.loadKeys).toHaveBeenCalledOnce()
    expect(wrapper.find('a[href="/keys"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('playground.empty.noKeys')
  })

  it('shows option errors and retries key loading', async () => {
    const state = createState()
    state.optionsError.value = 'Network unavailable'
    playgroundHarness.usePlayground.mockReturnValue(state)

    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Network unavailable')

    const retry = wrapper.findAll('button').find((button) => button.text() === 'common.retry')
    expect(retry).toBeTruthy()
    await retry!.trigger('click')
    expect(state.loadKeys).toHaveBeenCalledTimes(2)
  })

  it('shows truncation, previews the request, and confirms clearing messages', async () => {
    const state = createState()
    state.keys.value = [activeKey()]
    state.keysTruncated.value = true
    state.messages.value = [{
      id: 'user-1',
      role: 'user',
      content: 'hello',
      status: 'complete',
      createdAt: 1,
    }]
    playgroundHarness.usePlayground.mockReturnValue(state)

    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('playground.notices.keysTruncated')

    expect(wrapper.find('header').exists()).toBe(false)
    await wrapper.get('[data-test="composer-preview"]').trigger('click')
    expect(wrapper.get('[data-test="preview"]').text()).toContain('gpt-test')

    await wrapper.get('[data-test="composer-parameters"]').trigger('click')
    expect(wrapper.get('[data-test="parameters"]').exists()).toBe(true)

    await wrapper.get('[data-test="composer-new"]').trigger('click')
    await wrapper.get('[data-test="confirm-clear"]').trigger('click')
    expect(state.clearMessages).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-test="confirm"]').exists()).toBe(false)
  })

  it('forwards send and stop actions from the composer', async () => {
    const state = createState()
    state.keys.value = [activeKey()]
    playgroundHarness.usePlayground.mockReturnValue(state)

    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-test="composer-submit"]').trigger('click')
    await wrapper.get('[data-test="composer-stop"]').trigger('click')

    expect(state.submit).toHaveBeenCalledWith('hello')
    expect(state.stop).toHaveBeenCalledOnce()
  })

  it('keeps key, model, and stream selection wired through the composer', async () => {
    const state = createState()
    state.keys.value = [activeKey(), { ...activeKey(), id: 2 }]
    playgroundHarness.usePlayground.mockReturnValue(state)

    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('[data-test="composer-key"]').trigger('click')
    await wrapper.get('[data-test="composer-model"]').trigger('click')
    await wrapper.get('[data-test="composer-stream"]').trigger('click')

    expect(state.selectKey).toHaveBeenCalledWith(2)
    expect(state.config.value.model).toBe('gpt-next')
    expect(state.config.value.stream).toBe(false)
  })

  it('forwards message actions and keeps following appended output', async () => {
    const state = createState()
    state.keys.value = [activeKey()]
    state.messages.value = [{
      id: 'user-1',
      role: 'user',
      content: 'hello',
      status: 'complete',
      createdAt: 1,
    }]
    playgroundHarness.usePlayground.mockReturnValue(state)

    const wrapper = mountView()
    await flushPromises()
    scrollToMock.mockClear()

    await wrapper.get('[data-test="message-edit"]').trigger('click')
    await wrapper.get('[data-test="message-regenerate"]').trigger('click')
    await wrapper.get('[data-test="message-delete"]').trigger('click')

    expect(state.editAndResend).toHaveBeenCalledWith(0, 'updated message')
    expect(state.regenerate).toHaveBeenCalledWith(0)
    expect(state.deleteMessage).toHaveBeenCalledWith(0)

    state.messages.value.push({
      id: 'assistant-1',
      role: 'assistant',
      content: 'answer',
      status: 'complete',
      createdAt: 2,
    })
    await flushPromises()
    expect(scrollToMock).toHaveBeenCalled()
  })
})
