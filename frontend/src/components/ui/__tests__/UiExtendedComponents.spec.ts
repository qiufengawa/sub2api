import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import UiBulkActionBar from '../UiBulkActionBar.vue'
import UiBackToTop from '../UiBackToTop.vue'
import UiChangeSet from '../UiChangeSet.vue'
import UiInlineEdit from '../UiInlineEdit.vue'
import UiKeyValueEditor from '../UiKeyValueEditor.vue'
import UiLink from '../UiLink.vue'
import UiMultiCombobox from '../UiMultiCombobox.vue'
import UiPageNav from '../UiPageNav.vue'
import UiStructuredEditor from '../UiStructuredEditor.vue'
import UiTagInput from '../UiTagInput.vue'
import UiDateTimeRangePicker from '../UiDateTimeRangePicker.vue'
import UiTimeInput from '../UiTimeInput.vue'
import UiTree from '../UiTree.vue'
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
      attachTo: document.body,
      props: {
        modelValue: ['gpt'],
        label: 'Models',
        options: [
          { label: 'GPT', value: 'gpt' },
          { label: 'Claude', value: 'claude' }
        ]
      }
    })
    const trigger = wrapper.get<HTMLButtonElement>('.ui-multi__trigger')
    expect(trigger.attributes('aria-label')).toBe('Models')
    expect(wrapper.get('label').attributes('for')).toBe(trigger.attributes('id'))
    await trigger.trigger('click')
    const listbox = wrapper.get('[role="listbox"]')
    expect(trigger.attributes('aria-controls')).toBe(listbox.attributes('id'))
    expect(document.activeElement).toBe(wrapper.get('.ui-search input').element)

    await wrapper.get('.ui-search input').trigger('keydown', { key: 'ArrowDown' })
    const options = wrapper.findAll<HTMLButtonElement>('.ui-multi__options > button')
    expect(document.activeElement).toBe(options[0].element)
    await options[0].trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(options[1].element)
    await options[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['gpt', 'claude']])
    await options[1].trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  it('edits key-value rows without mutating the input model', async () => {
    const original = [{ key: 'X-Region', value: 'ap-sg' }]
    const wrapper = mount(UiKeyValueEditor, { props: { modelValue: original } })
    await wrapper.findAll('input')[1].setValue('us-east')
    expect(original[0].value).toBe('ap-sg')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[{ key: 'X-Region', value: 'us-east' }]])
  })

  it('validates and formats structured JSON', async () => {
    const wrapper = mount(UiStructuredEditor, { props: { modelValue: '{"plan":"standard"}', label: 'Configuration' } })
    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('textarea').attributes('id'))
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toContain('\n  "plan"')
    await wrapper.get('textarea').setValue('{bad')
    expect(wrapper.emitted('invalid')).toHaveLength(1)
  })

  it('associates tag and date-time range controls with visible labels', async () => {
    const tags = mount(UiTagInput, { props: { modelValue: [], label: 'Models' } })
    expect(tags.get('label').attributes('for')).toBe(tags.get('input').attributes('id'))

    const range = mount(UiDateTimeRangePicker, {
      props: { startDate: '2026-01-01', startTime: '09:00', endDate: '2026-01-02', endTime: '10:00' },
    })
    expect(range.get('label[for$="-start-date"]')).toBeTruthy()
    expect(range.get('label[for$="-start-time"]')).toBeTruthy()
    expect(range.get('label[for$="-end-date"]')).toBeTruthy()
    expect(range.get('label[for$="-end-time"]')).toBeTruthy()
    await range.setProps({ startDate: '2026-02-03' })
    expect(range.get('input[type="date"]').element.value).toBe('2026-02-03')
  })

  it('keeps time input usable for invalid minute-step values', async () => {
    const wrapper = mount(UiTimeInput, { props: { modelValue: '', minuteStep: 0, label: 'Time' } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').attributes('id')).toMatch(/^ui-time-/)
  })

  it('exposes selection, hierarchy, and keyboard navigation for trees', async () => {
    const wrapper = mount(UiTree, {
      attachTo: document.body,
      props: {
        modelValue: 'child',
        items: [
          { key: 'parent', label: 'Parent', children: [{ key: 'child', label: 'Child' }] },
          { key: 'sibling', label: 'Sibling' },
        ],
      },
    })
    expect(wrapper.get('[role="tree"]').exists()).toBe(true)
    expect(wrapper.get('[role="group"]').exists()).toBe(true)
    expect(wrapper.find('[role="treeitem"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('[role="treeitem"]')[1].attributes('aria-level')).toBe('2')
    expect(wrapper.find('button[aria-current="true"]').text()).toContain('Child')

    const items = wrapper.findAll<HTMLElement>('[role="treeitem"]')
    items[1].element.focus()
    await items[1].trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2].element)
    await items[2].trigger('keydown', { key: 'Home' })
    expect(document.activeElement).toBe(items[0].element)
    await items[0].trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(items[1].element)
    await items[1].trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(items[0].element)
    await items[0].trigger('keydown', { key: 'End' })
    await items[2].trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['sibling'])
    wrapper.unmount()
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
    const wrapper = mount(UiTabs, { props: { modelValue: 'a', label: 'views', tabs: [{ label: 'A', value: 'a', id: 'tab-a', controls: 'panel-a' }, { label: 'B', value: 'b' }] } })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].attributes('tabindex')).toBe('0')
    expect(buttons[1].attributes('tabindex')).toBe('-1')
    expect(buttons[0].attributes('id')).toBe('tab-a')
    expect(buttons[0].attributes('aria-controls')).toBe('panel-a')
    await buttons[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['b'])
    await buttons[0].trigger('keydown', { key: 'ArrowDown' })
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

  it('renders internal destinations as focusable router links with hrefs', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/home', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(UiLink, {
      props: { to: '/home' },
      slots: { default: 'Home' },
      global: { plugins: [router] },
    })

    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('/home')
    expect(link.element.tabIndex).toBe(0)
  })

  it('preserves safe new-tab semantics for router destinations', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/home', component: { template: '<div />' } },
      ],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(UiLink, {
      props: { to: '/home', external: true },
      slots: { default: 'Home' },
      global: { plugins: [router] },
    })

    const link = wrapper.get('a')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
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
