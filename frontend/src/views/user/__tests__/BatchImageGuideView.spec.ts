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

  it('keeps per-key prefixes so global pages do not drop rows from another key', async () => {
    localStorage.setItem('table-page-size', '20')
    mocks.keyList.mockResolvedValue({ items: [makeKey(1), makeKey(2)] })
    const jobsByKey = {
      'key-1': Array.from({ length: 25 }, (_, index) => makeJob(`a-${index}`, 200 - index)),
      'key-2': Array.from({ length: 25 }, (_, index) => makeJob(`b-${index}`, 100 - index)),
    }
    mocks.listJobs.mockImplementation((apiKey: keyof typeof jobsByKey, options: { cursor?: string; limit?: number }) => {
      const offset = Number(options.cursor || 0)
      const limit = Number(options.limit || 20)
      const data = jobsByKey[apiKey].slice(offset, offset + limit)
      return Promise.resolve({
        object: 'list',
        data,
        has_more: offset + data.length < jobsByKey[apiKey].length,
      })
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('a-0')
    expect(wrapper.text()).not.toContain('b-0')

    await findButton(wrapper, 'pagination.next').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('a-24')
    expect(wrapper.text()).toContain('b-0')
    expect(wrapper.text()).toContain('b-14')
    expect(wrapper.text()).not.toContain('b-15')

    await findButton(wrapper, 'pagination.next').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('b-15')
    expect(wrapper.text()).toContain('b-24')

    const callsAfterPageThree = mocks.listJobs.mock.calls.length
    await findButton(wrapper, 'pagination.previous').trigger('click')
    await flushPromises()
    expect(mocks.listJobs).toHaveBeenCalledTimes(callsAfterPageThree)
    expect(wrapper.text()).toContain('b-0')
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

  it('deduplicates create-modal API key loading while the initial request is pending', async () => {
    const pending = deferred<{ items: ReturnType<typeof makeKey>[] }>()
    mocks.keyList.mockReturnValueOnce(pending.promise)

    const wrapper = mountView()
    await flushPromises()
    await findButton(wrapper, 'batchImage.actions.createJob').trigger('click')

    expect(mocks.keyList).toHaveBeenCalledOnce()
    pending.resolve({ items: [makeKey(1)] })
    await flushPromises()
    wrapper.unmount()
  })

  it('shows and retries a persistent API-key load failure instead of an empty job list', async () => {
    mocks.keyList.mockRejectedValueOnce(new Error('keys offline'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="batch-image-list-error"]').text()).toContain('batchImage.messages.loadKeysFailed')
    expect(wrapper.find('.ui-empty-state').exists()).toBe(false)

    await findButton(wrapper, 'common.retry').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="batch-image-list-error"]').exists()).toBe(false)
    expect(mocks.keyList).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('shows and retries a persistent job-list failure after keys load', async () => {
    mocks.listJobs.mockRejectedValueOnce(new Error('jobs offline'))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-testid="batch-image-list-error"]').text()).toContain('batchImage.messages.loadJobsFailed')

    await findButton(wrapper, 'common.retry').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="batch-image-list-error"]').exists()).toBe(false)
    expect(mocks.listJobs).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('aborts the API key request when the view unmounts', async () => {
    const pending = deferred<{ items: ReturnType<typeof makeKey>[] }>()
    mocks.keyList.mockReturnValueOnce(pending.promise)

    const wrapper = mountView()
    await flushPromises()
    const signal = mocks.keyList.mock.calls[0][3]?.signal as AbortSignal
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal.aborted).toBe(false)

    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    pending.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
    await flushPromises()
    expect(mocks.showError).not.toHaveBeenCalled()
  })

  it('ignores a pending job-list failure after the view unmounts', async () => {
    const pending = deferred<{ object: string; data: BatchImageJob[]; has_more: boolean }>()
    mocks.listJobs.mockReturnValueOnce(pending.promise)
    const wrapper = mountView()
    await flushPromises()

    wrapper.unmount()
    pending.reject(new Error('late jobs failure'))
    await flushPromises()

    expect(mocks.showError).not.toHaveBeenCalledWith(expect.stringContaining('late jobs failure'))
  })

  it('does not start a new jobs request when refresh key loading finishes after unmount', async () => {
    const wrapper = mountView()
    await flushPromises()
    const jobsCalls = mocks.listJobs.mock.calls.length
    const pendingKeys = deferred<{ items: ReturnType<typeof makeKey>[] }>()
    mocks.keyList.mockReturnValueOnce(pendingKeys.promise)

    const refresh = (wrapper.vm as unknown as { refreshPage: () => Promise<void> }).refreshPage()
    await flushPromises()
    wrapper.unmount()
    pendingKeys.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
    await refresh
    await flushPromises()

    expect(mocks.listJobs).toHaveBeenCalledTimes(jobsCalls)
    expect(mocks.showError).not.toHaveBeenCalled()
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

  it('localizes detail table headers for custom IDs and prompts', async () => {
    const job = makeJob('localized-detail', 430)
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [job], has_more: false })
    mocks.getJob.mockResolvedValue(job)
    mocks.listItems.mockResolvedValue({
      object: 'list',
      data: [{
        batch_id: job.id,
        custom_id: 'img-001',
        status: 'completed',
        prompt_preview: 'A product photo',
        mime_type: 'image/png',
        file_extension: 'png',
        image_count: 1,
        error: null,
      }],
      has_more: false,
    })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('.batch-job-name__button').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.batch-detail-table th').map(header => header.text())).toEqual([
      'batchImage.detail.customId',
      'batchImage.detail.prompt',
      'common.status',
      'batchImage.detail.preview',
      'batchImage.detail.result',
    ])
    wrapper.unmount()
  })

  it('enables detail download when a failed root is completed by retry children', async () => {
    const rootJob = makeJob('root-job', 430, {
      status: 'failed',
      item_count: 2,
      success_count: 1,
      fail_count: 1,
      actual_cost: null,
    })
    const retryJob = makeJob('retry-job', 440, {
      parent_batch_id: 'root-job',
      item_count: 1,
      success_count: 1,
      fail_count: 0,
    })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [rootJob, retryJob], has_more: false })
    mocks.getJob.mockResolvedValue(rootJob)
    mocks.downloadZip.mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }))

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('.batch-job-name__button').trigger('click')
    await flushPromises()

    const detailDownload = wrapper
      .findAll('.batch-dialog-actions button')
      .find(button => button.text().includes('batchImage.actions.downloadZip'))
    expect(detailDownload).toBeDefined()
    expect(detailDownload!.attributes('disabled')).toBeUndefined()
    await detailDownload!.trigger('click')
    await flushPromises()
    expect(mocks.downloadZip).toHaveBeenCalledWith('key-1', 'root-job')
    wrapper.unmount()
  })

  it('does not let a late cancel response replace a newly selected job', async () => {
    const jobA = makeJob('cancel-a', 450, { status: 'running' })
    const jobB = makeJob('cancel-b', 460, { status: 'running' })
    const pendingCancel = deferred<BatchImageJob>()
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [jobB, jobA], has_more: false })
    mocks.getJob.mockImplementation((_apiKey: string, batchId: string) =>
      Promise.resolve(batchId === jobA.id ? jobA : jobB),
    )
    mocks.cancelJob.mockReturnValue(pendingCancel.promise)

    const wrapper = mountView()
    await flushPromises()
    const jobButtons = wrapper.findAll('.batch-job-name__button')
    await jobButtons.find(button => button.text().includes(jobA.id))!.trigger('click')
    await flushPromises()

    await findButton(wrapper, 'batchImage.actions.cancelJob').trigger('click')
    await wrapper.vm.$nextTick()
    await findButton(wrapper, 'common.confirm').trigger('click')
    await wrapper.findAll('.batch-job-name__button').find(button => button.text().includes(jobB.id))!.trigger('click')
    await flushPromises()

    pendingCancel.resolve({ ...jobA, status: 'cancelled' })
    await flushPromises()

    expect(wrapper.get('.batch-detail__header').text()).toContain(jobB.id)
    expect(wrapper.get('.batch-detail__header').text()).not.toContain(jobA.id)
    expect(mocks.showSuccess).not.toHaveBeenCalledWith('batchImage.messages.cancelled')
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
