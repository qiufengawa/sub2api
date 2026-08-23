import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import GeetestCaptchaWidget, {
  type GeetestCaptchaProof
} from '@/components/GeetestCaptchaWidget.vue'

describe('GeetestCaptchaWidget', () => {
  const proof: GeetestCaptchaProof = {
    lot_number: 'lot-1',
    captcha_output: 'output-1',
    pass_token: 'pass-1',
    gen_time: '1710000000'
  }

  let onSuccess: (() => void) | undefined
  let onClose: (() => void) | undefined
  let showCaptcha: ReturnType<typeof vi.fn>
  let config: Record<string, unknown> | undefined

  beforeEach(() => {
    onSuccess = undefined
    onClose = undefined
    showCaptcha = vi.fn()
    config = undefined
    window.initGeetest4 = vi.fn((nextConfig, callback) => {
      config = nextConfig
      callback({
        onReady: (ready) => ready(),
        onSuccess: (success) => { onSuccess = success },
        onClose: (close) => { onClose = close },
        getValidate: () => proof,
        showCaptcha
      })
    })
  })

  afterEach(() => {
    delete window.initGeetest4
  })

  it('uses the documented bind product and opens the official dialog', async () => {
    const wrapper = mount(GeetestCaptchaWidget, {
      props: { captchaId: 'captcha-id' }
    })
    await flushPromises()

    expect(config).toMatchObject({
      captchaId: 'captcha-id',
      product: 'bind',
      language: 'zho'
    })
    await wrapper.get('button').trigger('click')
    expect(showCaptcha).toHaveBeenCalledOnce()

    onSuccess?.()
    await flushPromises()
    expect(wrapper.get('button').text()).toContain('验证通过')

    // A manual click may complete the challenge before the login form calls
    // verifyAction. The proof must be reusable instead of returning null.
    await expect((wrapper.vm as unknown as { verify: () => Promise<GeetestCaptchaProof | null> }).verify())
      .resolves.toEqual(proof)

    onClose?.()
    await expect((wrapper.vm as unknown as { verify: () => Promise<GeetestCaptchaProof | null> }).verify())
      .resolves.toEqual(proof)
  })
})
