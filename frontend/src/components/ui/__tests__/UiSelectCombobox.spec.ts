import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import UiCombobox from '../UiCombobox.vue'
import UiSelect from '../UiSelect.vue'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const wrappers: VueWrapper[] = []

afterEach(() => {
  while (wrappers.length) wrappers.pop()?.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('UiSelect', () => {
  it('connects field feedback and caller aria attributes to the trigger', () => {
    const wrapper = mount(UiSelect, {
      attachTo: document.body,
      props: {
        id: 'group',
        modelValue: null,
        label: 'Group',
        error: 'Choose a group',
        options: [{ value: 'primary', label: 'Primary' }],
        'aria-labelledby': 'external-label',
        'data-testid': 'group-select'
      }
    })
    wrappers.push(wrapper)
    const trigger = wrapper.get('[role="combobox"]')
    expect(trigger.attributes('id')).toBe('group')
    expect(trigger.attributes('aria-describedby')).toBe('group-message')
    expect(trigger.attributes('aria-invalid')).toBe('true')
    expect(trigger.attributes('aria-labelledby')).toBe('external-label')
    expect(trigger.attributes('data-testid')).toBe('group-select')
  })

  it('selects with the keyboard and skips group headers and disabled options', async () => {
    const wrapper = mount(UiSelect, {
      attachTo: document.body,
      props: {
        modelValue: null,
        options: [
          { value: 'heading', label: 'Models', kind: 'group' },
          { value: 'disabled', label: 'Disabled', disabled: true },
          { value: 'ready', label: 'Ready' }
        ]
      }
    })
    wrappers.push(wrapper)
    const trigger = wrapper.get('[role="combobox"]')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await wrapper.vm.$nextTick()
    expect(trigger.attributes('aria-activedescendant')).toContain('option-2')
    await trigger.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['ready']])
    expect(wrapper.emitted('change')?.[0]?.[0]).toBe('ready')
  })

  it('keeps clear as a separate keyboard-focusable action', async () => {
    const wrapper = mount(UiSelect, {
      attachTo: document.body,
      props: {
        modelValue: 'primary',
        clearable: true,
        options: [{ value: 'primary', label: 'Primary' }]
      }
    })
    wrappers.push(wrapper)
    const trigger = wrapper.get('[role="combobox"]')
    const clear = wrapper.get('.ui-select__clear')
    expect(clear.element.parentElement).not.toBe(trigger.element)
    await clear.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[null]])
    expect(wrapper.emitted('change')).toEqual([[null, null]])
  })

  it('forwards search and create semantics to the shared select control', async () => {
    const wrapper = mount(UiSelect, {
      attachTo: document.body,
      props: {
        modelValue: null,
        searchable: true,
        creatable: true,
        creatablePrefix: 'Use',
        searchPlaceholder: 'Find model',
        options: [{ value: 'gpt', label: 'GPT' }]
      }
    })
    wrappers.push(wrapper)

    await wrapper.get('[role="combobox"]').trigger('click')
    const search = document.body.querySelector<HTMLInputElement>('.ui-select__search-input')
    expect(search?.placeholder).toBe('Find model')
    expect(document.body.querySelector('.ui-select__option-label')?.textContent).toBe('GPT')

    search!.value = 'custom-model'
    search!.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.ui-select__option-label')?.textContent).toContain('Use')
  })
})

describe('UiCombobox', () => {
  it('searches descriptions and creates a trimmed value from the first result', async () => {
    const wrapper = mount(UiCombobox, {
      attachTo: document.body,
      props: {
        modelValue: null,
        creatable: true,
        creatablePrefix: 'Use',
        options: [{ value: 'claude', label: 'Claude', description: 'Anthropic model' }]
      }
    })
    wrappers.push(wrapper)
    await wrapper.get('[role="combobox"]').trigger('click')
    const search = document.body.querySelector<HTMLInputElement>('.ui-select__search-input')
    if (!search) throw new Error('search input missing')
    await wrapper.vm.$nextTick()
    search.value = '  custom-model  '
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.ui-select__option-label')?.textContent).toBe('Use "custom-model"')
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(wrapper.emitted('update:modelValue')).toEqual([['custom-model']])
  })

  it('forwards selected and option slots', async () => {
    const wrapper = mount(UiCombobox, {
      attachTo: document.body,
      props: {
        modelValue: 'gpt',
        options: [{ value: 'gpt', label: 'GPT', provider: 'OpenAI' }]
      },
      slots: {
        selected: '<template #selected="{ option }"><span class="selected-slot">{{ option.label }}</span></template>',
        option: '<template #option="{ option }"><span class="option-slot">{{ option.provider }}</span></template>'
      }
    })
    wrappers.push(wrapper)
    expect(wrapper.get('.selected-slot').text()).toBe('GPT')
    await wrapper.get('[role="combobox"]').trigger('click')
    expect(document.body.querySelector('.option-slot')?.textContent).toBe('OpenAI')
  })
})
