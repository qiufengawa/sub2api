import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import EmailTemplateEditor from '@/views/admin/settings/EmailTemplateEditor.vue'

const mocks = vi.hoisted(() => ({
  getEmailTemplates: vi.fn(),
  getEmailTemplate: vi.fn(),
  previewEmailTemplate: vi.fn(),
  restoreOfficialEmailTemplate: vi.fn(),
  updateEmailTemplate: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('zh-CN')
  })
}))

vi.mock('@/stores', () => ({
  useAppStore: () => ({
    showSuccess: mocks.showSuccess,
    showError: mocks.showError
  })
}))

vi.mock('@/api', () => ({
  adminAPI: {
    settings: {
      getEmailTemplates: mocks.getEmailTemplates,
      getEmailTemplate: mocks.getEmailTemplate,
      previewEmailTemplate: mocks.previewEmailTemplate,
      restoreOfficialEmailTemplate: mocks.restoreOfficialEmailTemplate,
      updateEmailTemplate: mocks.updateEmailTemplate
    }
  }
}))

describe('EmailTemplateEditor', () => {
  beforeEach(() => {
    mocks.getEmailTemplates.mockReset().mockResolvedValue({
      events: ['auth.verify_code'],
      locales: ['zh-CN'],
      placeholders: ['site_name']
    })
    mocks.getEmailTemplate.mockReset().mockResolvedValue({
      subject: 'Custom subject',
      html: '<p>Custom</p>',
      is_custom: true,
      placeholders: ['site_name']
    })
    mocks.previewEmailTemplate.mockReset().mockResolvedValue({
      subject: 'Preview',
      html: '<p>Preview</p>'
    })
    mocks.restoreOfficialEmailTemplate.mockReset().mockResolvedValue({
      subject: 'Official subject',
      html: '<p>Official</p>',
      is_custom: false,
      placeholders: ['site_name']
    })
    mocks.updateEmailTemplate.mockReset()
    mocks.showSuccess.mockReset()
    mocks.showError.mockReset()
  })

  it('restores an official template only after the shared confirmation dialog', async () => {
    const wrapper = mount(EmailTemplateEditor, {
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    const restoreButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'admin.settings.emailTemplates.restoreOfficial')
    expect(restoreButton).toBeTruthy()
    await restoreButton!.trigger('click')

    expect(mocks.restoreOfficialEmailTemplate).not.toHaveBeenCalled()
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.text()).toContain('admin.settings.emailTemplates.restoreConfirm')

    const confirmButton = dialog
      .findAll('button')
      .find((button) => button.text() === 'admin.settings.emailTemplates.restoreOfficial')
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(mocks.restoreOfficialEmailTemplate).toHaveBeenCalledWith(
      'auth.verify_code',
      'zh-CN'
    )
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('#email-template-subject').element).toHaveProperty(
      'value',
      'Official subject'
    )
  })

  it('replaces MIME-only CID references in the browser preview', async () => {
    mocks.previewEmailTemplate.mockResolvedValueOnce({
      subject: 'Preview',
      html: '<img src="cid:qiu-email-verification@assets.qiu.invalid">'
    })

    const wrapper = mount(EmailTemplateEditor, {
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    const iframe = wrapper.get('iframe')
    expect(iframe.attributes('srcdoc')).not.toContain('cid:')
    expect(iframe.attributes('srcdoc')).toContain('data:image/gif;base64,')
  })
})
