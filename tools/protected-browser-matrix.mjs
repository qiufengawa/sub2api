#!/usr/bin/env node

/**
 * Credential-free protected-page matrix runner.
 *
 * This runner intentionally uses Playwright route interception rather than a
 * real account or provider.  It exercises the production router/components
 * with deterministic auth, loading, error, and late-response fixtures.  The
 * output is marked fixture_only and must not be used as live payment, storage,
 * or native screen-reader evidence.
 *
 * Usage (in an environment with Playwright installed):
 *   PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
 *   BASE_URL=http://127.0.0.1:3000 \
 *   node tools/protected-browser-matrix.mjs
 *
 * Optional controls:
 *   MATRIX_STATES=success,empty,slow,error,late
 *   MATRIX_ROLE=user,admin,both
 *   MATRIX_MAX_CASES=0  (0 = all cases)
 *   MATRIX_OUTPUT=/tmp/protected-browser-matrix.json
 */

import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'

const BASE_URL = String(process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
const OUTPUT = process.env.MATRIX_OUTPUT || 'docs/frontend-rebuild/evidence/20260822/protected-browser-matrix-fixture.json'
const STATES = (process.env.MATRIX_STATES || 'success,empty,slow,error,late')
  .split(',').map((value) => value.trim()).filter(Boolean)
const ROLE_SELECTION = new Set((process.env.MATRIX_ROLE || 'both')
  .split(',').map((value) => value.trim()).filter(Boolean))
const MAX_CASES = Math.max(0, Number.parseInt(process.env.MATRIX_MAX_CASES || '0', 10) || 0)

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 900, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]
const MODES = [
  { name: 'light', colorScheme: 'light', reducedMotion: false },
  { name: 'dark', colorScheme: 'dark', reducedMotion: false },
  { name: 'dark-reduced', colorScheme: 'dark', reducedMotion: true },
]

// Keep this list synchronized with router/index.ts.  Dynamic parameters use a
// stable local fixture value so every route remains directly navigable.
const USER_ROUTES = [
  '/dashboard', '/keys', '/playground', '/batch-image', '/usage', '/redeem',
  '/affiliate', '/available-channels', '/profile', '/subscriptions', '/purchase',
  '/orders', '/payment/qrcode', '/payment/result', '/payment/stripe',
  '/payment/airwallex', '/payment/stripe-popup', '/custom/r5-markdown', '/monitor',
]
const ADMIN_ROUTES = [
  '/admin/dashboard', '/admin/ui-system', '/admin/ops', '/admin/audit-logs',
  '/admin/users', '/admin/groups', '/admin/channels/pricing',
  '/admin/channels/monitor', '/admin/subscriptions', '/admin/accounts',
  '/admin/announcements', '/admin/proxies', '/admin/redeem', '/admin/promo-codes',
  '/admin/settings', '/admin/risk-control', '/admin/prompt-audit', '/admin/usage',
  '/admin/affiliates/invites', '/admin/affiliates/rebates', '/admin/affiliates/transfers',
  '/admin/orders/dashboard', '/admin/orders', '/admin/orders/plans',
]

// `/model-plaza` is public and is intentionally kept out of the protected
// role matrix.  Run it as a separate public fixture when needed instead of
// silently treating a public route as an authenticated user page.
const PUBLIC_ROUTES = ['/model-plaza']

