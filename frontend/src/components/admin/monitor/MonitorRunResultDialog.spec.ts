import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import MonitorRunResultDialog from './MonitorRunResultDialog.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

describe('MonitorRunResultDialog', () => {
  it('only shows currently requestable models and never renders upstream error reasons', () => {
    const wrapper = mount(MonitorRunResultDialog, {
      props: {
        show: true,
        results: [
          { model: 'available-model', status: 'operational', latency_ms: 20, ping_latency_ms: 4, message: '', checked_at: '' },
          { model: 'slow-but-requestable', status: 'degraded', latency_ms: 800, ping_latency_ms: 4, message: 'slow response', checked_at: '' },
          { model: 'blocked-model', status: 'error', latency_ms: null, ping_latency_ms: null, message: 'upstream secret error', checked_at: '' },
        ],
      },
      global: {
        stubs: {
          UiDialog: { props: ['show'], template: '<section v-if="show"><slot/><slot name="footer"/></section>' },
        },
      },
    })

    expect(wrapper.text()).toContain('available-model')
    expect(wrapper.text()).toContain('slow-but-requestable')
    expect(wrapper.text()).not.toContain('blocked-model')
    expect(wrapper.text()).not.toContain('upstream secret error')
    wrapper.unmount()
  })

  it('adds the latency unit only when the probe returned a numeric latency', () => {
    const wrapper = mount(MonitorRunResultDialog, {
      props: {
        show: true,
        results: [
          { model: 'no-latency', status: 'operational', latency_ms: null, ping_latency_ms: null, message: '', checked_at: '' },
          { model: 'fast', status: 'operational', latency_ms: 128, ping_latency_ms: 12, message: '', checked_at: '' },
        ],
      },
      global: {
        stubs: {
          UiDialog: { props: ['show'], template: '<section v-if="show"><slot/><slot name="footer"/></section>' },
        },
      },
    })

    expect(wrapper.text()).toContain('monitorCommon.latencyEmpty')
    expect(wrapper.text()).not.toContain('monitorCommon.latencyEmpty ms')
    expect(wrapper.text()).toContain('128 ms')
    wrapper.unmount()
  })
})
