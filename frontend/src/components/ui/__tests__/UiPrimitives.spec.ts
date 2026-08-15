import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiButton from '../UiButton.vue'
import UiCodeBlock from '../UiCodeBlock.vue'
import UiDataCell from '../UiDataCell.vue'
import UiIconButton from '../UiIconButton.vue'
import UiNumberStepper from '../UiNumberStepper.vue'
import UiProgressBar from '../UiProgressBar.vue'
import UiSegmentedControl from '../UiSegmentedControl.vue'
import UiTextField from '../UiTextField.vue'
import UiTextArea from '../UiTextArea.vue'

const iconStub = { template: '<i />' }

describe('Qiu UI primitive contracts', () => {
  it('applies semantic variants and compact density to buttons', () => {
    const wrapper = mount(UiButton, { props: { variant: 'primary', density: 'compact' }, slots: { default: '保存' } })
    expect(wrapper.get('button').classes()).toContain('ui-button--primary')
    expect(wrapper.get('button').classes()).toContain('ui-button--compact')
  })

  it('keeps embedded semantic icons unframed through icon-button variants', () => {
    const confirm = mount(UiIconButton, { props: { label: '确认', icon: 'check', variant: 'success' } })
    const cancel = mount(UiIconButton, { props: { label: '取消', icon: 'x', variant: 'danger' } })
    expect(confirm.get('button').classes()).toContain('ui-icon-button--success')
    expect(cancel.get('button').classes()).toContain('ui-icon-button--danger')
    expect(confirm.find('svg.lucide').exists()).toBe(true)
  })

  it('keeps copy actions unframed when they are embedded in content', () => {
    const dataCell = mount(UiDataCell, { props: { value: 'req_123', copyable: true } })
    const codeBlock = mount(UiCodeBlock, { props: { code: '{"plan":"standard"}', label: 'JSON' } })

    expect(dataCell.get('button').classes()).toContain('ui-icon-button--ghost')
    expect(codeBlock.get('button').classes()).toContain('ui-icon-button--ghost')
  })

  it('keeps priority unbounded while enforcing the minimum', async () => {
    const wrapper = mount(UiNumberStepper, { props: { modelValue: 101, min: 0, step: 10 }, global: { stubs: { Icon: iconStub } } })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([111])
  })

  it('renders help as a non-error field affordance', () => {
    const wrapper = mount(UiTextField, { props: { modelValue: '', label: '密码', help: '至少 6 个字符' }, global: { stubs: { Icon: iconStub, Teleport: true } } })
    expect(wrapper.get('label').text()).toBe('密码')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('button').attributes('aria-label')).toBe('至少 6 个字符')
  })

  it('forwards native validation constraints to the input element', () => {
    const wrapper = mount(UiTextField, {
      props: { modelValue: '', pattern: '^[a-z][a-z0-9_]*$' }
    })

    expect(wrapper.get('input').attributes('pattern')).toBe('^[a-z][a-z0-9_]*$')
  })

  it('uses the shared monospace font for structured multiline values', () => {
    const wrapper = mount(UiTextArea, {
      props: { modelValue: 'socks5://HOST:PORT', monospace: true }
    })

    expect(wrapper.get('textarea').classes()).toContain('ui-textarea--mono')
  })

  it('emits the selected segmented value', async () => {
    const wrapper = mount(UiSegmentedControl, { props: { modelValue: 'list', label: '视图', options: [{ label: '列表', value: 'list' }, { label: '图表', value: 'chart' }] } })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['chart'])
  })

  it('normalizes progress to a bounded percentage', () => {
    const wrapper = mount(UiProgressBar, { props: { value: 142, label: 'CPU' } })
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
    expect(wrapper.get('.ui-progress__meta').text()).toContain('100%')
  })
})
