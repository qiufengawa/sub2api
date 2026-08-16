import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import MonitorRunResultDialog from './MonitorRunResultDialog.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

describe('MonitorRunResultDialog', () => {
  it('adds the latency unit only when the probe returned a numeric latency', () => {
    const wrapper = mount(MonitorRunResultDialog, {
      props: {
        show: true,
        results: [
          { model: 'no-latency', status: 'failed', latency_ms: null, ping_latency_ms: null, message: '', checked_at: '' },
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
