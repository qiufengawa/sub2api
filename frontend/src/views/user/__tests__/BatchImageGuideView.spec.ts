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
  deleteOutputs: vi.fn(),
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
  deleteBatchImageOutputs: (...args: unknown[]) => mocks.deleteOutputs(...args),
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
    mocks.deleteOutputs.mockResolvedValue(undefined)
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

  it('loads every API-key page so keys beyond the first 100 remain usable', async () => {
    const secondPageKey = makeKey(2)
    mocks.keyList
      .mockResolvedValueOnce({ items: [{ ...makeKey(1), group: { ...makeKey(1).group, platform: 'openai' } }], pages: 2 })
      .mockResolvedValueOnce({ items: [secondPageKey], pages: 2 })
    const wrapper = mountView()
    await flushPromises()

    expect(mocks.keyList).toHaveBeenCalledWith(1, 100, expect.anything(), expect.anything())
    expect(mocks.keyList).toHaveBeenCalledWith(2, 100, expect.anything(), expect.anything())
    expect((wrapper.vm as any).apiKeys).toHaveLength(2)
    expect((wrapper.vm as any).geminiApiKeys.map((key: { id: number }) => key.id)).toEqual([2])
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
    expect((wrapper.vm as any).batchJobs.find((row: any) => row.id === 'submitted-job').api_key_id).toBe(1)
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

  it('starts polling when an existing queued job is selected', async () => {
    vi.useFakeTimers()
    const queuedJob = makeJob('queued-existing', 425, {
      status: 'running',
      success_count: 0,
      fail_count: 0,
    })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [queuedJob], has_more: false })
    mocks.getJob.mockResolvedValue(queuedJob)

    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('.batch-job-name__button').trigger('click')
    await flushPromises()
    expect(mocks.getJob).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(8000)
    await flushPromises()
    expect(mocks.getJob).toHaveBeenCalledTimes(2)

    wrapper.unmount()
    vi.useRealTimers()
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

  it('loads every detail-item page instead of truncating a large batch at 100 rows', async () => {
    const job = makeJob('large-detail', 432)
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [job], has_more: false })
    mocks.getJob.mockResolvedValue(job)
    mocks.listItems.mockImplementation((_apiKey: string, _batchId: string, options?: unknown) => {
      const cursor = typeof options === 'object' && options !== null
        ? (options as { cursor?: string }).cursor
        : ''
      if (!cursor) {
        return Promise.resolve({
          object: 'list',
          data: [{
            batch_id: job.id,
            custom_id: 'img-001',
            status: 'completed',
            prompt_preview: 'first page',
            mime_type: 'image/png',
            file_extension: 'png',
            image_count: 1,
            error: null,
          }],
          has_more: true,
        })
      }
      return Promise.resolve({
        object: 'list',
        data: [{
          batch_id: job.id,
          custom_id: 'img-101',
          status: 'completed',
          prompt_preview: 'second page',
          mime_type: 'image/png',
          file_extension: 'png',
          image_count: 1,
          error: null,
        }],
        has_more: false,
      })
    })

    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('.batch-job-name__button').trigger('click')
    await flushPromises()

    const itemCalls = mocks.listItems.mock.calls.filter(call => call[1] === job.id)
    expect(itemCalls).toHaveLength(2)
    expect(itemCalls[0][2]).toEqual({ limit: 100 })
    expect(itemCalls[1][2]).toEqual({ limit: 100, cursor: '1' })
    expect(wrapper.text()).toContain('img-001')
    expect(wrapper.text()).toContain('img-101')
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
    ;(wrapper.vm as any).selectedJobIds = new Set(['root-job'])
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).selectedDownloadableRows).toHaveLength(1)
    expect((wrapper.vm as any).canDeleteOutputs((wrapper.vm as any).currentJob)).toBe(true)
    const deleteOutputsButton = wrapper
      .findAll('.batch-dialog-actions button')
      .find(button => button.text().includes('batchImage.actions.deleteOutputs'))
    expect(deleteOutputsButton).toBeDefined()
    wrapper.unmount()
  })

  it('disables aggregate download when a terminal retry child leaves items unresolved', async () => {
    const rootJob = makeJob('partial-root', 450, {
      item_count: 2,
      success_count: 1,
      fail_count: 1,
    })
    const failedChild = makeJob('partial-child', 451, {
      parent_batch_id: rootJob.id,
      item_count: 1,
      success_count: 0,
      fail_count: 1,
      status: 'failed',
    })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [rootJob, failedChild], has_more: false })
    mocks.getJob.mockResolvedValue(rootJob)

    const wrapper = mountView()
    await flushPromises()
    await wrapper.find('.batch-job-name__button').trigger('click')
    await flushPromises()

    const detailDownload = wrapper
      .findAll('.batch-dialog-actions button')
      .find(button => button.text().includes('batchImage.actions.downloadZip'))
    expect(detailDownload).toBeDefined()
    expect(detailDownload!.attributes('disabled')).toBe('')
    expect(mocks.downloadZip).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('loads retry children that fall on a later jobs page into root detail', async () => {
    const rootJob = makeJob('cross-page-root', 2000, {
      status: 'failed',
      item_count: 2,
      success_count: 1,
      fail_count: 1,
      actual_cost: null,
    })
    const childJob = makeJob('cross-page-child', 1999, {
      parent_batch_id: rootJob.id,
      status: 'completed',
      item_count: 1,
      success_count: 1,
      fail_count: 0,
    })
    const unrelated = Array.from({ length: 100 }, (_, index) =>
      makeJob(`unrelated-${index}`, 1000 - index),
    )

    mocks.listJobs.mockImplementation((_apiKey: string, options: { limit?: number, cursor?: string } = {}) => {
      if (options.limit === 100) {
        if (!options.cursor) {
          return Promise.resolve({ object: 'list', data: unrelated, has_more: true })
        }
        return Promise.resolve({ object: 'list', data: [childJob], has_more: false })
      }
      return Promise.resolve({
        object: 'list',
        data: [rootJob, ...unrelated.slice(0, 20)],
        has_more: true,
      })
    })
    mocks.getJob.mockResolvedValue(rootJob)
    mocks.listItems.mockImplementation((_apiKey: string, batchId: string) => Promise.resolve({
      object: 'list',
      data: [{
        custom_id: `${batchId}-item`,
        status: 'succeeded',
        prompt_preview: batchId,
        mime_type: 'image/png',
        file_extension: 'png',
        image_count: 1,
        error: null,
      }],
      has_more: false,
    }))

    const wrapper = mountView()
    await flushPromises()
    const rootButton = wrapper.findAll('.batch-job-name__button').find(button => button.text().includes(rootJob.id))
    expect(rootButton).toBeDefined()
    await rootButton!.trigger('click')
    await flushPromises()

    const itemCalls = mocks.listItems.mock.calls.filter(call => call[1] === rootJob.id || call[1] === childJob.id)
    expect(itemCalls.map(call => call[1])).toEqual([rootJob.id, childJob.id])
    expect(wrapper.text()).toContain(`${rootJob.id}-item`)
    expect(wrapper.text()).toContain(`${childJob.id}-item`)
    expect((wrapper.vm as any).currentDisplayJob.success_count).toBe(2)
    wrapper.unmount()
  })

  it('opens a discovered child with its captured API key and loads child items', async () => {
    const rootJob = makeJob('child-open-root', 2100, {
      status: 'failed',
      item_count: 2,
      success_count: 1,
      fail_count: 1,
      actual_cost: null,
    })
    const childJob = makeJob('child-open-late', 2099, {
      parent_batch_id: rootJob.id,
      item_count: 1,
      success_count: 1,
      fail_count: 0,
    })
    const unrelated = Array.from({ length: 100 }, (_, index) => makeJob(`child-open-unrelated-${index}`, 1000 - index))
    mocks.listJobs.mockImplementation((_apiKey: string, options: { limit?: number, cursor?: string } = {}) => {
      if (options.limit === 100) {
        return options.cursor
          ? Promise.resolve({ object: 'list', data: [childJob], has_more: false })
          : Promise.resolve({ object: 'list', data: unrelated, has_more: true })
      }
      return Promise.resolve({ object: 'list', data: [rootJob, ...unrelated.slice(0, 20)], has_more: true })
    })
    mocks.getJob.mockImplementation((_apiKey: string, batchId: string) => Promise.resolve(batchId === childJob.id ? childJob : rootJob))
    mocks.listItems.mockImplementation((_apiKey: string, batchId: string) => Promise.resolve({
      object: 'list',
      data: [{
        custom_id: `${batchId}-item`,
        status: 'succeeded',
        prompt_preview: batchId,
        mime_type: 'image/png',
        file_extension: 'png',
        image_count: 1,
        error: null,
      }],
      has_more: false,
    }))

    const wrapper = mountView()
    await flushPromises()
    const rootButton = wrapper.findAll('.batch-job-name__button').find(button => button.text().includes(rootJob.id))
    expect(rootButton).toBeDefined()
    await rootButton!.trigger('click')
    await flushPromises()

    ;(wrapper.vm as any).toggleChildRows(rootJob.id)
    await wrapper.vm.$nextTick()
    const childButton = wrapper.findAll('.batch-job-name__button').find(button => button.text().includes(childJob.id))
    expect(childButton).toBeDefined()

    // Change the create-form key before opening the discovered child. The row
    // carries key 1 and must keep using it for both detail and item requests.
    ;(wrapper.vm as any).form.apiKeyId = 2
    await childButton!.trigger('click')
    await flushPromises()

    expect(mocks.getJob).toHaveBeenCalledWith('key-1', childJob.id)
    expect(mocks.listItems.mock.calls.some(call => call[0] === 'key-1' && call[1] === childJob.id)).toBe(true)
    expect(wrapper.text()).toContain(`${childJob.id}-item`)
    wrapper.unmount()
  })

  it('snapshots bulk-delete rows when the confirmation opens', async () => {
    const first = makeJob('bulk-confirm-a', 2200)
    const second = makeJob('bulk-confirm-b', 2199)
    const replacement = makeJob('bulk-confirm-c', 2198)
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [first, second, replacement], has_more: false })
    const wrapper = mountView()
    await flushPromises()

    ;(wrapper.vm as any).selectedJobIds = new Set([first.id, second.id])
    ;(wrapper.vm as any).requestDeleteSelectedJobs()
    ;(wrapper.vm as any).selectedJobIds = new Set([replacement.id])
    await (wrapper.vm as any).confirmPendingAction()
    await flushPromises()

    expect(mocks.deleteJob.mock.calls.map(call => call[1])).toEqual([first.id, second.id])
    expect(mocks.deleteJob).not.toHaveBeenCalledWith('key-1', replacement.id)
    wrapper.unmount()
  })

  it('uses the selected batch key for detail downloads after the form key changes', async () => {
    const job = makeJob('key-snapshot', 435)
    mocks.keyList.mockResolvedValue({ items: [makeKey(1), makeKey(2)] })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [job], has_more: false })
    mocks.getJob.mockResolvedValue(job)
    mocks.downloadZip.mockResolvedValue(new Blob(['zip'], { type: 'application/zip' }))

    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('.batch-job-name__button').trigger('click')
    await flushPromises()

    // Simulate changing the create-form key while the selected detail remains
    // bound to key 1.
    ;(wrapper.vm as any).form.apiKeyId = 2
    await wrapper.vm.$nextTick()
    await (wrapper.vm as any).refreshSelected()
    expect((wrapper.vm as any).batchJobs.find((row: any) => row.id === job.id).api_key_id).toBe(1)
    await findButton(wrapper, 'batchImage.actions.downloadZip').trigger('click')
    await flushPromises()

    expect(mocks.downloadZip).toHaveBeenCalledWith('key-1', job.id)
    wrapper.unmount()
  })

  it('paginates every failed item before submitting a retry', async () => {
    const failedJob = makeJob('failed-large', 438, {
      status: 'failed',
      item_count: 4,
      success_count: 0,
      fail_count: 4,
      actual_cost: null,
    })
    const retryJob = makeJob('failed-large-retry', 439, {
      status: 'completed',
      parent_batch_id: failedJob.id,
    })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [failedJob], has_more: false })
    mocks.submitJob.mockResolvedValue(retryJob)
    mocks.listItems.mockImplementation((_apiKey: string, batchId: string, options?: unknown) => {
      if (batchId !== failedJob.id) {
        return Promise.resolve({ object: 'list', data: [], has_more: false })
      }
      const cursor = typeof options === 'object' && options !== null
        ? (options as { cursor?: string }).cursor
        : ''
      if (!cursor) {
        return Promise.resolve({
          object: 'list',
          data: [
            { custom_id: 'img-001', status: 'failed', prompt_preview: 'first prompt', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null },
            { custom_id: 'img-002', status: 'failed', prompt_preview: 'second prompt', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null },
          ],
          has_more: true,
        })
      }
      return Promise.resolve({
        object: 'list',
        data: [
          { custom_id: 'img-003', status: 'failed', prompt_preview: 'third prompt', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null },
          { custom_id: 'img-004', status: 'failed', prompt_preview: 'fourth prompt', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null },
        ],
        has_more: false,
      })
    })

    const wrapper = mountView()
    await flushPromises()
    await (wrapper.vm as any).retryFailedJob(failedJob)
    await flushPromises()

    const sourceCalls = mocks.listItems.mock.calls.filter(call => call[1] === failedJob.id)
    expect(sourceCalls).toHaveLength(2)
    expect(sourceCalls[0][2]).toEqual({ status: 'failed', limit: 100 })
    expect(sourceCalls[1][2]).toEqual({ status: 'failed', limit: 100, cursor: '2' })
    expect(mocks.submitJob).toHaveBeenCalledOnce()
    expect(mocks.submitJob.mock.calls[0][1].items.map((item: { prompt: string }) => item.prompt)).toEqual([
      'first prompt',
      'second prompt',
      'third prompt',
      'fourth prompt',
    ])
    wrapper.unmount()
  })

  it('keeps retry custom IDs unique when source IDs sanitize to the same base', async () => {
    const failedJob = makeJob('retry-collision', 441, {
      status: 'failed',
      item_count: 2,
      success_count: 0,
      fail_count: 2,
      actual_cost: null,
    })
    const retryJob = makeJob('retry-collision-child', 442, {
      status: 'queued',
      parent_batch_id: failedJob.id,
      success_count: 0,
      fail_count: 0,
      actual_cost: null,
    })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [failedJob], has_more: false })
    mocks.listItems.mockImplementation((_apiKey: string, batchId: string) =>
      Promise.resolve(batchId === failedJob.id
        ? {
            object: 'list',
            data: [
              { custom_id: 'a%b', status: 'failed', prompt_preview: 'prompt A', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null },
              { custom_id: 'a@b', status: 'failed', prompt_preview: 'prompt B', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null },
            ],
            has_more: false,
          }
        : { object: 'list', data: [], has_more: false }),
    )
    mocks.submitJob.mockResolvedValue(retryJob)

    const wrapper = mountView()
    await flushPromises()
    await (wrapper.vm as any).retryFailedJob(failedJob)
    await flushPromises()

    const retryItems = mocks.submitJob.mock.calls[0][1].items as Array<{ custom_id: string }>
    expect(retryItems).toHaveLength(2)
    expect(new Set(retryItems.map(item => item.custom_id)).size).toBe(2)
    expect((wrapper.vm as any).retryCustomID('x'.repeat(250), 0).length).toBeLessThanOrEqual(255)
    expect((wrapper.vm as any).retrySourceCustomID('foo_retry_abc_retry_def_0')).toBe('foo_retry_abc')
    wrapper.unmount()
  })

  it('does not resubmit a root item already recovered by a successful retry child', async () => {
    const rootJob = makeJob('retry-root', 445, {
      status: 'failed',
      item_count: 2,
      success_count: 0,
      fail_count: 2,
      actual_cost: null,
    })
    const childJob = makeJob('retry-child', 446, {
      parent_batch_id: rootJob.id,
      item_count: 1,
      success_count: 1,
      fail_count: 0,
    })
    const retryJob = makeJob('retry-child-2', 447, {
      parent_batch_id: rootJob.id,
      status: 'queued',
      success_count: 0,
      fail_count: 0,
      actual_cost: null,
    })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [rootJob, childJob], has_more: false })
    mocks.listItems.mockImplementation((_apiKey: string, batchId: string, options?: unknown) => {
      if (batchId === rootJob.id) {
        return Promise.resolve({
          object: 'list',
          data: [
            { custom_id: 'img-a', status: 'failed', prompt_preview: 'prompt A', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null },
            { custom_id: 'img-b', status: 'failed', prompt_preview: 'prompt B', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null },
          ],
          has_more: false,
        })
      }
      if (batchId === childJob.id && !(options && typeof options === 'object' && 'status' in options)) {
        return Promise.resolve({
          object: 'list',
          data: [{ custom_id: 'img-a_retry_abc', status: 'succeeded', prompt_preview: 'prompt A', mime_type: 'image/png', file_extension: 'png', image_count: 1, error: null }],
          has_more: false,
        })
      }
      return Promise.resolve({ object: 'list', data: [], has_more: false })
    })
    mocks.submitJob.mockResolvedValue(retryJob)

    const wrapper = mountView()
    await flushPromises()
    await (wrapper.vm as any).retryFailedJob(rootJob)
    await flushPromises()

    expect(mocks.submitJob).toHaveBeenCalledOnce()
    expect(mocks.submitJob.mock.calls[0][1].items).toEqual([
      expect.objectContaining({ prompt: 'prompt B' }),
    ])
    wrapper.unmount()
  })

  it('does not let a late retry response replace a newly selected detail job', async () => {
    const rootJob = makeJob('late-retry-root', 448, {
      status: 'failed',
      item_count: 1,
      success_count: 0,
      fail_count: 1,
      actual_cost: null,
    })
    const selectedJob = makeJob('late-retry-selected', 449, { status: 'completed' })
    const retryJob = makeJob('late-retry-child', 450, {
      parent_batch_id: rootJob.id,
      status: 'queued',
      success_count: 0,
      fail_count: 0,
      actual_cost: null,
    })
    const pendingRootItems = deferred<{ object: string, data: any[], has_more: boolean }>()
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [selectedJob, rootJob], has_more: false })
    mocks.getJob.mockResolvedValue(selectedJob)
    mocks.listItems.mockImplementation((_apiKey: string, batchId: string) => {
      if (batchId === rootJob.id) return pendingRootItems.promise
      return Promise.resolve({ object: 'list', data: [], has_more: false })
    })
    mocks.submitJob.mockResolvedValue(retryJob)

    const wrapper = mountView()
    await flushPromises()
    const retryPromise = (wrapper.vm as any).retryFailedJob(rootJob)
    await flushPromises()

    await (wrapper.vm as any).selectJob(selectedJob.id)
    await flushPromises()
    pendingRootItems.resolve({
      object: 'list',
      data: [{ custom_id: 'late', status: 'failed', prompt_preview: 'late prompt', mime_type: 'image/png', file_extension: 'png', image_count: 0, error: null }],
      has_more: false,
    })
    await retryPromise
    await flushPromises()

    expect(wrapper.get('.batch-detail__header').text()).toContain(selectedJob.id)
    expect(wrapper.get('.batch-detail__header').text()).not.toContain(retryJob.id)
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

  it('keeps the cancel target snapshot when the detail selection changes before confirm', async () => {
    const jobA = makeJob('snapshot-a', 455, { status: 'running' })
    const jobB = makeJob('snapshot-b', 465, { status: 'running' })
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
    // A dialog snapshot must remain bound to A even if the underlying detail
    // selection changes before the confirmation event is delivered.
    await wrapper.findAll('.batch-job-name__button').find(button => button.text().includes(jobB.id))!.trigger('click')
    await findButton(wrapper, 'common.confirm').trigger('click')

    expect(mocks.cancelJob).toHaveBeenCalledWith('key-1', jobA.id)
    pendingCancel.resolve({ ...jobA, status: 'cancelled' })
    await flushPromises()
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

  it('keeps a failed batch delete confirmation open so the job can be retried', async () => {
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [makeJob('delete-retry', 510)], has_more: false })
    mocks.deleteJob.mockRejectedValueOnce(new Error('delete fixture failure'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('button[aria-label="batchImage.actions.deleteRecords"]').trigger('click')
    await findButton(wrapper, 'common.confirm').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ui-confirm').exists()).toBe(true)
    expect(mocks.showError).toHaveBeenCalledWith(expect.stringContaining('batchImage.messages.deleteFailed'))

    mocks.deleteJob.mockResolvedValueOnce(undefined)
    await findButton(wrapper, 'common.confirm').trigger('click')
    await flushPromises()
    expect(mocks.deleteJob).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.ui-confirm').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps a failed cancel confirmation open so the job can be retried', async () => {
    const runningJob = makeJob('cancel-retry', 520, { status: 'running', success_count: 0, fail_count: 0 })
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [runningJob], has_more: false })
    mocks.getJob.mockResolvedValue(runningJob)
    mocks.cancelJob.mockRejectedValueOnce(new Error('cancel fixture failure'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.batch-job-name__button').trigger('click')
    await flushPromises()
    await findButton(wrapper, 'batchImage.actions.cancelJob').trigger('click')
    await findButton(wrapper, 'common.confirm').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ui-confirm').exists()).toBe(true)
    expect(mocks.showError).toHaveBeenCalledWith(expect.stringContaining('batchImage.messages.cancelFailed'))

    mocks.cancelJob.mockResolvedValueOnce({ ...runningJob, status: 'cancelled' })
    await findButton(wrapper, 'common.confirm').trigger('click')
    await flushPromises()
    expect(mocks.cancelJob).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.ui-confirm').exists()).toBe(false)
    wrapper.unmount()
  })

  it('confirms output deletion, updates the job status, and retains the record', async () => {
    const job = makeJob('outputs-delete', 530)
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [job], has_more: false })
    mocks.getJob.mockResolvedValue(job)
    mocks.deleteOutputs.mockResolvedValue(undefined)
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.batch-job-name__button').trigger('click')
    await flushPromises()
    await findButton(wrapper, 'batchImage.actions.deleteOutputs').trigger('click')
    expect(mocks.deleteOutputs).not.toHaveBeenCalled()
    await findButton(wrapper, 'common.confirm').trigger('click')
    await flushPromises()

    expect(mocks.deleteOutputs).toHaveBeenCalledWith('key-1', job.id)
    expect((wrapper.vm as any).currentJob.status).toBe('output_deleted')
    expect(wrapper.find('.ui-confirm').exists()).toBe(false)
    expect(wrapper.get('.batch-detail__header').text()).toContain(job.id)
    wrapper.unmount()
  })

  it('keeps output-deletion confirmation open when the request fails', async () => {
    const job = makeJob('outputs-delete-retry', 531)
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [job], has_more: false })
    mocks.getJob.mockResolvedValue(job)
    mocks.deleteOutputs.mockRejectedValueOnce(new Error('storage delete failed'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.batch-job-name__button').trigger('click')
    await flushPromises()
    await findButton(wrapper, 'batchImage.actions.deleteOutputs').trigger('click')
    await findButton(wrapper, 'common.confirm').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ui-confirm').exists()).toBe(true)
    expect((wrapper.vm as any).currentJob.status).toBe('completed')
    expect(mocks.showError).toHaveBeenCalledWith(expect.stringContaining('batchImage.messages.deleteOutputsFailed'))
    wrapper.unmount()
  })

  it('does not clear the newly selected detail preview when output deletion resolves late', async () => {
    const jobA = makeJob('outputs-delete-late-a', 532)
    const jobB = makeJob('outputs-delete-late-b', 533)
    const pendingDelete = deferred<void>()
    mocks.listJobs.mockResolvedValue({ object: 'list', data: [jobB, jobA], has_more: false })
    mocks.getJob.mockImplementation((_apiKey: string, batchId: string) =>
      Promise.resolve(batchId === jobA.id ? jobA : jobB),
    )
    mocks.deleteOutputs.mockReturnValue(pendingDelete.promise)

    const wrapper = mountView()
    await flushPromises()
    await wrapper.findAll('.batch-job-name__button').find(button => button.text().includes(jobA.id))!.trigger('click')
    await flushPromises()
    await findButton(wrapper, 'batchImage.actions.deleteOutputs').trigger('click')
    await findButton(wrapper, 'common.confirm').trigger('click')
    await flushPromises()

    await wrapper.findAll('.batch-job-name__button').find(button => button.text().includes(jobB.id))!.trigger('click')
    await flushPromises()
    const previewMarker = { custom_id: 'preview-b' }
    ;(wrapper.vm as any).previewImageItem = previewMarker

    pendingDelete.resolve()
    await flushPromises()

    expect((wrapper.vm as any).currentJob.id).toBe(jobB.id)
    expect((wrapper.vm as any).previewImageItem).toEqual(previewMarker)
    wrapper.unmount()
  })
})
