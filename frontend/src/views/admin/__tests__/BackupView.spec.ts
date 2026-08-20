import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import { UiDataTable, UiErrorState } from '@/components/ui'
import BackupView from '../BackupView.vue'

const {
  getS3Config,
  getImageStorageConfig,
  getSchedule,
  updateSchedule,
  createBackup,
  listBackups,
  getBackup,
  getDownloadURL,
  restoreBackup,
} = vi.hoisted(() => ({
  getS3Config: vi.fn(),
  getImageStorageConfig: vi.fn(),
  getSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  createBackup: vi.fn(),
  listBackups: vi.fn(),
  getBackup: vi.fn(),
  getDownloadURL: vi.fn(),
  restoreBackup: vi.fn(),
}))

vi.mock('@/api', () => ({
  adminAPI: {
    backup: {
      getS3Config,
      updateS3Config: vi.fn(),
      testS3Connection: vi.fn(),
      getImageStorageConfig,
      updateImageStorageConfig: vi.fn(),
      testImageStorageConnection: vi.fn(),
      getSchedule,
      updateSchedule,
      createBackup,
      listBackups,
      getBackup,
      deleteBackup: vi.fn(),
      getDownloadURL,
      restoreBackup,
    },
  },
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showWarning: vi.fn(),
  }),
}))

vi.mock('@/composables/useStepUp', () => ({
  useStepUp: () => ({ run: (fn: () => unknown) => fn() }),
  isStepUpBlocked: () => false,
  isStepUpCancelled: () => false,
  stepUpBlockReason: () => '',
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.index === undefined ? key : `${key}:${params.index}`,
  }),
}))

const baseRecord = (id: string, parts?: unknown[]) => ({
  id,
  status: 'completed',
  backup_type: 'postgres',
  file_name: `${id}.sql.gz`,
  s3_key: `backups/${id}.sql.gz`,
  parts,
  size_bytes: 10,
  triggered_by: 'manual',
  started_at: '2026-08-09T00:00:00Z',
})

function mountBackupView() {
  return mount(BackupView, {
    global: {
      stubs: {
        TotpStepUpDialog: true,
      },
    },
  })
}

