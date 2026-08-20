import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AnnouncementsView from '../AnnouncementsView.vue'

const { list, create, update, remove, getAllGroups, showError, showSuccess } = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  getAllGroups: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    announcements: { list, create, update, delete: remove },
    groups: { getAll: getAllGroups },
  },
}))

vi.mock('@/stores/app', () => ({ useAppStore: () => ({ showError, showSuccess }) }))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const announcement = {
  id: 7,
  title: 'Maintenance',
  content: 'Scheduled work',
  status: 'active',
  notify_mode: 'popup',
  targeting: { any_of: [] },
  starts_at: null,
  ends_at: null,
  created_at: '2026-08-15T00:00:00Z',
  updated_at: '2026-08-15T00:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

const mountView = () => mount(AnnouncementsView, {
  global: {
    stubs: {
      AppLayout: { template: '<main><slot /></main>' },
      AppPage: { template: '<section><slot /></section>' },
      AppPageHeader: { template: '<header><slot name="actions" /></header>' },
      UiButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot name="icon"/><slot/></button>' },
      UiIconButton: { emits: ['click'], template: '<button @click="$emit(\'click\')" />' },
      UiSearchInput: { props: ['modelValue'], emits: ['update:modelValue', 'search'], template: '<input data-test="search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value); $emit(\'search\', $event.target.value)" />' },
      UiSelect: { props: ['modelValue', 'options'], emits: ['update:modelValue', 'change'], template: '<select data-test="status" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>' },
      UiTableToolbar: { template: '<div><slot/><slot name="actions"/></div>' },
      UiServerTableWorkspace: { template: '<div><slot name="toolbar"/><slot/><slot name="pagination"/></div>' },
      UiDataTable: {
        props: ['columns', 'data'],
        emits: ['sort'],
        template: '<div data-test="table"><div v-for="row in data" :key="row.id"><slot v-for="column in columns" :name="`cell-${column.key}`" :row="row" :value="row[column.key]" /></div><slot v-if="!data.length" name="empty"/></div>',
      },
      UiPagination: true,
      UiDialog: {
        props: ['show', 'title', 'width'],
        template: '<div v-if="show" data-test="announcement-dialog" :data-width="width" :aria-label="title"><slot/><slot name="footer"/></div>',
      },
      UiConfirmDialog: true,
      UiEmptyState: { template: '<div data-test="empty"><slot name="action"/></div>' },
      UiErrorState: { props: ['title'], emits: ['retry'], template: '<div data-test="error-state">{{ title }}<button data-test="retry" @click="$emit(\'retry\')">retry</button></div>' },
      UiBadge: true,
      UiStatusBadge: true,
      UiTextField: true,
      UiTextArea: true,
      AnnouncementTargetingEditor: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: '<div />',
      },
      AnnouncementReadStatusDialog: true,
      AnnouncementPopup: true,
      Icon: true,
    },
  },
})

