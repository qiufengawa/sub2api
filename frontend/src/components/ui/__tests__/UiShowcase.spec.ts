import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import * as ui from '../index'

describe('standalone component showcase', () => {
  it('renders every public Vue component exactly once', () => {
    const pages = ['controls.html', 'navigation.html', 'feedback.html', 'data.html']
    const html = pages.map((page) => readFileSync(resolve(process.cwd(), `../docs/ui-showcase/${page}`), 'utf8')).join('\n')
    const names = [...html.matchAll(/data-component="([^"]+)"/g)].map((match) => match[1])
    const publicComponents = Object.keys(ui).filter((name) => name.startsWith('Ui') || name.startsWith('App'))

    expect(names).toHaveLength(114)
    expect(new Set(names).size).toBe(114)
    expect([...names].sort()).toEqual(publicComponents.sort())
  })
})
