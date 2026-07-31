import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PlanImportDialog from '../PlanImportDialog.vue'
import type { AdminGroup } from '@/types'
import type { PaymentCatalogImportPreview } from '@/types/payment'

const {
  previewCatalogImport,
  applyCatalogImport,
  getModelsListCandidates,
  listCompositeRoutes,
  showError,
  showSuccess,
  showWarning,
} = vi.hoisted(() => ({
  previewCatalogImport: vi.fn(),
  applyCatalogImport: vi.fn(),
  getModelsListCandidates: vi.fn(),
  listCompositeRoutes: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  default: {
    groups: {
      getModelsListCandidates,
      listCompositeRoutes,
    },
  },
}))

vi.mock('@/api/admin/payment', () => ({
  adminPaymentAPI: {
    previewCatalogImport,
    applyCatalogImport,
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({ showError, showSuccess, showWarning }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => params ? `${key} ${JSON.stringify(params)}` : key,
    te: () => false,
  }),
}))

const BaseDialogStub = defineComponent({
  props: { show: Boolean },
  emits: ['close'],
  template: '<div v-if="show"><slot /><slot name="footer" /></div>',
})

const catalogJSON = JSON.stringify({
  schema_version: 1,
  mode: 'upsert',
  defaults: {},
  groups: [{ key: 'lite', name: 'Lite' }],
  plans: [{ group_key: 'lite', name: 'Lite', price: 12.9 }],
})

function previewFixture(canApply = true): PaymentCatalogImportPreview {
  return {
    preview_token: 'preview-token',
    can_apply: canApply,
    summary: {
      groups_created: 1,
      groups_updated: 0,
      groups_unchanged: 0,
      plans_created: 1,
      plans_updated: 0,
      plans_unchanged: 0,
      routes_created: 0,
      routes_updated: 0,
      routes_unchanged: 0,
      bindings_added: 0,
      settings_updated: 0,
    },
    changes: [{ kind: 'group', action: 'create', key: 'lite', name: 'Lite' }],
    issues: canApply ? [] : [{ severity: 'error', code: 'ACCOUNT_SOURCE_NOT_FOUND', message: 'missing source' }],
  }
}

function mountDialog(groups: AdminGroup[] = []) {
  return mount(PlanImportDialog, {
    props: { show: true, groups },
    global: {
      stubs: {
        BaseDialog: BaseDialogStub,
        Icon: true,
      },
    },
  })
}

async function dropFile(wrapper: ReturnType<typeof mountDialog>, file: File) {
  await (wrapper.vm as unknown as { selectFile: (source: File) => Promise<void> }).selectFile(file)
  await flushPromises()
}

