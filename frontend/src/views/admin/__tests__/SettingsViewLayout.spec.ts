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
    expect(componentSource).toContain('@apply w-full max-w-full min-w-0 overflow-x-auto')
    expect(surfaceCount).toBe(tabBlockCount)
    expect(componentSource.match(/class="settings-section"/g)?.length).toBeGreaterThan(30)
    expect(componentSource).toContain('.settings-section + .settings-section')
  })
})
