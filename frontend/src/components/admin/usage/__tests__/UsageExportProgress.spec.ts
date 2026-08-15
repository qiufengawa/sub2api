import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key,
    }),
  }
})

import UsageExportProgress from '../UsageExportProgress.vue'

const UiDialogStub = {
  name: 'UiDialog',
  props: ['show'],
  emits: ['close'],
  template: '<section v-if="show"><button data-close @click="$emit(\'close\')">close</button><slot/></section>',
}

const UiExportJobStub = {
  name: 'UiExportJob',
  props: ['progress', 'message', 'progressLabel'],
  emits: ['cancel'],
  template: '<div><button data-cancel @click="$emit(\'cancel\')">cancel</button></div>',
}

function mountProgress(progress: number, estimatedTime = '') {
  return mount(UsageExportProgress, {
    props: { show: true, progress, current: 25, total: 80, estimatedTime },
    global: { stubs: { UiDialog: UiDialogStub, UiExportJob: UiExportJobStub } },
  })
}

describe('UsageExportProgress', () => {
  it.each([
    [Number.NaN, 0],
    [-3, 0],
    [42.6, 43],
    [130, 100],
  ])('normalizes progress %s to %s', (input, expected) => {
    const wrapper = mountProgress(input)
    const job = wrapper.getComponent({ name: 'UiExportJob' })
    expect(job.props('progress')).toBe(expected)
    expect(job.props('progressLabel')).toContain(`${expected}%`)
    expect(job.props('message')).toContain('"current":25')
    expect(job.props('message')).toContain('"total":80')
  })

  it('emits cancel from both the dialog close action and export job action', async () => {
    const wrapper = mountProgress(40)
    await wrapper.get('[data-close]').trigger('click')
    await wrapper.get('[data-cancel]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(2)
  })

  it('renders ETA only when supplied', () => {
    expect(mountProgress(40).find('.usage-export__eta').exists()).toBe(false)
    expect(mountProgress(40, '12s').get('.usage-export__eta').text()).toContain('12s')
  })
})