describe('PlanImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    previewCatalogImport.mockResolvedValue({ data: previewFixture() })
    applyCatalogImport.mockResolvedValue({ data: { summary: previewFixture().summary } })
    getModelsListCandidates.mockResolvedValue([])
    listCompositeRoutes.mockResolvedValue([])
  })

  it('rejects dangerous JSON keys before calling the backend', async () => {
    const wrapper = mountDialog()
    const dangerous = new File([
      '{"schema_version":1,"mode":"upsert","defaults":{},"groups":[],"plans":[],"__proto__":{"polluted":true}}',
    ], 'dangerous.json', { type: 'application/json' })

    await dropFile(wrapper, dangerous)

    expect(previewCatalogImport).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('payment.admin.catalogImport.dangerousField')
  })

  it('previews a valid file and applies exactly the confirmed payload', async () => {
    const wrapper = mountDialog()
    await dropFile(wrapper, new File([catalogJSON], 'catalog.json', { type: 'application/json' }))

    expect(previewCatalogImport).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('payment.admin.catalogImport.previewTitle')

    const confirm = wrapper.findAll('button').find(button => button.text().includes('payment.admin.catalogImport.confirmApply'))
    expect(confirm).toBeTruthy()
    await confirm!.trigger('click')
    await flushPromises()

    expect(applyCatalogImport).toHaveBeenCalledWith(JSON.parse(catalogJSON), 'preview-token')
    expect(showSuccess).toHaveBeenCalled()
    expect(wrapper.emitted('imported')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('normalizes null preview collections returned by an older backend', async () => {
    previewCatalogImport.mockResolvedValue({
      data: {
        ...previewFixture(),
        issues: null,
        changes: null,
      },
    })
    const wrapper = mountDialog()

    await dropFile(wrapper, new File([catalogJSON], 'catalog.json', { type: 'application/json' }))

    expect(wrapper.text()).toContain('payment.admin.catalogImport.previewTitle')
    expect(wrapper.text()).toContain('payment.admin.catalogImport.noChanges')
    expect(wrapper.text()).toContain('payment.admin.catalogImport.confirmApply')
  })

  it('previews pasted JSON and invalidates that preview when the text changes', async () => {
    const wrapper = mountDialog()
    const pasteMode = wrapper.findAll('button').find(button => button.text().includes('payment.admin.catalogImport.pasteMode'))
    expect(pasteMode).toBeTruthy()
    await pasteMode!.trigger('click')

    const textarea = wrapper.get('textarea')
    await textarea.setValue(catalogJSON)
    const previewButton = wrapper.findAll('button').find(button => button.text().includes('payment.admin.catalogImport.previewPaste'))
    expect(previewButton).toBeTruthy()
    await previewButton!.trigger('click')
    await flushPromises()

    expect(previewCatalogImport).toHaveBeenCalledWith(JSON.parse(catalogJSON))
    expect(wrapper.text()).toContain('payment.admin.catalogImport.confirmApply')

    await textarea.setValue(`${catalogJSON} `)
    expect(wrapper.text()).not.toContain('payment.admin.catalogImport.confirmApply')
  })

  it('personalizes the pasted five-tier template with local account groups before preview', async () => {
    const fiveTierCatalog = {
      schema_version: 1,
      mode: 'upsert',
      defaults: { platform: 'composite' },
      groups: ['lite', 'starter', 'standard', 'pro', 'max'].map(key => ({
        key,
        name: `${key} subscription`,
        copy_accounts_from: [],
      })),
      plans: ['lite', 'starter', 'standard', 'pro', 'max'].map((groupKey, index) => ({
        group_key: groupKey,
        name: groupKey,
        price: index + 1,
      })),
    }
    getModelsListCandidates.mockResolvedValue(['gpt-5.1', 'deepseek-v3'])
    const wrapper = mountDialog([{
      id: 8,
      name: 'OpenAI 主池',
      status: 'active',
      account_count: 2,
      platform: 'openai',
    } as AdminGroup])

    const pasteMode = wrapper.findAll('button').find(button => button.text().includes('payment.admin.catalogImport.pasteMode'))
    await pasteMode!.trigger('click')
    await wrapper.get('textarea').setValue(JSON.stringify(fiveTierCatalog))
    const previewButton = wrapper.findAll('button').find(button => button.text().includes('payment.admin.catalogImport.previewPaste'))
    await previewButton!.trigger('click')
    await flushPromises()

    const submitted = previewCatalogImport.mock.calls[0][0]
    expect(submitted.groups.every((group: { copy_accounts_from: string[] }) => (
      group.copy_accounts_from[0] === 'OpenAI 主池'
    ))).toBe(true)
    expect(submitted.groups[0].routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ public_model: 'deepseek-v3', target_platform: 'openai' }),
    ]))
  })

  it('keeps apply disabled when the backend preview contains a blocking error', async () => {
    previewCatalogImport.mockResolvedValue({ data: previewFixture(false) })
    const wrapper = mountDialog()
    await dropFile(wrapper, new File([catalogJSON], 'blocked.json', { type: 'application/json' }))

    const confirm = wrapper.findAll('button').find(button => button.text().includes('payment.admin.catalogImport.confirmApply'))
    expect(confirm?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('missing source')
    expect(applyCatalogImport).not.toHaveBeenCalled()
  })

  it('does not restore an old preview after a newer file selection invalidates it', async () => {
    let resolveSlowRead: ((value: string) => void) | undefined
    const slowRead = new Promise<string>((resolve) => { resolveSlowRead = resolve })
    const slowFile = {
      name: 'slow.json',
      type: 'application/json',
      size: catalogJSON.length,
      text: () => slowRead,
    } as File
    const wrapper = mountDialog()

    const firstSelection = (wrapper.vm as unknown as { selectFile: (source: File) => Promise<void> }).selectFile(slowFile)
    await (wrapper.vm as unknown as { selectFile: (source: File) => Promise<void> }).selectFile(
      new File(['not-json'], 'invalid.txt', { type: 'text/plain' }),
    )
    resolveSlowRead?.(catalogJSON)
    await firstSelection
    await flushPromises()

    expect(previewCatalogImport).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('payment.admin.catalogImport.invalidType')
    expect(wrapper.text()).not.toContain('slow.json')
    expect(wrapper.text()).not.toContain('payment.admin.catalogImport.confirmApply')
  })
})
