import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAdminComplianceStore } from '@/stores/adminCompliance'

const getStatus = vi.fn()
const accept = vi.fn()

vi.mock('@/api/admin/compliance', () => ({
  default: {
    getStatus: (...args: unknown[]) => getStatus(...args),
    accept: (...args: unknown[]) => accept(...args),
  },
}))

vi.mock('@/i18n', () => ({
  getLocale: () => 'en',
}))

const status = {
  required: true,
  version: 'v1',
  document_path_zh: 'zh.md',
  document_path_en: 'en.md',
  document_url_zh: 'https://example.test/zh',
  document_url_en: 'https://example.test/en',
  ack_phrase_zh: '同意',
  ack_phrase_en: 'Agree',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('useAdminComplianceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getStatus.mockReset()
    accept.mockReset()
  })

  it('does not commit a status response after reset', async () => {
    const pending = deferred<typeof status>()
    getStatus.mockReturnValueOnce(pending.promise)
    const store = useAdminComplianceStore()
    const request = store.fetchStatus()

    store.reset()
    pending.resolve(status)

    await expect(request).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' })
    expect(store.status).toBeNull()
    expect(store.initialized).toBe(false)
    expect(store.loading).toBe(false)
  })

  it('keeps the newer fetch authoritative when an older request resolves late', async () => {
    const first = deferred<typeof status>()
    getStatus.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ ...status, version: 'v2' })
    const store = useAdminComplianceStore()
    const staleRequest = store.fetchStatus()
    const currentRequest = store.fetchStatus()

    await expect(currentRequest).resolves.toMatchObject({ version: 'v2' })
    first.resolve(status)

    await expect(staleRequest).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' })
    expect(store.status?.version).toBe('v2')
    expect(store.loading).toBe(false)
  })

  it('does not let a late accept response clear a newer submission state', async () => {
    const first = deferred<typeof status>()
    const second = deferred<typeof status>()
    accept.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const store = useAdminComplianceStore()

    const staleRequest = store.accept('Agree')
    const currentRequest = store.accept('Agree')
    first.resolve({ ...status, version: 'stale' })
    await expect(staleRequest).rejects.toMatchObject({ code: 'AUTH_SESSION_CHANGED' })
    expect(store.submitting).toBe(true)

    second.resolve({ ...status, required: false, version: 'current' })
    await expect(currentRequest).resolves.toMatchObject({ version: 'current' })
    expect(store.status?.version).toBe('current')
    expect(store.submitting).toBe(false)
  })
})
