import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AvailableChannelsTable from '../AvailableChannelsTable.vue'
import type { UserAvailableChannel } from '@/api/channels'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key })
  }
})

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AvailableChannelsTable.vue')
const componentSource = readFileSync(componentPath, 'utf8')

const rows: UserAvailableChannel[] = [
  {
    name: 'Primary channel',
    description: 'Fast and reliable access',
    platforms: [
      {
        platform: 'anthropic',
        groups: [
          {
            id: 1,
            name: 'Exclusive Pro',
            platform: 'anthropic',
            subscription_type: 'standard',
            rate_multiplier: 1.2,
            peak_rate_enabled: true,
            peak_start: '08:00',
            peak_end: '10:00',
            peak_rate_multiplier: 1.5,
            is_exclusive: true
          },
          {
            id: 2,
            name: 'Public',
            platform: 'anthropic',
            subscription_type: 'standard',
            rate_multiplier: 1,
            peak_rate_enabled: false,
            peak_start: '',
            peak_end: '',
            peak_rate_multiplier: 1,
            is_exclusive: false
          }
        ],
        supported_models: [{ name: 'claude-test', platform: 'anthropic', pricing: null }]
      }
    ]
  }
]

const baseProps = {
  columns: {
    channelInfo: 'Channel information',
    name: 'Channel',
    description: 'Description',
    platform: 'Platform',
    groups: 'Groups and rates',
    supportedModels: 'Models and pricing'
  },
  rows,
  loading: false,
  pricingKeyPrefix: 'availableChannels.pricing',
  noPricingLabel: 'No pricing',
  noModelsLabel: 'No models',
  emptyLabel: 'No channels',
  userGroupRates: { 1: 0.8 }
}

function mountTable(props = {}) {
  return mount(AvailableChannelsTable, {
    props: { ...baseProps, ...props },
    global: {
      plugins: [createPinia()],
      stubs: {
        Icon: { props: ['name'], template: '<i :data-icon="name" />' },
        PlatformIcon: { template: '<i data-platform-icon />' },
        SupportedModelChip: {
          props: ['model', 'noPricingLabel'],
          template: '<span data-model-chip>{{ model.name }}:{{ noPricingLabel }}</span>'
        }
      }
    }
  })
}

describe('AvailableChannelsTable', () => {
  it('uses one keyboard-scrollable table at every viewport without legacy table wrappers', () => {
    const wrapper = mountTable()

    expect(wrapper.get('[data-testid="available-channels-scroller"]').attributes('tabindex')).toBe('0')
    expect(wrapper.get('[data-testid="desktop-channels"]').exists()).toBe(true)
    expect(componentSource).not.toContain('TablePageLayout')
    expect(componentSource).not.toContain('table-wrapper')
    expect(componentSource).not.toMatch(/\b(?:btn|input|card)\b/)
    expect(componentSource).not.toContain('dark:')
    expect(componentSource).not.toContain('!important')
  })

  it('keeps the visually hidden actions header inside the table scroll boundary', () => {
    expect(componentSource).toContain('.sr-only {')
    expect(componentSource).toContain('position: static;')
    expect(componentSource).toContain('display: block;')
    expect(componentSource).toContain('margin: -1px;')
  })

  it('shows a compact summary and expands complete group, rate, peak, and model details', async () => {
    const wrapper = mountTable()
    const table = wrapper.get('[data-testid="desktop-channels"]')

    expect(table.findAll('thead th')).toHaveLength(5)
    expect(table.text()).toContain('Primary channel')
    expect(table.text()).toContain('Fast and reliable access')
    expect(table.text()).not.toContain('Exclusive Pro')

    const disclosure = table.get('button[aria-expanded="false"]')
    const detailsId = disclosure.attributes('aria-controls')
    expect(detailsId).toBe('available-channel-details-0')
    expect(table.find(`#${detailsId}`).exists()).toBe(false)
    await disclosure.trigger('click')

    expect(disclosure.attributes('aria-expanded')).toBe('true')
    expect(table.get(`#${detailsId}`).exists()).toBe(true)
    expect(table.text()).toContain('Exclusive Pro')
    expect(table.text()).toContain('1.2x')
    expect(table.text()).toContain('0.8x')
    expect(table.text()).toContain('08:00')
    expect(table.text()).toContain('10:00')
    expect(table.get('[data-model-chip]').text()).toBe('claude-test:No pricing')
  })

  it('keeps placeholders when a platform has no groups or models', async () => {
    const wrapper = mountTable({
      rows: [
        {
          name: 'Fallback channel',
          description: '',
          platforms: [{ platform: 'openai', groups: [], supported_models: [] }]
        }
      ]
    })

    await wrapper.get('button[aria-expanded="false"]').trigger('click')

    expect(wrapper.text()).toContain('Fallback channel')
    expect(wrapper.text()).toContain('No models')
    expect(wrapper.find('.channel-placeholder').text()).toBe('-')
  })

  it('renders stable loading geometry and a shared empty state', async () => {
    const wrapper = mountTable({ loading: true, rows: [] })

    expect(wrapper.findAll('[data-testid="channel-skeleton-row"]')).toHaveLength(5)
    await wrapper.setProps({ loading: false })

    expect(wrapper.text()).toContain('No channels')
  })
})
