import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UiBulkActionBar from '../UiBulkActionBar.vue'
import UiBackToTop from '../UiBackToTop.vue'
import UiChangeSet from '../UiChangeSet.vue'
import UiInlineEdit from '../UiInlineEdit.vue'
import UiKeyValueEditor from '../UiKeyValueEditor.vue'
import UiLink from '../UiLink.vue'
import UiMultiCombobox from '../UiMultiCombobox.vue'
import UiPageNav from '../UiPageNav.vue'
import UiStructuredEditor from '../UiStructuredEditor.vue'
import UiTabs from '../UiTabs.vue'
import UiTransferList from '../UiTransferList.vue'

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Qiu UI extended workflow components', () => {
  it('selects multiple controlled options', async () => {
    const wrapper = mount(UiMultiCombobox, {
      props: {
        modelValue: ['gpt'],
        ariaLabel: 'Models',
        options: [
          { label: 'GPT', value: 'gpt' },
          { label: 'Claude', value: 'claude' }
        ]
      }
    })
    expect(wrapper.get('.ui-multi__trigger').attributes('aria-label')).toBe('Models')
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
    await wrapper.get('input').trigger('keydown.enter')
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

  it('supports localized page navigation fallbacks', () => {
    const wrapper = mount(UiPageNav, {
      props: {
        label: 'Document navigation',
        previousFallback: 'Previous document',
        nextFallback: 'Next document',
      },
    })

    expect(wrapper.get('nav').attributes('aria-label')).toBe('Document navigation')
    expect(wrapper.findAll('button').map(button => button.text())).toEqual([
      'Previous document',
      'Next document',
    ])
  })

  it('keeps long page-navigation labels inside equal-width items', () => {
    const longLabel = 'DocumentTitleWithoutBreaks'.repeat(4)
    const wrapper = mount(UiPageNav, {
      props: {
        previous: { key: 'previous', label: longLabel },
        next: { key: 'next', label: longLabel },
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    expect(buttons.every(button => button.classes().includes('ui-page-nav__item'))).toBe(true)
    expect(buttons.map(button => button.text())).toEqual([longLabel, longLabel])
  })

  it('keeps muted and brand navigation variants inside the shared link contract', () => {
    const muted = mount(UiLink, { props: { href: '#section', variant: 'muted' }, slots: { default: 'Section' } })
    const brand = mount(UiLink, { props: { href: '/home', variant: 'brand' }, slots: { default: 'Qiu API' } })

    expect(muted.get('a').classes()).toContain('ui-link--muted')
    expect(brand.get('a').classes()).toContain('ui-link--brand')
  })

  it('localizes back-to-top and removes smooth scrolling for reduced motion', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 })
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const wrapper = mount(UiBackToTop, { props: { label: 'Back to top', threshold: 100 } })
    await wrapper.vm.$nextTick()

    const button = wrapper.get('button[aria-label="Back to top"]')
    await button.trigger('click')
    expect(scrollTo).toHaveBeenCalledOnce()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
    wrapper.unmount()
  })
})
