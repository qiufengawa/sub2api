import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BatchImageGuideView from '@/views/user/BatchImageGuideView.vue'
import { UiFileUpload, UiSearchInput } from '@/components/ui'
import type { BatchImageJob } from '@/api/batchImage'

const mocks = vi.hoisted(() => ({
  keyList: vi.fn(),
  listJobs: vi.fn(),
  listModels: vi.fn(),
  submitJob: vi.fn(),
  getJob: vi.fn(),
  listItems: vi.fn(),
  cancelJob: vi.fn(),
  deleteJob: vi.fn(),
  downloadZip: vi.fn(),
  getItemContent: vi.fn(),
  saveBlob: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  fetchPublicSettings: vi.fn(),
  copy: vi.fn(),
}))

vi.mock('@/api', () => ({
  keysAPI: { list: (...args: unknown[]) => mocks.keyList(...args) },
}))

vi.mock('@/api/batchImage', () => ({
  listBatchImageJobs: (...args: unknown[]) => mocks.listJobs(...args),
  listBatchImageModels: (...args: unknown[]) => mocks.listModels(...args),
  submitBatchImageJob: (...args: unknown[]) => mocks.submitJob(...args),
  getBatchImageJob: (...args: unknown[]) => mocks.getJob(...args),
  listBatchImageItems: (...args: unknown[]) => mocks.listItems(...args),
  cancelBatchImageJob: (...args: unknown[]) => mocks.cancelJob(...args),
  deleteBatchImageJobRecord: (...args: unknown[]) => mocks.deleteJob(...args),
  downloadBatchImageZip: (...args: unknown[]) => mocks.downloadZip(...args),
  getBatchImageItemContent: (...args: unknown[]) => mocks.getItemContent(...args),
  saveBlob: (...args: unknown[]) => mocks.saveBlob(...args),
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    apiBaseUrl: 'http://localhost:18083',
    showError: mocks.showError,
    showSuccess: mocks.showSuccess,
    fetchPublicSettings: mocks.fetchPublicSettings,
  }),
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({ copyToClipboard: mocks.copy }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      locale: ref('zh-CN'),
      t: (key: string, params?: Record<string, unknown>) => {
        if (!params) return key
        return `${key} ${Object.values(params).join(' ')}`
      },
    }),
  }
})

function makeKey(id: number, key = `key-${id}`) {
  return {
    id,
    key,
    name: `Gemini ${id}`,
    status: 'active',
    group: {
      id,
      name: `Gemini group ${id}`,
      platform: 'gemini',
      allow_batch_image_generation: true,
    },
  }
}

function makeJob(id: string, createdAt: number, overrides: Partial<BatchImageJob> = {}): BatchImageJob {
  return {
    id,
    object: 'image.batch',
    task_name: id,
    parent_batch_id: null,
    status: 'completed',
    model: 'gemini-3-pro-image',
    provider: 'gemini_api',
    item_count: 1,
    success_count: 1,
    fail_count: 0,
    estimated_cost: 1,
    hold_amount: 1,
    actual_cost: 1,
    created_at: createdAt,
    submitted_at: createdAt,
    settled_at: createdAt,
    downloaded_at: null,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function findButton(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find(item => item.text().includes(text))
  if (!button) throw new Error(`Button not found: ${text}`)
  return button
}

function mountView() {
  return mount(BatchImageGuideView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Teleport: true,
      },
    },
  })
}