describe('admin BackupView 分卷备份', () => {
  beforeEach(() => {
    getS3Config.mockReset()
    getImageStorageConfig.mockReset()
    getSchedule.mockReset()
    updateSchedule.mockReset()
    createBackup.mockReset()
    listBackups.mockReset()
    getBackup.mockReset()
    getDownloadURL.mockReset()
    restoreBackup.mockReset()
    getS3Config.mockResolvedValue({})
    getImageStorageConfig.mockResolvedValue({ config: {}, secret_configured: false })
    getSchedule.mockResolvedValue({ enabled: false, cron_expr: '', retain_days: 14, retain_count: 10 })
    listBackups.mockResolvedValue({ items: [] })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('显示分卷数并在下载时列出每个分卷链接', async () => {
    listBackups.mockResolvedValue({
      items: [baseRecord('split', [{ index: 1 }, { index: 2 }, { index: 3 }])],
    })
    getDownloadURL.mockResolvedValue({
      parts: [
        { index: 1, size_bytes: 5, url: 'https://example.test/part-1' },
        { index: 2, size_bytes: 6, url: 'https://example.test/part-2' },
        { index: 3, size_bytes: 7, url: 'https://example.test/part-3' },
      ],
    })

    const wrapper = mountBackupView()
    await flushPromises()

    expect(wrapper.text()).toContain('3')
    const downloadButton = wrapper.get('button[aria-label="admin.backup.actions.download"]')
    await downloadButton.trigger('click')
    await flushPromises()

    expect(document.body.textContent).toContain('admin.backup.actions.partLabel:1')
    expect(document.body.textContent).toContain('admin.backup.actions.partLabel:3')
    expect(document.body.querySelector('a[href="https://example.test/part-2"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('旧单文件记录仍使用单个下载地址', async () => {
    listBackups.mockResolvedValue({ items: [baseRecord('legacy')] })
    getDownloadURL.mockResolvedValue({ url: 'https://example.test/legacy.sql.gz' })

    const wrapper = mountBackupView()
    await flushPromises()
    const downloadButton = wrapper.get('button[aria-label="admin.backup.actions.download"]')
    await downloadButton.trigger('click')
    await flushPromises()

    expect(getDownloadURL).toHaveBeenCalledWith('legacy')
    expect(document.body.textContent).not.toContain('admin.backup.actions.downloadParts')
    wrapper.unmount()
  })

  it('运行中的备份不显示删除入口', async () => {
    listBackups.mockResolvedValue({
      items: [{ ...baseRecord('running'), status: 'running', progress: 'uploading' }],
    })

    const wrapper = mountBackupView()
    await flushPromises()

    expect(wrapper.find('tbody tr td:nth-child(5)').text()).toBe('-')
    expect(wrapper.find('button[aria-label="common.delete"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('通过共享密码弹窗提交准确的恢复目标', async () => {
    listBackups.mockResolvedValue({ items: [baseRecord('restore-me')] })
    restoreBackup.mockResolvedValue({ ...baseRecord('restore-me'), restore_status: 'running' })
    const wrapper = mountBackupView()
    await flushPromises()

    expect(wrapper.getComponent(UiDataTable).props('mobileTable')).toBe(true)
    await wrapper.get('button[aria-label="admin.backup.actions.restore"]').trigger('click')
    await flushPromises()

    const password = document.body.querySelector('input[type="password"]') as HTMLInputElement
    expect(password).not.toBeNull()
    password.value = 'database-password'
    password.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()

    const confirm = Array.from(document.body.querySelectorAll('button')).find(button =>
      button.textContent?.includes('admin.backup.actions.restore'),
    )
    expect(confirm).toBeDefined()
    confirm!.click()
    await flushPromises()

    expect(restoreBackup).toHaveBeenCalledWith('restore-me', 'database-password')
    wrapper.unmount()
  })

  it('renders persistent load failures and recovers each workspace independently', async () => {
    getS3Config.mockRejectedValueOnce(new Error('s3 failed'))
    getImageStorageConfig.mockRejectedValueOnce(new Error('image storage failed'))
    getSchedule.mockRejectedValueOnce(new Error('schedule failed'))
    listBackups.mockRejectedValueOnce(new Error('backups failed'))
    const wrapper = mountBackupView()
    await flushPromises()
    const vm = wrapper.vm as any

    expect(vm.s3LoadError).toBe(true)
    expect(vm.imageStorageLoadError).toBe(true)
    expect(vm.scheduleLoadError).toBe(true)
    expect(vm.backupsLoadError).toBe(true)
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(3)
    expect(wrapper.getComponent(UiErrorState).text()).toContain('errors.networkError')

    listBackups.mockResolvedValueOnce({ items: [] })

    await Promise.all([
      vm.loadS3Config(),
      vm.loadImageStorageConfig(),
      vm.loadSchedule(),
      vm.loadBackups(),
    ])
    await flushPromises()

    expect(vm.s3LoadError).toBe(false)
    expect(vm.imageStorageLoadError).toBe(false)
    expect(vm.scheduleLoadError).toBe(false)
    expect(vm.backupsLoadError).toBe(false)
    wrapper.unmount()
  })

  it('preserves zero-valued retention settings in the save payload', async () => {
    getSchedule.mockResolvedValue({ enabled: true, cron_expr: '0 2 * * *', retain_days: 0, retain_count: 0 })
    updateSchedule.mockResolvedValue(undefined)
    const wrapper = mountBackupView()
    await flushPromises()
    const vm = wrapper.vm as any

    expect(vm.scheduleForm.retain_days).toBe(0)
    expect(vm.scheduleForm.retain_count).toBe(0)
    await vm.saveSchedule()

    expect(updateSchedule).toHaveBeenCalledWith(expect.objectContaining({ retain_days: 0, retain_count: 0 }))
    wrapper.unmount()
  })

  it('recovers a running backup from the normalized flat 409 response', async () => {
    const running = { ...baseRecord('already-running'), status: 'running' }
    listBackups
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [running] })
    createBackup.mockRejectedValue({ status: 409, message: 'already running' })
    const wrapper = mountBackupView()
    await flushPromises()
    const vm = wrapper.vm as any

    await vm.createBackup()

    expect(listBackups).toHaveBeenCalledTimes(2)
    expect(vm.creatingBackup).toBe(true)
    expect(vm.backups[0].id).toBe('already-running')
    wrapper.unmount()
  })

  it('clears stale busy state after the page becomes visible and operations have finished', async () => {
    const wrapper = mountBackupView()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.creatingBackup = true
    vm.restoringId = 'finished-restore'
    listBackups.mockResolvedValueOnce({ items: [baseRecord('finished')] })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)

    vm.handleVisibilityChange()
    await flushPromises()

    expect(vm.creatingBackup).toBe(false)
    expect(vm.restoringId).toBe('')
    wrapper.unmount()
  })

  it('does not let an older backup list response overwrite a visibility refresh', async () => {
    const running = { ...baseRecord('new-running'), status: 'running' }
    let resolveInitial!: (value: { items: ReturnType<typeof baseRecord>[] }) => void
    listBackups
      .mockImplementationOnce(() => new Promise(resolve => { resolveInitial = resolve }))
      .mockResolvedValueOnce({ items: [running] })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)

    const wrapper = mountBackupView()
    await vi.waitFor(() => expect(listBackups).toHaveBeenCalledTimes(1))
    const vm = wrapper.vm as any
    vm.handleVisibilityChange()
    await vi.waitFor(() => expect(listBackups).toHaveBeenCalledTimes(2))
    await flushPromises()

    expect(vm.backups.map((record: { id: string }) => record.id)).toEqual(['new-running'])
    expect(vm.creatingBackup).toBe(true)

    resolveInitial({ items: [] })
    await flushPromises()
    expect(vm.backups.map((record: { id: string }) => record.id)).toEqual(['new-running'])
    expect(vm.backupsLoadError).toBe(false)
    wrapper.unmount()
  })

  it('keeps backup polling single-flight when an upstream request is slow', async () => {
    vi.useFakeTimers()
    let resolveFirst!: (record: ReturnType<typeof baseRecord>) => void
    getBackup.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
    const wrapper = mountBackupView()
    await flushPromises()
    const vm = wrapper.vm as any

    vm.creatingBackup = true
    vm.startPolling('slow')
    await vi.advanceTimersByTimeAsync(4000)
    expect(getBackup).toHaveBeenCalledTimes(1)

    resolveFirst({ ...baseRecord('slow'), status: 'running' })
    await flushPromises()
    getBackup.mockResolvedValueOnce({ ...baseRecord('slow'), status: 'running' })
    await vi.advanceTimersByTimeAsync(2000)
    expect(getBackup).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