describe('admin AnnouncementsView', () => {
  beforeEach(() => {
    vi.useRealTimers()
    list.mockReset().mockResolvedValue({ items: [announcement], total: 1, page: 1, page_size: 20, pages: 1 })
    create.mockReset().mockResolvedValue({})
    update.mockReset().mockResolvedValue({})
    remove.mockReset().mockResolvedValue({})
    getAllGroups.mockReset().mockResolvedValue([])
    showError.mockReset()
    showSuccess.mockReset()
  })

  it('loads the default page with server sorting', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(list).toHaveBeenCalledWith(1, 20, {
      status: undefined,
      search: undefined,
      sort_by: 'created_at',
      sort_order: 'desc',
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(wrapper.get('[data-test="table"]').text()).toContain('Maintenance')
  })

  it('keeps the announcement table keyboard-scrollable with the 940px mobile contract', async () => {
    const wrapper = mountView()
    await flushPromises()

    const scroller = wrapper.get('.ui-table-scroller')
    expect(scroller.attributes('role')).toBe('region')
    expect(scroller.attributes('tabindex')).toBe('0')
    expect(scroller.attributes('aria-label')).toBe('admin.announcements.title')
    expect(scroller.get(':scope > div').attributes('style')).toContain('min-width: 940px')
  })

  it('opens the editor through the shared wide dialog contract', async () => {
    const wrapper = mountView()
    await flushPromises()

    const createButton = wrapper.findAll('button').find((button) =>
      button.text().includes('admin.announcements.createAnnouncement'),
    )
    expect(createButton).toBeDefined()
    await createButton?.trigger('click')

    const dialog = wrapper.get('[data-test="announcement-dialog"]')
    expect(dialog.attributes('data-width')).toBe('wide')
    expect(dialog.attributes('aria-label')).toBe('admin.announcements.createAnnouncement')
  })

  it('reserves the table workspace while the first request is pending', async () => {
    const request = deferred<any>()
    list.mockReturnValueOnce(request.promise)
    const wrapper = mountView()

    expect((wrapper.vm as any).loading).toBe(true)
    request.resolve({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
    await flushPromises()
    expect((wrapper.vm as any).loading).toBe(false)
    wrapper.unmount()
  })

  it('keeps existing rows and a persistent alert when refresh fails', async () => {
    const wrapper = mountView()
    await flushPromises()
    list.mockRejectedValueOnce(new Error('network'))

    await (wrapper.vm as any).loadAnnouncements()

    expect((wrapper.vm as any).loadError).toBe(true)
    expect((wrapper.vm as any).announcements).toEqual([announcement])
    expect(wrapper.text()).toContain('admin.announcements.failedToLoad')
    expect(showError).toHaveBeenCalledWith('admin.announcements.failedToLoad')
    wrapper.unmount()
  })

  it('reloads from page one when searching or changing status', async () => {
    const wrapper = mountView()
    await flushPromises()
    list.mockClear()

    await wrapper.get('[data-test="search"]').setValue('incident')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ search: 'incident' }), expect.anything())

    await wrapper.get('[data-test="status"]').setValue('draft')
    await flushPromises()
    expect(list).toHaveBeenLastCalledWith(1, 20, expect.objectContaining({ status: 'draft' }), expect.anything())
  })

  it('renders the empty-state action when the server has no rows', async () => {
    list.mockResolvedValueOnce({ items: [], total: 0, page: 1, page_size: 20, pages: 0 })
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.get('[data-test="empty"]')).toBeTruthy()
  })

  it('prevents duplicate deletes until the table refresh completes', async () => {
    const wrapper = mountView()
    await flushPromises()
    const request = deferred<unknown>()
    remove.mockReturnValueOnce(request.promise)
    const vm = wrapper.vm as any
    vm.handleDelete(announcement)

    const first = vm.confirmDelete()
    const second = vm.confirmDelete()
    expect(remove).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith(announcement.id)
    expect(vm.deleting).toBe(true)

    request.resolve({})
    await Promise.all([first, second])
    expect(vm.deleting).toBe(false)
    expect(vm.showDeleteDialog).toBe(false)
    expect(showSuccess).toHaveBeenCalledWith('common.success')
    expect(list).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('locks the editing session while save is pending and ignores stale completion cleanup', async () => {
    const request = deferred<unknown>()
    update.mockReturnValueOnce(request.promise)
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any
    const second = { ...announcement, id: 8, title: 'Second announcement' }
    vm.openEditDialog(announcement)

    const save = vm.handleSave()
    expect(vm.saving).toBe(true)
    vm.closeEdit()
    vm.openEditDialog(second)
    expect(vm.showEditDialog).toBe(true)
    expect(vm.editingAnnouncement.id).toBe(announcement.id)

    vm.editingAnnouncement = second
    request.resolve({})
    await save
    await flushPromises()

    expect(update).toHaveBeenCalledWith(announcement.id, {})
    expect(vm.showEditDialog).toBe(true)
    expect(vm.editingAnnouncement.id).toBe(second.id)
    expect(vm.saving).toBe(false)
    wrapper.unmount()
  })

  it('does not submit an invalid custom targeting rule', async () => {
    const wrapper = mountView()
    await flushPromises()
    const vm = wrapper.vm as any
    vm.form.targeting = {
      any_of: [{ all_of: [{ type: 'subscription', operator: 'in', group_ids: [] }] }],
    }

    await vm.handleSave()

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith('admin.announcements.form.selectPackages')
    wrapper.unmount()
  })
})