describe('BatchImageGuideView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.keyList.mockResolvedValue({ items: [makeKey(1)] })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [], has_more: false })
    mocks.listModels.mockResolvedValue({ data: [{ id: 'gemini-3-pro-image', provider: 'gemini_api' }] })
    mocks.listItems.mockResolvedValue({ object: 'list', data: [], has_more: false })
    mocks.fetchPublicSettings.mockResolvedValue(undefined)
  })

  it('queries every eligible API key concurrently, merges rows, and sorts newest first', async () => {
    mocks.keyList.mockResolvedValue({ items: [makeKey(1), makeKey(2)] })
    mocks.listJobs.mockImplementation((apiKey: string) => Promise.resolve({
      object: 'list',
      data: apiKey === 'key-1' ? [makeJob('older-job', 100)] : [makeJob('newer-job', 200)],
      has_more: false,
    }))

    const wrapper = mountView()
    await flushPromises()

    expect(mocks.listJobs).toHaveBeenCalledTimes(2)
    expect(mocks.listJobs.mock.calls.map(call => call[0])).toEqual(['key-1', 'key-2'])
    expect(wrapper.text().indexOf('newer-job')).toBeLessThan(wrapper.text().indexOf('older-job'))
    wrapper.unmount()
  })

  it('keeps the newest list result when an earlier request resolves last', async () => {
    const stale = deferred<{ object: string; data: BatchImageJob[]; has_more: boolean }>()
    mocks.listJobs
      .mockImplementationOnce(() => stale.promise)
      .mockResolvedValueOnce({ object: 'list', data: [makeJob('fresh-job', 300)], has_more: false })

    const wrapper = mountView()
    await flushPromises()
    wrapper.getComponent(UiSearchInput).vm.$emit('search', 'fresh')
    await flushPromises()

    expect(wrapper.text()).toContain('fresh-job')
    stale.resolve({ object: 'list', data: [makeJob('stale-job', 100)], has_more: false })
    await flushPromises()
    expect(wrapper.text()).toContain('fresh-job')
    expect(wrapper.text()).not.toContain('stale-job')
    wrapper.unmount()
  })

  it('submits a fixed 1K payload with a unique idempotency key', async () => {
    mocks.submitJob.mockResolvedValue(makeJob('submitted-job', 400, { status: 'queued', success_count: 0, actual_cost: null }))
    const wrapper = mountView()
    await flushPromises()

    await findButton(wrapper, 'batchImage.actions.createJob').trigger('click')
    await flushPromises()
    wrapper.getComponent(UiFileUpload).vm.$emit('select', [
      new File(['abc'], 'reference.png', { type: 'image/png' }),
    ])
    await vi.waitFor(() => expect(wrapper.text()).toContain('reference.png'))
    await wrapper.get('textarea').setValue('A clean studio product photo')
    await findButton(wrapper, 'common.add').trigger('click')
    await findButton(wrapper, 'batchImage.actions.submitJob').trigger('click')
    await flushPromises()

    expect(mocks.submitJob).toHaveBeenCalledOnce()
    const [apiKey, payload, idempotencyKey] = mocks.submitJob.mock.calls[0]
    expect(apiKey).toBe('key-1')
    expect(payload).toMatchObject({
      model: 'gemini-3-pro-image',
      image_size: '1K',
      response_mime_type: 'image/png',
      items: [{
        custom_id: 'img_001',
        prompt: 'A clean studio product photo',
        reference_images: [{
          id: 'reference.png',
          type: 'reference',
          mime_type: 'image/png',
          data: 'YWJj',
        }],
      }],
    })
    expect(idempotencyKey).toMatch(/^sub2api-ui-/)
    wrapper.unmount()
  })

  it('keeps detail and item state on the latest selected job', async () => {
    const staleJob = deferred<BatchImageJob>()
    const staleItems = deferred<{ object: string; data: never[]; has_more: boolean }>()
    const jobA = makeJob('job-a', 410)
    const jobB = makeJob('job-b', 420)
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [jobB, jobA], has_more: false })
    mocks.getJob.mockImplementation((_apiKey: string, batchId: string) =>
      batchId === 'job-a' ? staleJob.promise : Promise.resolve(jobB),
    )
    mocks.listItems.mockImplementation((_apiKey: string, batchId: string) =>
      batchId === 'job-a'
        ? staleItems.promise
        : Promise.resolve({ object: 'list', data: [], has_more: false }),
    )

    const wrapper = mountView()
    await flushPromises()
    const jobButtons = wrapper.findAll('.batch-job-name__button')
    await jobButtons.find(button => button.text().includes('job-a'))!.trigger('click')
    await jobButtons.find(button => button.text().includes('job-b'))!.trigger('click')
    await flushPromises()

    expect(wrapper.get('.batch-detail__header').text()).toContain('job-b')
    staleJob.resolve(jobA)
    staleItems.resolve({ object: 'list', data: [], has_more: false })
    await flushPromises()
    expect(wrapper.get('.batch-detail__header').text()).toContain('job-b')
    expect(wrapper.get('.batch-detail__header').text()).not.toContain('job-a')
    wrapper.unmount()
  })

  it('requires the shared confirmation dialog before deleting a terminal job', async () => {
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [makeJob('delete-me', 500)], has_more: false })
    mocks.deleteJob.mockResolvedValue(undefined)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('button[aria-label="batchImage.actions.deleteRecords"]').trigger('click')
    expect(mocks.deleteJob).not.toHaveBeenCalled()
    await findButton(wrapper, 'common.confirm').trigger('click')
    await flushPromises()

    expect(mocks.deleteJob).toHaveBeenCalledWith('key-1', 'delete-me')
    expect(wrapper.text()).not.toContain('delete-me')
    wrapper.unmount()
  })
})
