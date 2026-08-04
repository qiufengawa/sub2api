import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/stores/app'
import { FeatureFlags, isFeatureFlagEnabled, makeSidebarFlag } from '@/utils/featureFlags'

describe('Playground feature flag', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('defaults to enabled when public settings are unavailable or omit the flag', () => {
    const store = useAppStore()

    expect(isFeatureFlagEnabled(FeatureFlags.playground)).toBe(true)
    expect(makeSidebarFlag(FeatureFlags.playground)()).toBe(true)

    store.cachedPublicSettings = {} as typeof store.cachedPublicSettings
    expect(isFeatureFlagEnabled(FeatureFlags.playground)).toBe(true)
  })

  it('honors explicit enabled and disabled values', () => {
    const store = useAppStore()

    store.cachedPublicSettings = { playground_enabled: false } as typeof store.cachedPublicSettings
    expect(isFeatureFlagEnabled(FeatureFlags.playground)).toBe(false)
    expect(makeSidebarFlag(FeatureFlags.playground)()).toBe(false)

    store.cachedPublicSettings = { playground_enabled: true } as typeof store.cachedPublicSettings
    expect(isFeatureFlagEnabled(FeatureFlags.playground)).toBe(true)
    expect(makeSidebarFlag(FeatureFlags.playground)()).toBe(true)
  })
})
