import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cancelBatchImageJob,
  deleteBatchImageJobRecord,
  deleteBatchImageOutputs,
  downloadBatchImageZip,
  getBatchImageItemContent,
  getBatchImageJob,
  listBatchImageItems,
  listBatchImageJobs,
  listBatchImageModels,
  saveBlob,
  submitBatchImageJob,
} from '@/api/batchImage'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function requestURL(input: RequestInfo | URL): URL {
  return new URL(String(input), window.location.origin)
}

function requestHeaders(init: RequestInit | undefined): Headers {
  return new Headers(init?.headers)
}

describe('Batch Image API route contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('submits an authenticated job with JSON and an idempotency key', async () => {
    const fetchMock = vi.mocked(fetch)
    const job = { id: 'batch-1', status: 'queued' }
    fetchMock.mockResolvedValueOnce(jsonResponse(job))

    await expect(submitBatchImageJob('KEY', {
      model: 'gemini-2.5-flash-image',
      task_name: 'fixture',
      parent_batch_id: 'parent-1',
      items: [{ custom_id: 'img_001', prompt: 'a tree', output_count: 2 }],
    }, 'fixture-idempotency')).resolves.toEqual(job)

    const [input, init] = fetchMock.mock.calls[0]
    expect(requestURL(input).pathname).toBe('/v1/images/batches')
    expect(init?.method).toBe('POST')
    const headers = requestHeaders(init)
    expect(headers.get('Authorization')).toBe('Bearer KEY')
    expect(headers.get('Idempotency-Key')).toBe('fixture-idempotency')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gemini-2.5-flash-image',
      parent_batch_id: 'parent-1',
      items: [{ custom_id: 'img_001', output_count: 2 }],
    })
  })

  it('encodes list filters and exposes the models route separately from :id', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ object: 'list', data: [], has_more: true }))
      .mockResolvedValueOnce(jsonResponse({ object: 'list', data: [{ id: 'model-1', provider: 'gemini' }] }))

    await listBatchImageJobs('KEY', {
      limit: 25,
      cursor: 'cursor/next',
      status: 'running',
      taskName: 'nightly render',
      downloaded: 'false',
      from: '2026-08-01T00:00:00Z',
      to: '2026-08-02T00:00:00Z',
    })
    await listBatchImageModels('KEY')

    const listURL = requestURL(fetchMock.mock.calls[0][0])
    expect(listURL.pathname).toBe('/v1/images/batches')
    expect(Object.fromEntries(listURL.searchParams)).toEqual({
      limit: '25',
      cursor: 'cursor/next',
      status: 'running',
      task_name: 'nightly render',
      downloaded: 'false',
      from: '2026-08-01T00:00:00Z',
      to: '2026-08-02T00:00:00Z',
    })
    expect(requestURL(fetchMock.mock.calls[1][0]).pathname).toBe('/v1/images/batches/models')
    expect(requestHeaders(fetchMock.mock.calls[1][1]).get('Authorization')).toBe('Bearer KEY')
  })

  it('encodes job and custom IDs for detail, item and cancel routes', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async () => jsonResponse({ object: 'batch', id: 'job' }))

    await getBatchImageJob('KEY', 'job/with space')
    await listBatchImageItems('KEY', 'job/with space', 'failed item')
    await cancelBatchImageJob('KEY', 'job/with space')

    expect(requestURL(fetchMock.mock.calls[0][0]).pathname).toBe('/v1/images/batches/job%2Fwith%20space')
    const itemURL = requestURL(fetchMock.mock.calls[1][0])
    expect(itemURL.pathname).toBe('/v1/images/batches/job%2Fwith%20space/items')
    expect(itemURL.searchParams.get('status')).toBe('failed item')
    expect(fetchMock.mock.calls[2][1]?.method).toBe('POST')
    expect(requestURL(fetchMock.mock.calls[2][0]).pathname).toBe('/v1/images/batches/job%2Fwith%20space/cancel')
  })

  it('encodes item pagination options for large retry batches', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(jsonResponse({ object: 'list', data: [], has_more: true }))

    await listBatchImageItems('KEY', 'batch-large', {
      status: 'failed',
      limit: 100,
      cursor: '100',
    })

    const request = requestURL(fetchMock.mock.calls[0][0])
    expect(request.pathname).toBe('/v1/images/batches/batch-large/items')
    expect(Object.fromEntries(request.searchParams)).toEqual({
      status: 'failed',
      limit: '100',
      cursor: '100',
    })
  })

  it('returns binary downloads and item previews without JSON coercion', async () => {
    const fetchMock = vi.mocked(fetch)
    const zip = new Blob(['zip-fixture'], { type: 'application/zip' })
    const preview = new Blob(['png-fixture'], { type: 'image/png' })
    fetchMock
      .mockResolvedValueOnce(new Response(zip, { status: 200 }))
      .mockResolvedValueOnce(new Response(preview, { status: 200 }))

    await expect(downloadBatchImageZip('KEY', 'batch-1')).resolves.toEqual(zip)
    await expect(getBatchImageItemContent('KEY', 'batch-1', 'img/001', 2)).resolves.toEqual(preview)

    const previewURL = requestURL(fetchMock.mock.calls[1][0])
    expect(previewURL.pathname).toBe('/v1/images/batches/batch-1/items/img%2F001/content')
    expect(previewURL.searchParams.get('image_index')).toBe('2')
    expect(requestHeaders(fetchMock.mock.calls[0][1]).get('Authorization')).toBe('Bearer KEY')
  })

  it('keeps record deletion and output deletion as separate authenticated operations', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(deleteBatchImageOutputs('KEY', 'batch-1')).resolves.toBeUndefined()
    await expect(deleteBatchImageJobRecord('KEY', 'batch-1')).resolves.toBeUndefined()
    expect(requestURL(fetchMock.mock.calls[0][0]).pathname).toBe('/v1/images/batches/batch-1/outputs')
    expect(requestURL(fetchMock.mock.calls[1][0]).pathname).toBe('/v1/images/batches/batch-1')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('DELETE')
    expect(requestHeaders(fetchMock.mock.calls[0][1]).get('Authorization')).toBe('Bearer KEY')
  })

  it('preserves structured request IDs and status for JSON and text errors', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'BATCH_NOT_FOUND', message: 'missing batch' } }, {
        status: 404,
        statusText: 'Not Found',
        headers: { 'X-Request-Id': 'req-json' },
      }))
      .mockResolvedValueOnce(new Response('upstream unavailable', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'X-Request-Id': 'req-text' },
      }))

    await expect(getBatchImageJob('KEY', 'missing')).rejects.toMatchObject({
      message: 'missing batch',
      code: 'BATCH_NOT_FOUND',
      status: 404,
      requestId: 'req-json',
    })
    await expect(listBatchImageModels('KEY')).rejects.toMatchObject({
      message: 'Bad Gateway',
      code: 502,
      status: 502,
      requestId: 'req-text',
    })
  })

  it('defers object URL revocation until after the download click', () => {
    vi.useFakeTimers()
    const createURL = vi.fn(() => 'blob:fixture')
    const revokeURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    saveBlob(new Blob(['zip']), 'fixture.zip')

    expect(createURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeURL).toHaveBeenCalledWith('blob:fixture')

    delete (URL as typeof URL & { createObjectURL?: unknown }).createObjectURL
    delete (URL as typeof URL & { revokeObjectURL?: unknown }).revokeObjectURL
    vi.useRealTimers()
  })
})
