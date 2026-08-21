import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../SettingsView.vue')
const componentSource = readFileSync(componentPath, 'utf8')

describe('admin SettingsView layout hierarchy', () => {
  it('groups settings into tab surfaces and divider sections instead of sibling cards', () => {
    const tabBlockCount = componentSource.match(/v-show="activeTab ===/g)?.length
    const surfaceCount = componentSource.match(
      /class="settings-panel(?: settings-panel-embedded)?"/g
    )?.length

    expect(componentSource).not.toContain('class="card"')
    expect(componentSource).toContain('mx-auto w-full min-w-0 max-w-6xl')
    expect(componentSource).toContain('class="min-w-0 space-y-6"')
    expect(componentSource).toContain('<UiTabs')
    expect(componentSource).toContain(':tabs="settingsTabOptions"')
    expect(componentSource).not.toContain('class="settings-tabs-scroll"')
    expect(surfaceCount).toBe(tabBlockCount)
    expect(componentSource.match(/class="settings-section"/g)?.length).toBeGreaterThan(30)
    expect(componentSource).toContain('.settings-section + .settings-section')
  })

  it('keeps compact controls aligned within dense policy, prompt, and payment rows', () => {
    const compactSelectOptions = [
      'betaPolicyActionOptions',
      'betaPolicyScopeOptions',
      'openaiFastPolicyTierOptions',
      'openaiFastPolicyActionOptions',
      'openaiFastPolicyScopeOptions',
      'claudeOAuthSystemPromptPresetOptions',
      'claudeOAuthSystemPromptBlockTypeOptions',
      'claudeOAuthSystemPromptCacheTTLOptions',
      'loadBalanceOptions',
      'cancelRateLimitModeOptions',
      'cancelRateLimitUnitOptions',
      'defaultSubscriptionPlanOptions',
    ]

    for (const optionName of compactSelectOptions) {
      const fragments = [
        ...componentSource.matchAll(
          new RegExp(
            `<Select\\b[\\s\\S]*?:options="${optionName}"[\\s\\S]*?\\/>`,
            'g',
          ),
        ),
      ].map((match) => match[0])

      expect(fragments.length, `${optionName} Select count`).toBeGreaterThan(0)
      expect(
        fragments.every((fragment) => fragment.includes('density="compact"')),
        `${optionName} Select density`,
      ).toBe(true)
    }

    for (const modelBinding of [
      'form.payment_cancel_rate_limit_window',
      'form.payment_cancel_rate_limit_max',
    ]) {
      const start = componentSource.indexOf(`v-model.number="${modelBinding}"`)
      expect(start, `${modelBinding} binding`).toBeGreaterThanOrEqual(0)
      const field = componentSource.slice(start, componentSource.indexOf('/>', start) + 2)
      expect(field, `${modelBinding} density`).toContain('density="compact"')
    }
  })

  it('limits the Web Search provider chevron transition to motion-safe preferences', () => {
    expect(componentSource).toContain('class="text-gray-400 motion-safe:transition-transform"')
    expect(componentSource).not.toContain('class="text-gray-400 transition-transform"')
  })

  it('gives every settings switch a semantic accessible name', () => {
    const switches = [...componentSource.matchAll(/<Toggle\b[\s\S]*?\/>/g)].map(
      (match) => match[0],
    )

    expect(switches.length).toBeGreaterThan(0)
    expect(
      switches.every((switchSource) => /(?:\:label|\baria-label)=/.test(switchSource)),
    ).toBe(true)
  })
})
