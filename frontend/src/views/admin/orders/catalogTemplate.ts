import type { AdminGroup, CompositeModelRoute, GroupPlatform } from '@/types'
import type { PaymentCatalogImportRequest, PaymentCatalogRoute } from '@/types/payment'

const MAX_ACCOUNT_SOURCES = 100
const MAX_ROUTES_PER_GROUP = 100
const MAX_ROUTES_TOTAL = 1000

export type CatalogAccountSourceGroup = Pick<
  AdminGroup,
  'id' | 'name' | 'status' | 'account_count' | 'platform'
>

export interface CatalogTemplateSourceSnapshot {
  group: CatalogAccountSourceGroup
  models?: string[]
  routes?: CompositeModelRoute[]
}

export interface CatalogTemplateRouteBuild {
  routes: PaymentCatalogRoute[]
  omittedCount: number
}

export interface CatalogTemplateSourceSelection {
  sources: CatalogAccountSourceGroup[]
  omittedCount: number
}

export interface CatalogTemplateSourceLoaders {
  loadModels: (group: CatalogAccountSourceGroup) => Promise<string[]>
  loadRoutes: (group: CatalogAccountSourceGroup) => Promise<CompositeModelRoute[]>
}

export interface InstallationCatalogTemplate extends PersonalizedCatalogTemplate {
  failedSourceCount: number
}

export interface PersonalizedCatalogTemplate {
  catalog: PaymentCatalogImportRequest
  sourceCount: number
  routeCount: number
  omittedSourceCount: number
  omittedRouteCount: number
}

export function isPaymentCatalogTemplate(value: unknown): value is PaymentCatalogImportRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<PaymentCatalogImportRequest>
  return candidate.schema_version === 1
    && candidate.mode === 'upsert'
    && Boolean(candidate.defaults && typeof candidate.defaults === 'object')
    && Array.isArray(candidate.groups)
    && candidate.groups.every(group => Boolean(group)
      && typeof group === 'object'
      && typeof group.key === 'string'
      && typeof group.name === 'string')
    && Array.isArray(candidate.plans)
    && candidate.plans.every(plan => Boolean(plan)
      && typeof plan === 'object'
      && typeof plan.group_key === 'string'
      && typeof plan.name === 'string'
      && typeof plan.price === 'number')
}

export function isQiuapiFiveTierTemplate(catalog: PaymentCatalogImportRequest): boolean {
  const expectedKeys = ['lite', 'starter', 'standard', 'pro', 'max']
  if (catalog.schema_version !== 1 || catalog.mode !== 'upsert' || catalog.groups.length !== 5 || catalog.plans.length !== 5) return false
  const groupKeys = new Set(catalog.groups.map(group => group.key.trim().toLowerCase()))
  const planKeys = new Set(catalog.plans.map(plan => plan.group_key.trim().toLowerCase()))
  return expectedKeys.every(key => groupKeys.has(key) && planKeys.has(key))
    && catalog.groups.every(group => !group.copy_accounts_from?.length)
}

export async function personalizeCatalogTemplateForInstallation(
  catalog: PaymentCatalogImportRequest,
  groups: CatalogAccountSourceGroup[],
  loaders: CatalogTemplateSourceLoaders,
): Promise<InstallationCatalogTemplate> {
  const selection = selectCatalogTemplateSources(catalog, groups)
  let failedSourceCount = 0
  const snapshots = await Promise.all(selection.sources.map(async (group): Promise<CatalogTemplateSourceSnapshot> => {
    try {
      if (group.platform === 'composite') {
        return { group, routes: await loaders.loadRoutes(group) }
      }
      return { group, models: await loaders.loadModels(group) }
    } catch {
      failedSourceCount += 1
      return { group }
    }
  }))

  return {
    ...personalizeCatalogTemplate(catalog, groups, buildCatalogTemplateRoutes(snapshots)),
    failedSourceCount,
  }
}

export function personalizeCatalogTemplate(
  catalog: PaymentCatalogImportRequest,
  groups: CatalogAccountSourceGroup[],
  routeBuild: CatalogTemplateRouteBuild = { routes: [], omittedCount: 0 },
): PersonalizedCatalogTemplate {
  const selection = selectCatalogTemplateSources(catalog, groups)
  const sourceNames = selection.sources.map(group => group.name.trim())
  const groupCount = Math.max(1, catalog.groups.length)
  const sharedRouteLimit = Math.min(MAX_ROUTES_PER_GROUP, Math.floor(MAX_ROUTES_TOTAL / groupCount))
  const uniqueSharedRoutes = uniqueRoutes(routeBuild.routes)
  const sharedRoutes = uniqueSharedRoutes.slice(0, sharedRouteLimit)
  const omittedRouteCount = routeBuild.omittedCount
    + Math.max(0, uniqueSharedRoutes.length - sharedRoutes.length)

  return {
    catalog: {
      ...catalog,
      groups: catalog.groups.map(group => ({
        ...group,
        copy_accounts_from: sourceNames,
        routes: uniqueRoutes([...(group.routes || []), ...sharedRoutes]).slice(0, sharedRouteLimit),
      })),
    },
    sourceCount: sourceNames.length,
    routeCount: sharedRoutes.length,
    omittedSourceCount: selection.omittedCount,
    omittedRouteCount,
  }
}

