import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'

import Icon from '@/components/icons/Icon.vue'
import UiTimeInput from '../UiTimeInput.vue'

describe('Lucide icon and motion contracts', () => {
  it('renders the shared icon registry through Lucide', () => {
    const wrapper = mount(Icon, { props: { name: 'refresh', size: 'sm' } })
    expect(wrapper.find('svg.lucide').exists()).toBe(true)
    expect(wrapper.find('path').exists()).toBe(true)
  })

  it('opens the custom time panel and emits a normalized time', async () => {
    const wrapper = mount(UiTimeInput, {
      props: { modelValue: '09:30', minuteStep: 15 },
      global: { stubs: { Teleport: true } }
    })

    await wrapper.get('.ui-time-trigger').trigger('click')
    await nextTick()
    expect(wrapper.get('[aria-label="common.timePicker"]').isVisible()).toBe(true)
    await wrapper.get('[aria-label="common.hours"]').findAll('button')[10].trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['10:30'])
  })

  it('keeps semantic icons on Lucide and reserves inline SVG for charts', () => {
    const uiRoot = resolve(process.cwd(), 'src/components/ui')
    const inventory = readFileSync(resolve(uiRoot, '__tests__/UiSystemInventory.spec.ts'), 'utf8')
    const names = [...inventory.matchAll(/'((?:Ui|App)[A-Za-z]+)'/g)].map((match) => match[1])
    const svgOwners = names.filter((name) => {
      const path = resolve(uiRoot, `${name}.vue`)
      try { return /<(?:svg|path|polygon|rect)\b/.test(readFileSync(path, 'utf8')) } catch { return false }
    })

    expect(svgOwners.sort()).toEqual(['UiProgressRing', 'UiSparkline'])
  })

  it('defines reduced-motion fallbacks for the component system and showcase', () => {
    const tokens = readFileSync(resolve(process.cwd(), 'src/styles/ui-tokens.css'), 'utf8')
    const showcase = readFileSync(resolve(process.cwd(), '../docs/ui-showcase/showcase.css'), 'utf8')
    expect(tokens).toContain('prefers-reduced-motion: reduce')
    expect(showcase).toContain('prefers-reduced-motion:reduce')
  })

  it('uses Latin-first interface fonts and a dedicated code font stack', () => {
    const tokens = readFileSync(resolve(process.cwd(), 'src/styles/ui-tokens.css'), 'utf8')
    const editor = readFileSync(resolve(process.cwd(), 'src/components/ui/UiStructuredEditor.vue'), 'utf8')
    expect(tokens).toContain('--ui-font-latin: Inter')
    expect(tokens).toContain('--ui-font-mono: "SFMono-Regular", "Cascadia Code"')
    expect(editor).toContain('font:12px/1.65 var(--ui-font-mono)')
    expect(editor).toContain('font-variant-ligatures:none')
  })
})
