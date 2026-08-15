import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import PlatformTypeBadge from '../PlatformTypeBadge.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

describe('PlatformTypeBadge Grok plans', () => {
  it('renders FREE and BASIC as Grok Free with a lightweight plan icon', async () => {
    const wrapper = mount(PlatformTypeBadge, {
      props: {
        platform: 'grok',
        type: 'oauth',
        planType: 'BASIC',
        subscriptionExpiresAt: '2027-01-01T00:00:00Z',
      },
    })

    expect(wrapper.text()).toContain('Grok Free')
    expect(wrapper.find('[data-testid="grok-free-plan-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="grok-plan-icon"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('2027-01-01')

    await wrapper.setProps({ planType: 'FREE' })
    expect(wrapper.text()).toContain('Grok Free')
    expect(wrapper.find('[data-testid="grok-free-plan-icon"]').exists()).toBe(true)
  })

  it('keeps SuperGrok labels compatible and marks paid Grok plans', async () => {
    const wrapper = mount(PlatformTypeBadge, {
      props: {
        platform: 'grok',
        type: 'oauth',
        planType: 'SuperGrok Heavy',
      },
    })

    expect(wrapper.text()).toContain('SuperGrok Heavy')
    expect(wrapper.find('[data-testid="grok-plan-icon"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="grok-free-plan-icon"]').exists()).toBe(false)
    expect(wrapper.html()).toContain('ui-badge--warning')

    await wrapper.setProps({ platform: 'openai', planType: 'free' })
    expect(wrapper.text()).toContain('Free')
    expect(wrapper.text()).not.toContain('Grok Free')
    expect(wrapper.find('[data-testid="grok-plan-icon"]').exists()).toBe(false)
  })

  it('uses shared semantic tones for free, SuperGrok, and Heavy', async () => {
    const free = mount(PlatformTypeBadge, {
      props: { platform: 'grok', type: 'oauth', planType: 'free' },
    })
    expect(free.html()).toContain('ui-badge--neutral')

    const superGrok = mount(PlatformTypeBadge, {
      props: { platform: 'grok', type: 'oauth', planType: 'supergrok' },
    })
    expect(superGrok.text()).toContain('SuperGrok')
    expect(superGrok.html()).toContain('ui-badge--info')
    expect(superGrok.find('[data-testid="grok-plan-icon"]').exists()).toBe(true)

    const heavy = mount(PlatformTypeBadge, {
      props: { platform: 'grok', type: 'oauth', planType: 'Heavy' },
    })
    expect(heavy.text()).toContain('Heavy')
    expect(heavy.html()).toContain('ui-badge--warning')
    expect(heavy.find('[data-testid="grok-plan-icon"]').exists()).toBe(true)

    const lite = mount(PlatformTypeBadge, {
      props: { platform: 'grok', type: 'oauth', planType: 'supergrok_lite' },
    })
    expect(lite.text()).toContain('SuperGrok Lite')
    expect(lite.html()).toContain('ui-badge--info')
  })
})

describe('PlatformTypeBadge secondary states', () => {
  it('keeps privacy and paid expiration semantics', () => {
    const wrapper = mount(PlatformTypeBadge, {
      props: {
        platform: 'openai',
        type: 'oauth',
        planType: 'plus',
        privacyMode: 'training_off',
        subscriptionExpiresAt: '2027-01-02T00:00:00Z',
      },
    })

    expect(wrapper.text()).toContain('Private')
    expect(wrapper.text()).toContain('admin.accounts.subscriptionExpires 2027-01-02')
    expect(wrapper.html()).toContain('ui-badge--success')
  })

  it('hides privacy outside supported oauth platforms and invalid expiration dates', () => {
    const wrapper = mount(PlatformTypeBadge, {
      props: {
        platform: 'anthropic',
        type: 'apikey',
        planType: 'pro',
        privacyMode: 'training_set_failed',
        subscriptionExpiresAt: 'invalid',
      },
    })

    expect(wrapper.text()).not.toContain('Fail')
    expect(wrapper.text()).not.toContain('admin.accounts.subscriptionExpires')
  })
})

describe('PlatformTypeBadge OpenAI authentication modes', () => {
  it('distinguishes Agent Identity, PAT, and OAuth accounts', async () => {
    const wrapper = mount(PlatformTypeBadge, {
      props: {
        platform: 'openai',
        type: 'oauth',
        authMode: 'agentIdentity',
      },
    })

    expect(wrapper.text()).toContain('Agent Identity')

    await wrapper.setProps({ authMode: 'personalAccessToken' })
    expect(wrapper.text()).toContain('PAT')
    expect(wrapper.text()).not.toContain('Agent Identity')

    await wrapper.setProps({ authMode: undefined })
    expect(wrapper.text()).toContain('OAuth')
  })
})