export function selectCatalogTemplateSources(
  catalog: PaymentCatalogImportRequest,
  groups: CatalogAccountSourceGroup[],
): CatalogTemplateSourceSelection {
  const targetNames = new Set(catalog.groups.map(group => group.name.trim()).filter(Boolean))
  const names = new Set<string>()
  const eligible: CatalogAccountSourceGroup[] = []

  for (const group of groups) {
    const name = group.name.trim()
    if (group.status !== 'active' || (group.account_count ?? 0) <= 0 || name === '' || targetNames.has(name) || names.has(name)) continue
    names.add(name)
    eligible.push({ ...group, name })
  }

  return {
    sources: eligible.slice(0, MAX_ACCOUNT_SOURCES),
    omittedCount: Math.max(0, eligible.length - MAX_ACCOUNT_SOURCES),
  }
}

export function buildCatalogTemplateRoutes(
  snapshots: CatalogTemplateSourceSnapshot[],
): CatalogTemplateRouteBuild {
  const routes: PaymentCatalogRoute[] = []
  let omittedCount = 0

  // Existing Composite routes are administrator-authored, so they take
  // precedence over routes inferred from concrete account groups.
  for (const snapshot of snapshots.filter(item => item.group.platform === 'composite')) {
    for (const route of snapshot.routes || []) {
      if (!route.enabled) continue
      routes.push({
        public_model: route.public_model,
        match_type: route.match_type,
        target_platform: route.target_platform,
        upstream_model: route.upstream_model,
        endpoint: route.endpoint,
        priority: route.priority,
        enabled: true,
        notes: route.notes,
      })
    }
  }

  for (const snapshot of snapshots) {
    const targetPlatform = snapshot.group.platform
    if (targetPlatform === 'composite') continue
    for (const candidate of snapshot.models || []) {
      const route = routeFromModelCandidate(candidate, targetPlatform)
      if (route === undefined) continue
      if (route === null) {
        omittedCount += 1
        continue
      }
      routes.push(route)
    }
  }

  return { routes: uniqueRoutes(routes), omittedCount }
}

function routeFromModelCandidate(
  rawModel: string,
  targetPlatform: Exclude<GroupPlatform, 'composite'>,
): PaymentCatalogRoute | null | undefined {
  const model = rawModel.trim()
  if (model === '') return undefined

  const firstWildcard = model.indexOf('*')
  const hasTrailingWildcard = firstWildcard === model.length - 1 && firstWildcard === model.lastIndexOf('*')
  if (firstWildcard >= 0 && !hasTrailingWildcard) return null

  const publicModel = hasTrailingWildcard ? model.slice(0, -1).trim() : model
  if (publicModel === '') return null
  if (detectCatalogModelPlatform(publicModel) === targetPlatform) return undefined

  return {
    public_model: publicModel,
    match_type: hasTrailingWildcard ? 'prefix' : 'exact',
    target_platform: targetPlatform,
    endpoint: 'any',
    priority: 100,
    enabled: true,
  }
}

function uniqueRoutes(routes: PaymentCatalogRoute[]): PaymentCatalogRoute[] {
  const seen = new Set<string>()
  const result: PaymentCatalogRoute[] = []
  for (const route of routes) {
    const publicModel = route.public_model.trim()
    if (publicModel === '') continue
    const matchType = route.match_type || 'exact'
    const endpoint = route.endpoint || 'any'
    const key = `${publicModel}\u0000${matchType}\u0000${endpoint}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ ...route, public_model: publicModel, match_type: matchType, endpoint })
  }
  return result
}

function detectCatalogModelPlatform(rawModel: string): Exclude<GroupPlatform, 'composite'> | null {
  let model = rawModel.toLowerCase().trim().replace(/^models\//, '')
  if (model === '') return null

  const slash = model.indexOf('/')
  if (slash > 0) {
    const provider = model.slice(0, slash).trim()
    const rest = model.slice(slash + 1).trim()
    if (provider === 'anthropic' || provider === 'claude') return 'anthropic'
    if (provider === 'openai' || provider === 'chatgpt') return 'openai'
    if (provider === 'google' || provider === 'google-ai-studio' || provider === 'gemini') return 'gemini'
    if (provider === 'xai' || provider === 'x-ai' || provider === 'grok') return 'grok'
    if (rest !== '') model = rest.replace(/^models\//, '')
  }

  if (model.startsWith('anthropic.claude-') || model.startsWith('claude-')) return 'anthropic'
  if (
    model.startsWith('gpt-')
    || model.startsWith('chatgpt-')
    || model.startsWith('codex-')
    || model.startsWith('text-embedding-')
    || model.startsWith('text-moderation-')
    || model.startsWith('omni-moderation-')
    || model.startsWith('dall-e-')
    || model.startsWith('gpt-image-')
    || model.startsWith('tts-')
    || model.startsWith('whisper-')
    || ['o1', 'o3', 'o4', 'o5'].some(prefix => model === prefix || model.startsWith(`${prefix}-`))
  ) return 'openai'
  if (model.startsWith('gemini-') || model.startsWith('learnlm-')) return 'gemini'
  if (model === 'grok' || model.startsWith('grok-')) return 'grok'
  return null
}
