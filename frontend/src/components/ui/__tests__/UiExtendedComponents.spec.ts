import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UiBulkActionBar from '../UiBulkActionBar.vue'
import UiChangeSet from '../UiChangeSet.vue'
import UiInlineEdit from '../UiInlineEdit.vue'
import UiKeyValueEditor from '../UiKeyValueEditor.vue'
import UiMultiCombobox from '../UiMultiCombobox.vue'
import UiStructuredEditor from '../UiStructuredEditor.vue'
import UiTabs from '../UiTabs.vue'
import UiTransferList from '../UiTransferList.vue'

describe('Qiu UI extended workflow components', () => {
  it('selects multiple controlled options', async () => {
    const wrapper = mount(UiMultiCombobox, {
      props: {
        modelValue: ['gpt'],
        options: [
          { label: 'GPT', value: 'gpt' },
          { label: 'Claude', value: 'claude' }
        ]
      }
    })
    await wrapper.get('.ui-multi__trigger').trigger('click')
    await wrapper.findAll('.ui-multi__options > button')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['gpt', 'claude']])
  })

  it('edits key-value rows without mutating the input model', async () => {
    const original = [{ key: 'X-Region', value: 'ap-sg' }]
    const wrapper = mount(UiKeyValueEditor, { props: { modelValue: original } })
    await wrapper.findAll('input')[1].setValue('us-east')
    expect(original[0].value).toBe('ap-sg')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[{ key: 'X-Region', value: 'us-east' }]])
  })

  it('validates and formats structured JSON', async () => {
    const wrapper = mount(UiStructuredEditor, { props: { modelValue: '{"plan":"standard"}' } })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('\n  "plan"')
    await wrapper.get('textarea').setValue('{bad')
    expect(wrapper.emitted('invalid')).toHaveLength(1)
  })

  it('moves options between transfer lists', async () => {
    const wrapper = mount(UiTransferList, {
      props: {
        modelValue: ['gpt'],
        options: [{ label: 'GPT', value: 'gpt' }, { label: 'Claude', value: 'claude' }]
      }
    })
    await wrapper.findAll('.ui-transfer__list button')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['gpt', 'claude']])
  })

  it('supports inline edit commit and workflow visibility', async () => {
    const wrapper = mount(UiInlineEdit, { props: { modelValue: 'Primary' } })
    await wrapper.get('button').trigger('click')
    await wrapper.get('input').setValue('Primary 2')
    await wrapper.get('input').trigger('keyup.enter')
    expect(wrapper.emitted('save')?.at(-1)).toEqual(['Primary 2'])

    const bulk = mount(UiBulkActionBar, { props: { selectedCount: 3 } })
    expect(bulk.text()).toContain('已选择 3 项')
    const changes = mount(UiChangeSet, { props: { changes: [{ field: 'priority', label: '优先度', before: 20, after: 80 }] } })
    expect(changes.text()).toContain('20')
    expect(changes.text()).toContain('80')
  })

  it('uses roving tabindex and arrow navigation for tabs', async () => {
    const wrapper = mount(UiTabs, { props: { modelValue: 'a', label: 'views', tabs: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] } })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('tabindex')).toBe('0')
    expect(buttons[1].attributes('tabindex')).toBe('-1')
    await buttons[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['b'])
  })
})
