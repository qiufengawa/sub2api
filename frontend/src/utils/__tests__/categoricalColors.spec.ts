import { describe, expect, it } from 'vitest'

import {
  getStableCategoryColor,
  OTHER_CATEGORY_COLOR,
  stableCategoryIndex,
} from '../categoricalColors'

describe('categorical colors', () => {
  it('maps the same normalized key to the same color', () => {
    expect(getStableCategoryColor(' GPT-4.1 ')).toBe(getStableCategoryColor('gpt-4.1'))
    expect(stableCategoryIndex('claude-sonnet-4')).toBe(stableCategoryIndex('claude-sonnet-4'))
  })

  it('uses neutral gray for the aggregate other item', () => {
    expect(getStableCategoryColor('其他', true)).toBe(OTHER_CATEGORY_COLOR)
  })
})

