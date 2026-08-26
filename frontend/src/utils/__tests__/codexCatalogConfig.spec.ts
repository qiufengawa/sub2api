import { describe, expect, it } from 'vitest'
import {
  findCodexCatalogModel,
  formatCodexReasoningEffortTomlLine,
  parseCodexCatalogModels,
  selectCodexConfigReasoningEffort
} from '@/utils/codexCatalogConfig'

describe('codexCatalogConfig', () => {
  it('parses valid model slugs', () => {
    const content = JSON.stringify({ models: [{ slug: 'gpt-5.5' }, { slug: '  ' }] })
    expect(parseCodexCatalogModels(content).map((model) => model.slug)).toEqual(['gpt-5.5'])
    expect(findCodexCatalogModel(content, 'gpt-5.5')?.slug).toBe('gpt-5.5')
  })

  it('omits unsupported or none-only effort values', () => {
    expect(selectCodexConfigReasoningEffort({
      slug: 'custom',
      default_reasoning_level: 'xhigh',
      supported_reasoning_levels: [{ effort: 'none' }]
    })).toBeNull()
    expect(formatCodexReasoningEffortTomlLine(null)).toBe('')
  })

  it('uses a supported catalog default', () => {
    const effort = selectCodexConfigReasoningEffort({
      slug: 'gpt-5.5',
      default_reasoning_level: 'medium',
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }]
    })
    expect(effort).toBe('medium')
    expect(formatCodexReasoningEffortTomlLine(effort)).toBe('model_reasoning_effort = "medium"\n')
  })
})
