import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiAlert from '../UiAlert.vue'
import UiSteps from '../UiSteps.vue'

describe('UI status semantics', () => {
  it('announces danger alerts assertively and informational alerts politely', () => {
    const danger = mount(UiAlert, { props: { tone: 'danger', message: 'Request failed' } })
    const info = mount(UiAlert, { props: { tone: 'info', message: 'Request queued' } })

    expect(danger.attributes('role')).toBe('alert')
    expect(info.attributes('role')).toBe('status')
  })

  it('marks the active step with aria-current', () => {
    const wrapper = mount(UiSteps, {
      props: {
        ariaLabel: 'Installation progress',
        current: 1,
        steps: [
          { key: 'database', label: 'Database' },
          { key: 'redis', label: 'Redis' },
          { key: 'admin', label: 'Admin' }
        ]
      }
    })

    expect(wrapper.get('ol').attributes('aria-label')).toBe('Installation progress')
    expect(wrapper.findAll('li')[1]?.attributes('aria-current')).toBe('step')
    expect(wrapper.findAll('li')[0]?.attributes('aria-current')).toBeUndefined()
  })
})