const fixtureUser = {
  id: 1,
  username: 'fixture-admin',
  email: 'admin.fixture@example.test',
  role: 'admin',
  status: 'active',
  balance: 0,
  frozen_balance: 0,
  concurrency: 8,
  allowed_groups: null,
  balance_notify_enabled: false,
  balance_notify_threshold: null,
  balance_notify_extra_emails: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function fixtureUserForRole(role) {
  if (role === 'admin') return { ...fixtureUser, role: 'admin' }
  return {
    ...fixtureUser,
    id: 2,
    username: 'fixture-user',
    email: 'user.fixture@example.test',
    role: 'user',
  }
}

const emptyPage = { items: [], total: 0, page: 1, page_size: 20, pages: 0 }
const publicSettings = {
  registration_enabled: true, email_verify_enabled: false,
  force_email_on_third_party_signup: false, registration_email_suffix_whitelist: [],
  promo_code_enabled: true, password_reset_enabled: true, invitation_code_enabled: false,
  turnstile_enabled: false, turnstile_site_key: '', site_name: 'Sub2API Fixture',
  site_logo: '', site_subtitle: '', api_base_url: '', contact_info: '', doc_url: '',
  home_content: '', compact_home_enabled: false, hide_ccs_import_button: false,
  payment_enabled: true, risk_control_enabled: true, playground_enabled: true,
  table_default_page_size: 20, table_page_size_options: [20, 50, 100],
  custom_menu_items: [], custom_endpoints: [], linuxdo_oauth_enabled: false,
  dingtalk_oauth_enabled: false, wechat_oauth_enabled: false, oidc_oauth_enabled: false,
  oidc_oauth_provider_name: '', github_oauth_enabled: false, google_oauth_enabled: false,
  backend_mode_enabled: false, version: 'fixture', balance_low_notify_enabled: false,
  account_quota_notify_enabled: false, balance_low_notify_threshold: 0,
  channel_monitor_enabled: false, channel_monitor_default_interval_seconds: 60,
  available_channels_enabled: true, model_plaza_enabled: true,
}

const riskConfig = {
  enabled: false, mode: 'off', base_url: '', model: '', proxy_id: null,
  api_key_configured: false, api_key_masked: '', api_key_count: 0,
  api_key_masks: [], api_key_statuses: [], timeout_ms: 1000, sample_rate: 0,
  all_groups: true, group_ids: [], record_non_hits: false, thresholds: {}, worker_count: 1,
  queue_size: 100, block_status: 403, block_message: '', email_on_hit: false,
  auto_ban_enabled: false, ban_threshold: 0, violation_window_hours: 24, retry_count: 0,
  hit_retention_days: 30, non_hit_retention_days: 7, pre_hash_check_enabled: false,
  blocked_keywords: [], keyword_blocking_mode: 'keyword_only',
  model_filter: { type: 'all', models: [] }, cyber_policy_exclude_from_ban_count: false,
}
const riskStatus = {
  enabled: false, mode: 'off', process_status: 'disabled', queue_depth: 0,
  queue_capacity: 100, active_workers: 0, total_workers: 1, last_error: '',
  last_processed_at: null, last_config_version: 1,
}
const promptConfig = {
  enabled: false, blocking_enabled: false, blocking_latest_turn_only: false,
  store_pass_events: false, effective_mode: 'off', strategy: 'priority', worker_count: 1,
  queue_capacity: 100, scanners: [], all_groups: true, group_ids: [], endpoints: [],
  config_version: 1, updated_at: '2026-01-01T00:00:00Z', updated_by: 1, change_summary: '',
}
const promptRuntime = {
  process_status: 'disabled', effective_mode: 'off', expected_config_version: 1,
  active_config_version: 1, worker_total: 1, worker_active: 0, queue_capacity: 100,
  queue: { staging: 0, queued: 0, processing: 0, retry: 0, done: 0, failed: 0, active: 0 },
  processed_total: 0, failed_total: 0, enqueued_total: 0, dropped_total: 0,
  database_status: 'ok', redis_status: 'ok', endpoints: {},
  guard_metrics: { total: 0, allowed: 0, flagged: 0, blocked: 0, unavailable: 0,
    invalid: 0, timeouts: 0, failovers: 0, bulkhead_full: 0, record_failed: 0 },
}
const paymentDashboard = {
  today_amount: { USD: 0, CNY: 0 }, total_amount: { USD: 0, CNY: 0 }, today_count: 0,
  total_count: 0, avg_amount: { USD: 0, CNY: 0 }, daily_series: [], payment_methods: [],
  top_users: {},
}

function dataFor(path, method, role = 'admin') {
  if (path === '/setup/status') return { needs_setup: false, step: 'complete' }
  if (path.endsWith('/settings/public')) return publicSettings
  if (path.endsWith('/auth/me')) return fixtureUserForRole(role)
  if (path.endsWith('/admin/compliance')) return { required: false }
  if (path.endsWith('/admin/promo-codes')) return emptyPage
  if (path.includes('/admin/promo-codes/')) return path.endsWith('/usages') ? emptyPage : {}
  if (path.endsWith('/admin/risk-control/config')) return riskConfig
  if (path.endsWith('/admin/risk-control/status')) return riskStatus
  if (path.endsWith('/admin/risk-control/logs')) return emptyPage
  if (path.endsWith('/admin/groups/all') || path.endsWith('/admin/proxies/all')) return []
  if (path.endsWith('/admin/prompt-audit/config')) return promptConfig
  if (path.endsWith('/admin/prompt-audit/runtime')) return promptRuntime
  if (path.endsWith('/admin/prompt-audit/events')) return emptyPage
  if (path.endsWith('/admin/payment/dashboard')) return paymentDashboard
  if (path.endsWith('/announcements') || path.endsWith('/subscriptions/active')) return []
  if (path.endsWith('/dashboard/stats') || path.endsWith('/admin/usage/stats')) {
    return { items: [], total: 0, page: 1, page_size: 20, pages: 0 }
  }
  if (method === 'GET') return []
  return {}
}

const PRIMARY_ENDPOINTS = new Map([
  ['/dashboard', '/dashboard/stats'],
  ['/keys', '/keys'],
  ['/playground', '/models'],
  ['/batch-image', '/images/batches'],
  ['/usage', '/usage'],
  ['/redeem', '/redeem'],
  ['/affiliate', '/affiliate'],
  ['/available-channels', '/channels/available'],
  ['/profile', '/auth/me'],
  ['/subscriptions', '/subscriptions'],
  ['/purchase', '/payment/plans'],
  ['/orders', '/payment/orders'],
  ['/payment/qrcode', '/payment/public/orders'],
  ['/payment/result', '/payment/public/orders'],
  ['/payment/stripe', '/payment/public/orders'],
  ['/payment/airwallex', '/payment/public/orders'],
  ['/payment/stripe-popup', '/payment/public/orders'],
  ['/custom/r5-markdown', '/custom-pages'],
  ['/monitor', '/monitor'],
  ['/admin/dashboard', '/admin/dashboard/stats'],
  ['/admin/ui-system', null],
  ['/admin/ops', '/admin/ops'],
  ['/admin/audit-logs', '/admin/audit-logs'],
  ['/admin/users', '/admin/users'],
  ['/admin/groups', '/admin/groups'],
  ['/admin/channels/pricing', '/admin/channels'],
  ['/admin/channels/monitor', '/admin/channels/monitor'],
  ['/admin/subscriptions', '/admin/subscriptions'],
  ['/admin/accounts', '/admin/accounts'],
  ['/admin/announcements', '/admin/announcements'],
  ['/admin/proxies', '/admin/proxies'],
  ['/admin/redeem', '/admin/redeem'],
  ['/admin/promo-codes', '/admin/promo-codes'],
  ['/admin/settings', '/admin/settings'],
  ['/admin/risk-control', '/admin/risk-control/config'],
  ['/admin/prompt-audit', '/admin/prompt-audit/config'],
  ['/admin/usage', '/admin/usage'],
  ['/admin/affiliates/invites', '/admin/affiliates'],
  ['/admin/affiliates/rebates', '/admin/affiliates'],
  ['/admin/affiliates/transfers', '/admin/affiliates'],
  ['/admin/orders/dashboard', '/admin/payment/dashboard'],
  ['/admin/orders', '/admin/orders'],
  ['/admin/orders/plans', '/admin/payment/plans'],
])

function primaryEndpoint(route) {
  return PRIMARY_ENDPOINTS.get(route) || null
}

function isPrimaryPath(route, path) {
  const endpoint = primaryEndpoint(route)
  if (!endpoint) return false
  return path === endpoint || path.startsWith(`${endpoint}/`)
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function loadPlaywright() {
  const moduleName = process.env.PLAYWRIGHT_MODULE || 'playwright'
  try {
    const loaded = await import(moduleName)
    // Playwright's CommonJS entrypoint is exposed as `default` when loaded
    // through ESM dynamic import; native ESM builds expose chromium directly.
    return loaded.default || loaded
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Playwright is not installed (${moduleName}): ${message}`)
  }
}

function fixtureEnvelope(data) {
  return JSON.stringify({ code: 0, message: 'ok', data })
}

async function runCase(browser, role, route, viewport, mode, state) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: mode.colorScheme,
    reducedMotion: mode.reducedMotion ? 'reduce' : 'no-preference',
  })
  const authUser = fixtureUserForRole(role)
  await context.addInitScript(({ user }) => {
    localStorage.setItem('auth_token', 'FIXTURE_ACCESS_TOKEN')
    localStorage.setItem('refresh_token', 'FIXTURE_REFRESH_TOKEN')
    localStorage.setItem('token_expires_at', String(Date.now() + 86_400_000))
    localStorage.setItem('auth_user', JSON.stringify(user))
  }, { user: authUser })

  const page = await context.newPage()
  const diagnostics = {
    console: [], pageErrors: [], failedRequests: [], requests: [], responses: [],
    primary_status: null, primary_seen: false, state_observations: [],
  }
  page.on('console', (message) => diagnostics.console.push({ type: message.type(), text: message.text() }))
  page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)))
  page.on('requestfailed', (request) => diagnostics.failedRequests.push({
    url: request.url(), error: request.failure()?.errorText || 'unknown',
  }))

  let primarySeen = false
  let lateRelease
  const latePromise = new Promise((resolve) => { lateRelease = resolve })
  await page.route('**/setup/status', async (handler) => {
    diagnostics.requests.push({ method: 'GET', path: '/setup/status', state })
    await handler.fulfill({ status: 200, contentType: 'application/json', body: fixtureEnvelope({ needs_setup: false, step: 'complete' }) })
  })
  await page.route('**/api/**', async (handler) => {
    const request = handler.request()
    const url = new URL(request.url())
    const method = request.method()
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/'
    diagnostics.requests.push({ method, path, state })
    const isPrimary = isPrimaryPath(route, path)
    if (isPrimary) {
      diagnostics.primary_seen = true
      diagnostics.primary_path = path
    }
    if (state === 'slow' && isPrimary) await new Promise((resolve) => setTimeout(resolve, 1600))
    if (state === 'late' && isPrimary && !primarySeen) {
      primarySeen = true
      await latePromise
    }
    if (state === 'error' && isPrimary) {
      if (isPrimary) diagnostics.primary_status = 503
      diagnostics.responses.push({ method, path, status: 503, primary: isPrimary })
      await handler.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 503, message: 'fixture forced error' }) })
      return
    }
    if (isPrimary) diagnostics.primary_status = 200
    diagnostics.responses.push({ method, path, status: 200, primary: isPrimary })
    await handler.fulfill({ status: 200, contentType: 'application/json', body: fixtureEnvelope(dataFor(path, method, role)) })
  })

  const startedAt = Date.now()
  let navigationError = null
  if (state === 'late') setTimeout(() => lateRelease(), 900)
  const navigation = page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
  if (state === 'slow' || state === 'late') {
    await page.waitForTimeout(250)
    diagnostics.state_observations.push({ phase: 'in_flight', ...(await page.evaluate(() => ({
      loadingCount: [...document.querySelectorAll('[role="status"], [aria-busy="true"]')]
        .filter((element) => {
          const style = getComputedStyle(element)
          return style.display !== 'none' && style.visibility !== 'hidden'
        }).length,
    })).catch((error) => ({ evaluateError: String(error) }))) })
  }
  try {
    await navigation
    await page.waitForTimeout(state === 'slow' ? 2_000 : 900)
  } catch (error) {
    navigationError = String(error)
  }
  if (state === 'late') lateRelease()
  await page.waitForTimeout(400)

  const pageState = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden'
    }
    const active = document.activeElement
    return {
      url: location.href,
      title: document.title,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      mainCount: document.querySelectorAll('main').length,
      loadingCount: [...document.querySelectorAll('[role="status"], [aria-busy="true"]')].filter(visible).length,
      alertCount: [...document.querySelectorAll('[role="alert"]')].filter(visible).length,
      active: active ? { tag: active.tagName, role: active.getAttribute('role'), name: (active.getAttribute('aria-label') || active.textContent || '').trim().slice(0, 100) } : null,
    }
  }).catch((error) => ({ evaluateError: String(error) }))

  const tabTrace = []
  for (let index = 0; index < 8; index += 1) {
    try {
      await page.keyboard.press('Tab')
      tabTrace.push(await page.evaluate(() => {
        const active = document.activeElement
        return { tag: active?.tagName || '', role: active?.getAttribute('role') || '', named: Boolean((active?.getAttribute('aria-label') || active?.textContent || '').trim()), aria: Boolean(active?.getAttribute('aria-label')) }
      }))
    } catch (error) {
      tabTrace.push({ error: String(error) })
    }
  }
  try { await page.keyboard.press('Escape') } catch { /* diagnostics are enough */ }

  let ax = { status: 'blocked', error: 'Accessibility.getFullAXTree not attempted' }
  try {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Accessibility.enable')
    const tree = await cdp.send('Accessibility.getFullAXTree')
    const serialized = JSON.stringify(tree)
    ax = { status: 'pass', sha256: hash(serialized), nodeCount: tree.nodes?.length || 0 }
  } catch (error) {
    ax = { status: 'blocked', error: String(error) }
  }

  const expectedSandboxErrors = diagnostics.pageErrors.filter((message) =>
    /SecurityError|localStorage|sessionStorage|sandbox/i.test(message)
  )
  const unexpectedPageErrors = diagnostics.pageErrors.filter((message) => !expectedSandboxErrors.includes(message))
  const result = {
    role, route, viewport: viewport.name, width: viewport.width, height: viewport.height,
    mode: mode.name, state, duration_ms: Date.now() - startedAt, navigation_error: navigationError,
    primary_path: primaryEndpoint(route), page: pageState, tab_trace: tabTrace, ax,
    expected_sandbox_errors: expectedSandboxErrors,
    unexpected_page_errors: unexpectedPageErrors,
    diagnostics,
    overflow: typeof pageState.scrollWidth === 'number' && pageState.scrollWidth > pageState.clientWidth,
    expected_fixture_error: state === 'error',
  }
  await context.close()
  return result
}

async function main() {
  const { chromium } = await loadPlaywright()
  const browser = await chromium.launch({ headless: true })
  const roles = ROLE_SELECTION.has('both')
    ? ['user', 'admin']
    : [...ROLE_SELECTION].filter((role) => role === 'user' || role === 'admin')
  if (roles.length === 0) throw new Error('MATRIX_ROLE must contain user, admin, or both')
  const cases = []
  for (const role of roles) {
    const routes = role === 'admin' ? ADMIN_ROUTES : USER_ROUTES
    for (const route of routes) for (const viewport of VIEWPORTS) for (const mode of MODES) for (const state of STATES) {
      cases.push({ role, route, viewport, mode, state })
    }
  }
  const selected = MAX_CASES > 0 ? cases.slice(0, MAX_CASES) : cases
  const runs = []
  for (const item of selected) {
    runs.push(await runCase(browser, item.role, item.route, item.viewport, item.mode, item.state))
    process.stderr.write(`matrix ${runs.length}/${selected.length} ${item.role} ${item.route} ${item.viewport.name} ${item.mode.name} ${item.state}\n`)
  }
  await browser.close()
  const summary = {
    schema: 'sub2api.protected-browser-matrix-fixture.v1',
    captured_at: new Date().toISOString(),
    source: 'tools/protected-browser-matrix.mjs',
    base_url: BASE_URL,
    fixture_only: true,
    roles, states: STATES, viewports: VIEWPORTS, modes: MODES,
    requested_cases: selected.length,
    runs,
    totals: {
      overflow: runs.filter((run) => run.overflow).length,
      navigation_errors: runs.filter((run) => run.navigation_error).length,
      failed_requests: runs.reduce((sum, run) => sum + run.diagnostics.failedRequests.length, 0),
      console_messages: runs.reduce((sum, run) => sum + run.diagnostics.console.length, 0),
      page_errors: runs.reduce((sum, run) => sum + run.diagnostics.pageErrors.length, 0),
      unexpected_page_errors: runs.reduce((sum, run) => sum + run.unexpected_page_errors.length, 0),
      primary_http_errors: runs.filter((run) => run.diagnostics.primary_status >= 400).length,
      ax_blocked: runs.filter((run) => run.ax.status !== 'pass').length,
    },
    boundaries: [
      'Synthetic auth and API responses; no real credentials or provider/storage calls.',
      'Native VoiceOver/NVDA is not represented by CDP AX snapshots.',
      'A green fixture run does not close live protected-browser or destructive-flow gates.',
    ],
  }
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true })
  await fs.writeFile(OUTPUT, JSON.stringify(summary, null, 2) + '\n')
  process.stdout.write(JSON.stringify({ output: OUTPUT, runs: runs.length, totals: summary.totals }) + '\n')
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`protected-browser-matrix blocked: ${message}\n`)
  process.exitCode = 2
})
