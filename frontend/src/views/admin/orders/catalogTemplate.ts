import type { AdminGroup, CompositeModelRoute, GroupPlatform } from '@/types'
import type { PaymentCatalogImportRequest, PaymentCatalogRoute } from '@/types/payment'

const MAX_ACCOUNT_SOURCES = 100
const QIUAPI_FIVE_TIER_TEMPLATE_KIND = 'qiuapi-five-tier-subscription'

export interface QiuapiCatalogTemplateMetadata {
  kind: typeof QIUAPI_FIVE_TIER_TEMPLATE_KIND
  version: 2 | 3
  group_binding: 'select_on_import'
}

export type PaymentCatalogTemplateDocument = PaymentCatalogImportRequest & {
  template?: QiuapiCatalogTemplateMetadata
}

export interface CatalogTemplateBindingSelection {
  groupIDsByPlan?: number[][]
}

export type CatalogAccountSourceGroup = Pick<
  AdminGroup,
	'id' | 'name' | 'status' | 'account_count' | 'platform'
> & Partial<Pick<AdminGroup, 'subscription_type' | 'rate_multiplier'>>

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

export function isPaymentCatalogTemplate(value: unknown): value is PaymentCatalogTemplateDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as Partial<PaymentCatalogTemplateDocument>
  const allowsDeferredGroupBinding = isQiuapiTemplateMetadata(candidate.template)
  const hasTemplateMetadata = Object.prototype.hasOwnProperty.call(candidate, 'template')
  if (hasTemplateMetadata && !allowsDeferredGroupBinding) return false
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
      && !Object.prototype.hasOwnProperty.call(plan, 'group_key')
      && !Object.prototype.hasOwnProperty.call(plan, 'group_id')
      && typeof plan.name === 'string'
      && typeof plan.price === 'number')
}

export function isQiuapiFiveTierTemplate(catalog: PaymentCatalogTemplateDocument): boolean {
  const expectedKeys = ['lite', 'starter', 'standard', 'pro', 'max']
	if (catalog.schema_version !== 1 || catalog.mode !== 'upsert') return false
	if (isQiuapiTemplateMetadata(catalog.template)) return true
	if (catalog.plans.length !== 5) return false
	const planNames = new Set(catalog.plans.map(plan => plan.name.trim().toLowerCase()))
	if (!expectedKeys.every(key => planNames.has(key))) return false
	if (catalog.groups.length !== 5) return false
  const groupKeys = new Set(catalog.groups.map(group => group.key.trim().toLowerCase()))
	const planKeys = new Set(catalog.plans.map(plan => (
			plan.included_group_keys?.[0] || ''
	).trim().toLowerCase()))
  return expectedKeys.every(key => groupKeys.has(key) && planKeys.has(key))
    && catalog.groups.every(group => !group.copy_accounts_from?.length)
}

export async function personalizeCatalogTemplateForInstallation(
  catalog: PaymentCatalogTemplateDocument,
  groups: CatalogAccountSourceGroup[],
	_loaders: CatalogTemplateSourceLoaders,
	binding: CatalogTemplateBindingSelection = {},
): Promise<InstallationCatalogTemplate> {
	// Group-billing catalogs reference existing real groups by ID. Account,
	// model, and Composite-route configuration remains owned by those groups.
	return {
			...personalizeCatalogTemplate(catalog, groups, binding),
			failedSourceCount: 0,
  }
}

export function personalizeCatalogTemplate(
  catalog: PaymentCatalogTemplateDocument,
  groups: CatalogAccountSourceGroup[],
	binding: CatalogTemplateBindingSelection = {},
): PersonalizedCatalogTemplate {
  const selection = selectCatalogTemplateSources(catalog, groups)
	const eligibleGroupIDs = selection.sources.map(group => group.id)
	const eligibleGroupIDSet = new Set(eligibleGroupIDs)
	const selectedGroupIDs = new Set<number>()
	const groupIDsByPlan = catalog.plans.map((_, index) => {
		const requested = binding.groupIDsByPlan?.[index] ?? eligibleGroupIDs
		const resolved = [...new Set(requested)].filter(id => eligibleGroupIDSet.has(id))
		resolved.forEach(id => selectedGroupIDs.add(id))
		return resolved
	})
	const { template: _template, ...portableCatalog } = catalog

	return {
		catalog: {
			...portableCatalog,
				defaults: {
					...catalog.defaults,
					subscription_type: 'standard',
				},
				groups: [],
				plans: catalog.plans.map((plan, index) => {
					const {
						included_group_keys: _includedGroupKeys,
						included_group_ids: _includedGroupIDs,
					...portablePlan
				} = plan
					return {
						...portablePlan,
						...(groupIDsByPlan[index]?.length
							? { included_group_ids: [...groupIDsByPlan[index]] }
							: {}),
					}
				}),
		},
		sourceCount: selectedGroupIDs.size,
			routeCount: 0,
    omittedSourceCount: selection.omittedCount,
			omittedRouteCount: 0,
  }
}

export function selectCatalogTemplateSources(
  catalog: PaymentCatalogTemplateDocument,
  groups: CatalogAccountSourceGroup[],
): CatalogTemplateSourceSelection {
  const targetNames = new Set(catalog.groups.map(group => group.name.trim()).filter(Boolean))
  const names = new Set<string>()
  const eligible: CatalogAccountSourceGroup[] = []

  for (const group of groups) {
    const name = group.name.trim()
		const routable = (group.account_count ?? 0) > 0 || group.platform === 'composite'
		if (group.status !== 'active' || group.subscription_type !== 'standard' || !routable || name === '' || targetNames.has(name) || names.has(name)) continue
    names.add(name)
    eligible.push({ ...group, name })
  }

  return {
    sources: eligible.slice(0, MAX_ACCOUNT_SOURCES),
    omittedCount: Math.max(0, eligible.length - MAX_ACCOUNT_SOURCES),
  }
}

function isQiuapiTemplateMetadata(value: unknown): value is QiuapiCatalogTemplateMetadata {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false
	const candidate = value as Partial<QiuapiCatalogTemplateMetadata>
	return candidate.kind === QIUAPI_FIVE_TIER_TEMPLATE_KIND
		&& (candidate.version === 2 || candidate.version === 3)
		&& candidate.group_binding === 'select_on_import'
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
