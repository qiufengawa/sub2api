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
  submitBatchImageJob,
} from '@/api/batchImage'
import type { BatchImageItem, BatchImageJob } from '@/api/batchImage'

type FixtureJob = BatchImageJob & { owner: number; idempotencyKey: string; requestHash: string }

type RouteTrace = {
  method: string
  path: string
  query: string
  status: number
  requestId: string
  bodyHash: string
}

const OWNER_BY_KEY: Record<string, number> = { KEY_A: 7, KEY_B: 8 }

function jsonResponse(body: unknown, status = 200, requestId = 'route-fixture') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
  })
}

function bodyHash(body: string) {
  // A deterministic, dependency-free hash is sufficient for the fixture's
  // idempotency contract; this is not used as a security primitive.
  let hash = 2166136261
  for (let index = 0; index < body.length; index += 1) {
    hash ^= body.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function makeJob(id: string, owner: number, overrides: Partial<BatchImageJob> = {}): FixtureJob {
  return {
    id,
    object: 'image.batch',
    task_name: id,
    parent_batch_id: null,
    status: 'queued',
    model: 'gemini-3-pro-image',
    provider: 'gemini_api',
    item_count: 1,
    success_count: 0,
    fail_count: 0,
    estimated_cost: 1,
    hold_amount: 1,
    actual_cost: null,
    created_at: 1,
    submitted_at: null,
    settled_at: null,
    downloaded_at: null,
    output_deleted_at: null,
    owner,
    idempotencyKey: '',
    requestHash: '',
    ...overrides,
  }
}

function makeItem(batchId: string, customId = 'cover/001', status = 'succeeded'): BatchImageItem {
  return {
    batch_id: batchId,
    source_task_name: batchId,
    custom_id: customId,
    status,
    prompt_preview: 'fixture prompt',
    mime_type: status === 'succeeded' ? 'image/png' : null,
    file_extension: status === 'succeeded' ? 'png' : null,
    image_count: status === 'succeeded' ? 1 : 0,
    error: status === 'succeeded' ? null : { code: 'FIXTURE_FAILED', message: 'fixture failure' },
  }
}

describe('Batch Image stateful route mock', () => {
  let jobs: Map<string, FixtureJob>
  let items: Map<string, BatchImageItem[]>
  let idempotency: Map<string, { owner: number; requestHash: string; batchId: string }>
  let traces: RouteTrace[]
  let sequence: number

  beforeEach(() => {
    jobs = new Map()
    items = new Map()
    idempotency = new Map()
    traces = []
    sequence = 0

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), window.location.origin)
      const method = String(init?.method || 'GET').toUpperCase()
      const apiKey = new Headers(init?.headers).get('Authorization')?.replace(/^Bearer\s+/, '') || ''
      const owner = OWNER_BY_KEY[apiKey]
      const path = url.pathname
      const requestBody = typeof init?.body === 'string' ? init.body : ''
      let response: Response
      const id = (value: string) => decodeURIComponent(value)
      const segments = path.split('/').filter(Boolean)

      if (!owner) {
        response = jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'fixture API key rejected' } }, 401)
      } else if (method === 'GET' && path === '/v1/images/batches/models') {
        response = jsonResponse({ object: 'list', data: [{ id: 'gemini-3-pro-image', object: 'model', provider: 'gemini_api' }] })
      } else if (method === 'POST' && path === '/v1/images/batches') {
        const payload = JSON.parse(requestBody) as { items?: Array<{ custom_id: string }>; task_name?: string; parent_batch_id?: string }
        const idempotencyKey = new Headers(init?.headers).get('Idempotency-Key') || ''
        const requestHash = bodyHash(requestBody)
        const prior = idempotency.get(`${owner}:${idempotencyKey}`)
        if (prior && prior.requestHash !== requestHash) {
          response = jsonResponse({ error: { code: 'BATCH_IMAGE_IDEMPOTENCY_CONFLICT', message: 'idempotency key reused with different request' } }, 409)
        } else {
          const batchId = prior?.batchId || `fixture-batch-${++sequence}`
          const job = prior
            ? jobs.get(batchId)!
            : makeJob(batchId, owner, {
                task_name: payload.task_name || batchId,
                parent_batch_id: payload.parent_batch_id || null,
                item_count: payload.items?.length || 0,
                idempotencyKey,
                requestHash,
              })
          jobs.set(batchId, job)
          items.set(batchId, (payload.items || []).map(item => makeItem(batchId, item.custom_id, 'pending')))
          idempotency.set(`${owner}:${idempotencyKey}`, { owner, requestHash, batchId })
          response = jsonResponse(job)
        }
      } else if (method === 'GET' && path === '/v1/images/batches') {
        const data = [...jobs.values()].filter(job => job.owner === owner).map(({ owner: _owner, idempotencyKey: _key, requestHash: _hash, ...job }) => job)
        response = jsonResponse({ object: 'list', data, has_more: false })
      } else if (segments[0] === 'v1' && segments[1] === 'images' && segments[2] === 'batches') {
        const batchId = id(segments[3] || '')
        const job = jobs.get(batchId)
        if (!job || job.owner !== owner) {
          response = jsonResponse({ error: { code: 'BATCH_IMAGE_JOB_NOT_FOUND', message: 'batch image job not found' } }, 404)
        } else if (method === 'GET' && segments.length === 4) {
          const { owner: _owner, idempotencyKey: _key, requestHash: _hash, ...publicJob } = job
          response = jsonResponse(publicJob)
        } else if (method === 'GET' && segments[4] === 'items' && segments.length === 5) {
          const allItems = items.get(batchId) || []
          const cursor = Number(url.searchParams.get('cursor') || 0)
          const limit = Number(url.searchParams.get('limit') || 100)
          const status = url.searchParams.get('status') || ''
          const filtered = status ? allItems.filter(item => item.status === status) : allItems
          response = jsonResponse({ object: 'list', data: filtered.slice(cursor, cursor + limit), has_more: cursor + limit < filtered.length })
        } else if (method === 'GET' && segments[4] === 'download') {
          if (job.status !== 'completed') {
            response = jsonResponse({ error: { code: 'BATCH_IMAGE_NOT_READY', message: 'batch image job is not completed' } }, 409)
          } else {
            job.downloaded_at = 123
            response = new Response(new Blob(['fixture-zip-bytes'], { type: 'application/zip' }), { status: 200, headers: { 'Content-Type': 'application/zip', 'X-Request-Id': 'download-fixture' } })
          }
        } else if (method === 'GET' && segments[4] === 'items' && segments[6] === 'content') {
          const customId = id(segments[5] || '')
          const item = (items.get(batchId) || []).find(candidate => candidate.custom_id === customId)
          response = item?.status === 'succeeded'
            ? new Response(new Blob(['fixture-png'], { type: 'image/png' }), { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': 'content-fixture' } })
            : jsonResponse({ error: { code: 'BATCH_IMAGE_ITEM_NOT_FOUND', message: 'item not found' } }, 404)
        } else if (method === 'POST' && segments[4] === 'cancel') {
          if (job.status !== 'completed') job.status = 'cancelled'
          response = jsonResponse(job)
        } else if (method === 'DELETE' && segments[4] === 'outputs') {
          job.status = 'output_deleted'
          job.output_deleted_at = 123
          response = new Response(null, { status: 204, headers: { 'X-Request-Id': 'output-delete-fixture' } })
        } else if (method === 'DELETE' && segments.length === 4) {
          jobs.delete(batchId)
          items.delete(batchId)
          response = new Response(null, { status: 204, headers: { 'X-Request-Id': 'record-delete-fixture' } })
        } else {
          response = jsonResponse({ error: { code: 'NOT_FOUND', message: 'fixture route not found' } }, 404)
        }
      } else {
        response = jsonResponse({ error: { code: 'NOT_FOUND', message: 'fixture route not found' } }, 404)
      }

      traces.push({ method, path, query: url.search, status: response.status, requestId: response.headers.get('X-Request-Id') || '', bodyHash: bodyHash(requestBody) })
      return response
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('drives submit, idempotency, pagination, binary content, cancellation, deletion, and owner isolation', async () => {
    await expect(listBatchImageModels('KEY_A')).resolves.toMatchObject({ data: [{ id: 'gemini-3-pro-image' }] })

    const payload = { model: 'gemini-3-pro-image', task_name: 'route-fixture', items: [{ custom_id: 'cover/001', prompt: 'a tree' }] }
    const first = await submitBatchImageJob('KEY_A', payload, 'idem-1')
    const replay = await submitBatchImageJob('KEY_A', payload, 'idem-1')
    expect(replay.id).toBe(first.id)
    await expect(submitBatchImageJob('KEY_A', { ...payload, task_name: 'different' }, 'idem-1')).rejects.toMatchObject({ status: 409, code: 'BATCH_IMAGE_IDEMPOTENCY_CONFLICT' })

    await expect(listBatchImageJobs('KEY_A', { limit: 1 })).resolves.toMatchObject({ data: [{ id: first.id }] })
    await expect(getBatchImageJob('KEY_B', first.id)).rejects.toMatchObject({ status: 404 })
    await expect(listBatchImageItems('KEY_A', first.id, { limit: 1, cursor: '0' })).resolves.toMatchObject({ data: [{ custom_id: 'cover/001', status: 'pending' }] })
    await expect(getBatchImageItemContent('KEY_A', first.id, 'cover/001')).rejects.toMatchObject({ status: 404 })

    const job = jobs.get(first.id)!
    job.status = 'completed'
    job.success_count = 1
    items.set(first.id, [makeItem(first.id, 'cover/001', 'succeeded')])
    await expect(getBatchImageItemContent('KEY_A', first.id, 'cover/001')).resolves.toBeInstanceOf(Blob)
    await expect(downloadBatchImageZip('KEY_A', first.id)).resolves.toBeInstanceOf(Blob)
    expect(job.downloaded_at).toBe(123)

    const running = await submitBatchImageJob('KEY_A', { ...payload, task_name: 'running' }, 'idem-running')
    await expect(cancelBatchImageJob('KEY_A', running.id)).resolves.toMatchObject({ status: 'cancelled' })
    await expect(deleteBatchImageOutputs('KEY_A', first.id)).resolves.toBeUndefined()
    await expect(getBatchImageJob('KEY_A', first.id)).resolves.toMatchObject({ status: 'output_deleted' })
    await expect(deleteBatchImageJobRecord('KEY_A', first.id)).resolves.toBeUndefined()
    await expect(getBatchImageJob('KEY_A', first.id)).rejects.toMatchObject({ status: 404 })

    const paths = traces.map(trace => `${trace.method} ${trace.path}${trace.query}`)
    expect(paths).toContain('GET /v1/images/batches/models')
    expect(paths).toContain('POST /v1/images/batches')
    expect(paths).toContain(`GET /v1/images/batches/${first.id}/items/cover%2F001/content?image_index=0`)
    expect(paths).toContain(`GET /v1/images/batches/${first.id}/download`)
    expect(paths).toContain(`DELETE /v1/images/batches/${first.id}/outputs`)
    expect(traces.some(trace => trace.status === 404 && trace.requestId === 'route-fixture')).toBe(true)
    expect(traces.every(trace => trace.bodyHash)).toBe(true)
  })
})
