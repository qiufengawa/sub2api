-- Sub2API local preview data seed.
--
-- This script is intentionally restricted to the sub2api_preview database.
-- It is idempotent: rerunning it replaces only rows marked as UI demo data,
-- then rebuilds dashboard aggregates from the complete usage_logs table.

BEGIN;

SET LOCAL TIME ZONE 'Asia/Shanghai';

DO $guard$
BEGIN
    IF current_database() <> 'sub2api_preview' THEN
        RAISE EXCEPTION 'Refusing to seed database "%"; expected sub2api_preview', current_database();
    END IF;
END
$guard$;

-- Remove the previous demo set while preserving all non-demo rows.
DELETE FROM usage_logs
WHERE request_id LIKE 'DEMO-%';

DELETE FROM payment_orders
WHERE out_trade_no LIKE 'DEMO-%';

DELETE FROM redeem_codes
WHERE code LIKE 'DEMO-%';

DELETE FROM user_subscriptions
WHERE notes = 'SUB2API_UI_DEMO';

DELETE FROM subscription_plans
WHERE product_name LIKE 'SUB2API_UI_DEMO%';

DELETE FROM announcements
WHERE title LIKE '[DEMO] %';

DELETE FROM channels
WHERE name LIKE '[DEMO] %';

DELETE FROM accounts
WHERE notes = 'SUB2API_UI_DEMO';

DELETE FROM proxies
WHERE name LIKE '[DEMO] %';

DELETE FROM groups g
WHERE g.name LIKE '[DEMO] %'
  AND NOT EXISTS (
      SELECT 1
      FROM subscription_plan_groups spg
      WHERE spg.group_id = g.id
  );

DELETE FROM users
WHERE notes = 'SUB2API_UI_DEMO'
   OR email LIKE 'demo.%@example.com';

-- Users share the preview administrator's password hash, so demo accounts can
-- also be used for local role and data-scope checks if needed.
WITH admin_password AS (
    SELECT password_hash
    FROM users
    WHERE email = 'admin@admin.com'
    LIMIT 1
), demo_users(username, email, balance, frozen_balance, concurrency, status, total_recharged, signup_source, days_ago, rpm_limit) AS (
    VALUES
        ('林致远', 'demo.lin@example.com',       128.60::numeric,  4.20::numeric, 10, 'active',   300.00::numeric, 'email',    0, 120),
        ('周明月', 'demo.zhou@example.com',       86.35::numeric,  0.00::numeric,  8, 'active',   188.00::numeric, 'github',   0,  90),
        ('陈一鸣', 'demo.chen@example.com',       42.18::numeric,  2.50::numeric,  6, 'active',   100.00::numeric, 'google',   0,  60),
        ('赵清和', 'demo.zhao@example.com',       15.90::numeric,  0.00::numeric,  5, 'active',    50.00::numeric, 'linuxdo',  0,  45),
        ('许嘉宁', 'demo.xu@example.com',        236.80::numeric, 12.00::numeric, 16, 'active',   500.00::numeric, 'oidc',     1, 180),
        ('何书言', 'demo.he@example.com',          6.72::numeric,  0.00::numeric,  4, 'active',    20.00::numeric, 'wechat',   2,  30),
        ('顾星河', 'demo.gu@example.com',         58.44::numeric,  1.80::numeric,  7, 'active',   120.00::numeric, 'dingtalk', 4,  75),
        ('唐可心', 'demo.tang@example.com',       33.10::numeric,  0.00::numeric,  5, 'active',    80.00::numeric, 'email',    7,  60),
        ('宋远舟', 'demo.song@example.com',        0.86::numeric,  0.00::numeric,  3, 'active',    10.00::numeric, 'github',  12,  25),
        ('沈知夏', 'demo.shen@example.com',       71.25::numeric,  5.00::numeric,  9, 'disabled', 160.00::numeric, 'google',  20, 100),
        ('陆景行', 'demo.lu@example.com',        412.00::numeric, 18.50::numeric, 20, 'active',   880.00::numeric, 'email',   29, 240)
)
INSERT INTO users (
    username, email, password_hash, role, balance, frozen_balance, concurrency,
    status, notes, balance_notify_enabled, balance_notify_threshold,
    balance_notify_extra_emails, balance_notify_threshold_type,
    total_recharged, signup_source, last_login_at, last_active_at,
    rpm_limit, created_at, updated_at
)
SELECT
    d.username,
    d.email,
    a.password_hash,
    'user',
    d.balance,
    d.frozen_balance,
    d.concurrency,
    d.status,
    'SUB2API_UI_DEMO',
    d.status = 'active',
    CASE WHEN d.balance < 20 THEN 5 ELSE 20 END,
    CASE WHEN d.email = 'demo.lin@example.com'
         THEN '[{"email":"ops@example.com","verified":true}]'
         ELSE '[]' END,
    CASE WHEN d.email = 'demo.song@example.com' THEN 'percentage' ELSE 'fixed' END,
    d.total_recharged,
    d.signup_source,
    now() - make_interval(hours => 1 + d.days_ago),
    now() - make_interval(mins => 3 + d.days_ago * 7),
    d.rpm_limit,
    now() - make_interval(days => d.days_ago),
    now() - make_interval(mins => d.days_ago)
FROM demo_users d
CROSS JOIN admin_password a;

-- Routing groups cover every supported provider plus image, batch image,
-- video, live and fallback configurations. Subscription entitlement remains
-- attached to plans rather than a special group type.
INSERT INTO groups (
    name, description, platform, rate_multiplier, is_exclusive, status,
    subscription_type, daily_limit_usd, weekly_limit_usd, monthly_limit_usd,
    default_validity_days, image_price_1k, image_price_2k, image_price_4k,
    claude_code_only, mcp_xml_inject, supported_model_scopes, sort_order,
    allow_messages_dispatch, default_mapped_model, messages_dispatch_model_config,
    rpm_limit, allow_image_generation, image_rate_independent,
    image_rate_multiplier, models_list_config, peak_rate_enabled, peak_start,
    peak_end, peak_rate_multiplier, batch_image_discount_multiplier,
    batch_image_hold_multiplier, allow_batch_image_generation,
    video_rate_independent, video_rate_multiplier, video_price_480p,
    video_price_720p, video_price_1080p, web_search_price_per_call,
    max_reasoning_effort, reasoning_effort_mappings, allow_live
)
VALUES
    ('[DEMO] Anthropic 企业标准', 'Claude 文本与 Claude Code 标准计费线路', 'anthropic', 1.00, false, 'active', 'standard', NULL, NULL, NULL, 30, NULL, NULL, NULL, true, true, '["claude"]', 10, false, '', '{}', 180, false, false, 1.00, '{"include":["claude-sonnet-4-5","claude-opus-4-6"]}', true, '09:00', '18:00', 1.12, 0.50, 0.60, false, false, 1.00, NULL, NULL, NULL, 0.010, '', '[]', false),
    ('[DEMO] OpenAI 企业标准', 'GPT 与 Responses API 企业线路', 'openai', 0.95, false, 'active', 'standard', NULL, NULL, NULL, 30, NULL, NULL, NULL, false, false, '["openai"]', 20, true, 'gpt-5-mini', '{"opus_mapped_model":"gpt-5","sonnet_mapped_model":"gpt-5-mini"}', 240, false, false, 1.00, '{"include":["gpt-5","gpt-5-mini"]}', false, '', '', 1.00, 0.50, 0.60, false, false, 1.00, NULL, NULL, NULL, NULL, 'high', '[{"from":"xhigh","to":"high"}]', false),
    ('[DEMO] Gemini 视觉生成', 'Gemini 文本、图片与批量图片线路', 'gemini', 0.88, false, 'active', 'standard', NULL, NULL, NULL, 30, 0.025, 0.050, 0.090, false, false, '["gemini_text","gemini_image"]', 30, false, '', '{}', 150, true, true, 1.25, '{"include":["gemini-2.5-pro","gemini-2.5-flash"]}', false, '', '', 1.00, 0.45, 0.55, true, false, 1.00, NULL, NULL, NULL, NULL, '', '[]', false),
    ('[DEMO] Grok 实时与视频', 'Grok 实时请求、图片及视频生成线路', 'grok', 1.08, false, 'active', 'standard', NULL, NULL, NULL, 30, 0.030, 0.060, 0.100, false, false, '["grok"]', 40, false, '', '{}', 120, true, true, 1.10, '{"include":["grok-4"]}', false, '', '', 1.00, 0.50, 0.60, false, true, 1.18, 0.08, 0.15, 0.28, 0.012, 'high', '[{"from":"xhigh","to":"high"}]', true),
    ('[DEMO] Antigravity 备用池', '用于验证停用分组和备用供应商样式', 'antigravity', 0.75, true, 'disabled', 'standard', NULL, NULL, NULL, 30, NULL, NULL, NULL, false, false, '["gemini_text"]', 50, false, '', '{}', 60, false, false, 1.00, '{}', false, '', '', 1.00, 0.50, 0.60, false, false, 1.00, NULL, NULL, NULL, NULL, '', '[]', false),
    ('[DEMO] Anthropic 备用线路', '用于验证 Anthropic 备用路由和专属分组样式', 'anthropic', 1.00, true, 'active', 'standard', NULL, NULL, NULL, 30, NULL, NULL, NULL, true, true, '["claude"]', 5, false, '', '{}', 100, false, false, 1.00, '{"include":["claude-sonnet-4-5","claude-opus-4-6"]}', false, '', '', 1.00, 0.50, 0.60, false, false, 1.00, NULL, NULL, NULL, 0.008, '', '[]', false)
ON CONFLICT (name) WHERE deleted_at IS NULL DO NOTHING;

UPDATE groups g
SET fallback_group_id = f.id,
    fallback_group_id_on_invalid_request = o.id,
    model_routing_enabled = true,
    model_routing = jsonb_build_object('claude-opus-4-6', jsonb_build_array(f.id, o.id))
FROM groups f, groups o
WHERE g.name = '[DEMO] Anthropic 企业标准'
  AND f.name = '[DEMO] Anthropic 备用线路'
  AND o.name = '[DEMO] OpenAI 企业标准';

INSERT INTO proxies (
    name, protocol, host, port, username, password, status, expires_at,
    fallback_mode, expiry_warn_days, created_at, updated_at
)
VALUES
    ('[DEMO] 东京主代理', 'https', 'tokyo.demo.invalid', 8443, 'preview', 'preview-only', 'active', now() + interval '90 days', 'proxy', 14, now() - interval '40 days', now()),
    ('[DEMO] 新加坡低延迟', 'socks5', 'sg.demo.invalid', 1080, 'preview', 'preview-only', 'active', now() + interval '5 days', 'direct', 7, now() - interval '28 days', now()),
    ('[DEMO] 美国备用代理', 'http', 'us.demo.invalid', 8080, NULL, NULL, 'disabled', now() + interval '30 days', 'none', 7, now() - interval '20 days', now()),
    ('[DEMO] 已过期节点', 'socks5h', 'expired.demo.invalid', 1081, NULL, NULL, 'expired', now() - interval '2 days', 'none', 3, now() - interval '60 days', now());

UPDATE proxies p
SET backup_proxy_id = b.id
FROM proxies b
WHERE p.name = '[DEMO] 东京主代理'
  AND b.name = '[DEMO] 新加坡低延迟';

-- Credentials are deliberately non-routable preview placeholders.
INSERT INTO accounts (
    name, platform, type, credentials, extra, proxy_id, concurrency, priority,
    status, error_message, last_used_at, schedulable, rate_limited_at,
    rate_limit_reset_at, overload_until, session_window_start,
    session_window_end, session_window_status, temp_unschedulable_until,
    temp_unschedulable_reason, notes, expires_at, auto_pause_on_expired,
    rate_multiplier, load_factor, quota_dimension, created_at, updated_at
)
SELECT
    v.name, v.platform, v.type,
    jsonb_build_object('email', lower(replace(v.name, ' ', '.')) || '@demo.invalid'),
    v.extra,
    p.id,
    v.concurrency,
    v.priority,
    v.status,
    v.error_message,
    now() - make_interval(mins => v.last_used_minutes),
    v.schedulable,
    CASE WHEN v.rate_limited THEN now() - interval '12 minutes' END,
    CASE WHEN v.rate_limited THEN now() + interval '38 minutes' END,
    CASE WHEN v.overloaded THEN now() + interval '16 minutes' END,
    CASE WHEN v.platform = 'anthropic' THEN now() - interval '2 hours' END,
    CASE WHEN v.platform = 'anthropic' THEN now() + interval '3 hours' END,
    CASE WHEN v.platform = 'anthropic' THEN 'allowed_warning' END,
    CASE WHEN v.temp_unschedulable THEN now() + interval '25 minutes' END,
    CASE WHEN v.temp_unschedulable THEN '上游维护窗口，稍后自动恢复' END,
    'SUB2API_UI_DEMO',
    CASE WHEN v.expires_soon THEN now() + interval '6 days' ELSE now() + interval '180 days' END,
    true,
    v.rate_multiplier,
    v.load_factor,
    'global',
    now() - make_interval(days => cd.created_days),
    now()
FROM (VALUES
    ('[DEMO] Claude OAuth 主力',        'anthropic',   'oauth',           8,  10, 'active',   NULL,                         true,  false, false, false, false,  1.00::numeric,  85,  55, '{"plan_type":"team","current_window_cost":2.48,"active_sessions":4,"current_rpm":38}'::jsonb),
    ('[DEMO] Claude Setup 限流',        'anthropic',   'setup-token',     4,  30, 'active',   NULL,                         true,  true,  false, false, true,   1.10::numeric,  60,  15, '{"plan_type":"pro","current_window_cost":4.72,"active_sessions":2,"current_rpm":12}'::jsonb),
    ('[DEMO] Claude API Key 异常',      'anthropic',   'apikey',          3,  60, 'error',    '上游鉴权失败，等待重新配置',     false, false, false, false, false, 1.20::numeric,  35,  33, '{"quota_limit":100,"quota_used":86.4,"quota_daily_limit":12,"quota_daily_used":9.1}'::jsonb),
    ('[DEMO] AWS Bedrock 企业',         'anthropic',   'bedrock',         6,  25, 'active',   NULL,                         true,  false, false, false, false,  0.82::numeric,  70,  44, '{"quota_limit":500,"quota_used":218.6,"quota_weekly_limit":90,"quota_weekly_used":42.3}'::jsonb),
    ('[DEMO] OpenAI OAuth 主力',        'openai',      'oauth',          12,   5, 'active',   NULL,                         true,  false, true,  false, false,  0.92::numeric,  95,  50, jsonb_build_object('codex_5h_used_percent',37,'codex_5h_reset_at',(now() + interval '2 hours')::text,'codex_7d_used_percent',64,'codex_7d_reset_at',(now() + interval '4 days')::text,'codex_usage_updated_at',now()::text,'openai_compact_supported',true)),
    ('[DEMO] OpenAI API Key 配额',      'openai',      'apikey',          8,  20, 'active',   NULL,                         true,  false, false, false, false,  0.88::numeric,  80,  24, '{"quota_limit":300,"quota_used":142.8,"quota_daily_limit":30,"quota_daily_used":17.5,"quota_weekly_limit":160,"quota_weekly_used":82.6,"quota_daily_reset_mode":"fixed","quota_daily_reset_hour":8}'::jsonb),
    ('[DEMO] OpenAI 上游暂停',          'openai',      'upstream',        2,  90, 'disabled', NULL,                         false, false, false, false, false,  0.70::numeric,  20,  62, '{"base_url":"https://openai.demo.invalid"}'::jsonb),
    ('[DEMO] Gemini AI Studio',         'gemini',      'apikey',         10,  15, 'active',   NULL,                         true,  false, false, false, false,  0.76::numeric,  88,  37, '{"gemini_oauth_type":"ai_studio","tier":"paid"}'::jsonb),
    ('[DEMO] Gemini Vertex SA',         'gemini',      'service_account', 7,  35, 'active',   NULL,                         true,  false, false, true,  false,  0.84::numeric,  72,  29, '{"project_id":"preview-project","location":"us-central1"}'::jsonb),
    ('[DEMO] Antigravity 待验证',       'antigravity', 'oauth',           3,  70, 'error',    '需要完成账号验证',             false, false, false, false, false,  0.65::numeric,  25,  18, '{"subscription_tier":"AI Pro","needs_verify":true,"forbidden_type":"validation"}'::jsonb),
    ('[DEMO] Grok OAuth 实时',          'grok',        'oauth',           9,  12, 'active',   NULL,                         true,  false, false, false, false,  1.05::numeric,  90,  21, jsonb_build_object('grok_entitlement_status','active','grok_request_quota',jsonb_build_object('limit',1000,'remaining',624,'reset_at',(now() + interval '1 hour')::text),'grok_token_quota',jsonb_build_object('limit',2000000,'remaining',1280000,'reset_at',(now() + interval '1 hour')::text))),
    ('[DEMO] Grok API 备用',            'grok',        'apikey',          4,  45, 'active',   NULL,                         true,  true,  false, false, true,   1.15::numeric,  48,  11, '{"quota_limit":180,"quota_used":73.2}'::jsonb)
) AS v(name, platform, type, concurrency, priority, status, error_message,
       schedulable, rate_limited, overloaded, temp_unschedulable, expires_soon,
       rate_multiplier, load_factor, last_used_minutes, extra)
LEFT JOIN proxies p
  ON p.name = CASE
      WHEN v.platform IN ('anthropic', 'openai') THEN '[DEMO] 东京主代理'
      WHEN v.platform IN ('gemini', 'antigravity') THEN '[DEMO] 新加坡低延迟'
      ELSE '[DEMO] 美国备用代理'
  END
CROSS JOIN LATERAL (SELECT (v.last_used_minutes % 55) + 5 AS created_days) cd;

INSERT INTO account_groups (account_id, group_id, priority)
SELECT a.id, g.id,
       CASE WHEN a.status = 'active' AND a.schedulable THEN 20 ELSE 80 END
FROM accounts a
JOIN groups g
  ON g.name = CASE a.platform
      WHEN 'anthropic' THEN '[DEMO] Anthropic 企业标准'
      WHEN 'openai' THEN '[DEMO] OpenAI 企业标准'
      WHEN 'gemini' THEN '[DEMO] Gemini 视觉生成'
      WHEN 'antigravity' THEN '[DEMO] Antigravity 备用池'
      WHEN 'grok' THEN '[DEMO] Grok 实时与视频'
  END
WHERE a.notes = 'SUB2API_UI_DEMO';

INSERT INTO account_groups (account_id, group_id, priority)
SELECT a.id, g.id, 10
FROM accounts a
CROSS JOIN groups g
WHERE a.notes = 'SUB2API_UI_DEMO'
  AND a.platform = 'anthropic'
  AND a.status = 'active'
  AND g.name = '[DEMO] Anthropic 备用线路';

-- Standard user/group access and per-user pricing overrides populate related
-- dialogs and make entitlement filtering visible.
INSERT INTO user_allowed_groups (user_id, group_id)
SELECT u.id, g.id
FROM users u
JOIN groups g ON g.name IN (
    '[DEMO] Anthropic 企业标准',
    '[DEMO] OpenAI 企业标准',
    '[DEMO] Gemini 视觉生成',
    '[DEMO] Grok 实时与视频'
)
WHERE u.notes = 'SUB2API_UI_DEMO'
  AND (u.id + g.id) % 3 <> 0;

INSERT INTO user_group_rate_multipliers (
    user_id, group_id, rate_multiplier, rpm_override, created_at, updated_at
)
SELECT u.id, g.id,
       (0.72 + ((u.id + g.id) % 6) * 0.06)::numeric,
       40 + ((u.id + g.id) % 5) * 20,
       now() - interval '10 days', now()
FROM users u
CROSS JOIN groups g
WHERE u.notes = 'SUB2API_UI_DEMO'
  AND g.name IN ('[DEMO] Anthropic 企业标准', '[DEMO] OpenAI 企业标准')
  AND (u.id + g.id) % 2 = 0;

-- Every demo user receives an active key; additional keys exercise all visual
-- states, quotas, expiration and rolling rate-limit windows.
INSERT INTO api_keys (
    user_id, key, name, group_id, status, ip_whitelist, ip_blacklist,
    quota, quota_used, expires_at, last_used_at, rate_limit_5h,
    rate_limit_1d, rate_limit_7d, usage_5h, usage_1d, usage_7d,
    window_5h_start, window_1d_start, window_7d_start, created_at, updated_at
)
SELECT
    u.id,
    'sk-demo-main-' || u.id::text,
    '主开发密钥',
    g.id,
    'active',
    CASE WHEN row_number() OVER (ORDER BY u.id) = 1 THEN '["127.0.0.1","10.0.0.0/8"]'::jsonb ELSE '[]'::jsonb END,
    CASE WHEN row_number() OVER (ORDER BY u.id) = 2 THEN '["192.0.2.10"]'::jsonb ELSE '[]'::jsonb END,
    100 + (u.id % 5) * 50,
    8 + (u.id % 8) * 7.35,
    now() + make_interval(days => 30 + (u.id % 6)::int * 15),
    now() - make_interval(mins => 2 + (u.id % 25)::int),
    12.00, 35.00, 120.00,
    2.20 + (u.id % 3), 8.50 + (u.id % 5), 22.00 + (u.id % 8),
    now() - interval '2 hours', date_trunc('day', now()), date_trunc('week', now()),
    u.created_at + interval '1 hour', now()
FROM users u
JOIN LATERAL (
    SELECT id
    FROM groups
    WHERE name = CASE (u.id % 4)
        WHEN 0 THEN '[DEMO] Anthropic 企业标准'
        WHEN 1 THEN '[DEMO] OpenAI 企业标准'
        WHEN 2 THEN '[DEMO] Gemini 视觉生成'
        ELSE '[DEMO] Grok 实时与视频'
    END
) g ON true
WHERE u.notes = 'SUB2API_UI_DEMO';

INSERT INTO api_keys (
    user_id, key, name, group_id, status, quota, quota_used, expires_at,
    last_used_at, rate_limit_5h, rate_limit_1d, rate_limit_7d,
    usage_5h, usage_1d, usage_7d
)
SELECT u.id, v.key, v.name, g.id, v.status, v.quota, v.quota_used,
       v.expires_at, v.last_used_at, 10, 30, 100, v.used, v.used * 2, v.used * 4
FROM (VALUES
    ('demo.lin@example.com',  'sk-demo-disabled',  '已停用密钥', 'disabled',        80::numeric, 12::numeric, now() + interval '60 days', now() - interval '8 days',  1::numeric),
    ('demo.zhou@example.com', 'sk-demo-exhausted', '额度耗尽',   'quota_exhausted', 50::numeric, 50::numeric, now() + interval '20 days', now() - interval '1 day',  10::numeric),
    ('demo.chen@example.com', 'sk-demo-expired',   '已过期密钥', 'expired',          40::numeric, 31::numeric, now() - interval '2 days',  now() - interval '4 days',  6::numeric),
    ('demo.zhao@example.com', 'sk-demo-unlimited', '无限额度',   'active',            0::numeric, 18::numeric, NULL,                       now() - interval '12 minutes', 3::numeric),
    ('demo.xu@example.com',   'sk-demo-subscription', '团队订阅', 'active',          120::numeric, 45::numeric, now() + interval '120 days', now() - interval '3 minutes', 4::numeric)
) v(email, key, name, status, quota, quota_used, expires_at, last_used_at, used)
JOIN users u ON u.email = v.email
JOIN groups g ON g.name = '[DEMO] Anthropic 企业标准';

INSERT INTO channels (
    name, description, status, model_mapping, billing_model_source,
    restrict_models, features, apply_pricing_to_account_stats, features_config,
    created_at, updated_at
)
VALUES
    ('[DEMO] Claude API', 'Anthropic Messages 与 Claude Code 渠道', 'active', '{"claude-3-7-sonnet-latest":"claude-sonnet-4-5"}', 'channel_mapped', true, 'messages,stream,cache,web_search', true, '{"web_search":true,"prompt_cache":true}', now() - interval '30 days', now()),
    ('[DEMO] OpenAI Responses', 'OpenAI Responses、Chat Completions 与 WebSocket', 'active', '{"gpt-latest":"gpt-5","gpt-fast":"gpt-5-mini"}', 'requested', true, 'responses,chat_completions,websocket,embeddings', true, '{"responses":true,"websocket_v2":true}', now() - interval '24 days', now()),
    ('[DEMO] Gemini 多模态', 'Gemini 文本、图片与批量图片', 'active', '{"gemini-pro":"gemini-2.5-pro"}', 'channel_mapped', true, 'text,image,batch_image', true, '{"image_generation":true,"batch_image":true}', now() - interval '18 days', now()),
    ('[DEMO] Grok Live', 'Grok 实时、图片及视频生成', 'active', '{"grok-latest":"grok-4"}', 'upstream', false, 'chat,live,image,video', true, '{"live":true,"video":true}', now() - interval '12 days', now()),
    ('[DEMO] 维护中备用渠道', '用于预览停用状态', 'disabled', '{}', 'channel_mapped', false, 'fallback', false, '{}', now() - interval '8 days', now());

INSERT INTO channel_groups (channel_id, group_id)
SELECT c.id, g.id
FROM channels c
JOIN groups g ON g.name = CASE c.name
    WHEN '[DEMO] Claude API' THEN '[DEMO] Anthropic 企业标准'
    WHEN '[DEMO] OpenAI Responses' THEN '[DEMO] OpenAI 企业标准'
    WHEN '[DEMO] Gemini 多模态' THEN '[DEMO] Gemini 视觉生成'
    WHEN '[DEMO] Grok Live' THEN '[DEMO] Grok 实时与视频'
    ELSE '[DEMO] Antigravity 备用池'
END
WHERE c.name LIKE '[DEMO] %';

INSERT INTO channel_model_pricing (
    channel_id, models, input_price, output_price, cache_write_price,
    cache_read_price, image_output_price, billing_mode, per_request_price,
    platform, image_input_price, created_at, updated_at
)
SELECT c.id, v.models::jsonb, v.input_price, v.output_price,
       v.cache_write_price, v.cache_read_price, v.image_output_price,
       v.billing_mode, v.per_request_price, v.platform, v.image_input_price,
       now() - interval '7 days', now()
FROM (VALUES
    ('[DEMO] Claude API',        '["claude-sonnet-4-5"]', 3.00::numeric, 15.00::numeric, 3.75::numeric, 0.30::numeric, NULL::numeric, 'token',       NULL::numeric, 'anthropic', NULL::numeric),
    ('[DEMO] Claude API',        '["claude-opus-4-6"]',  5.00::numeric, 25.00::numeric, 6.25::numeric, 0.50::numeric, NULL::numeric, 'token',       NULL::numeric, 'anthropic', NULL::numeric),
    ('[DEMO] OpenAI Responses',  '["gpt-5"]',             2.50::numeric, 10.00::numeric, 3.00::numeric, 0.25::numeric, NULL::numeric, 'token',       NULL::numeric, 'openai',    NULL::numeric),
    ('[DEMO] OpenAI Responses',  '["gpt-5-mini"]',        0.40::numeric,  1.60::numeric, 0.50::numeric, 0.04::numeric, NULL::numeric, 'token',       NULL::numeric, 'openai',    NULL::numeric),
    ('[DEMO] Gemini 多模态',     '["gemini-2.5-pro"]',    1.25::numeric,  5.00::numeric, 1.50::numeric, 0.12::numeric, NULL::numeric, 'token',       NULL::numeric, 'gemini',    NULL::numeric),
    ('[DEMO] Gemini 多模态',     '["gemini-2.5-flash"]',  0.30::numeric,  1.20::numeric, 0.36::numeric, 0.03::numeric, NULL::numeric, 'token',       NULL::numeric, 'gemini',    NULL::numeric),
    ('[DEMO] Gemini 多模态',     '["gemini-image"]',       NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, 0.05::numeric, 'image',       NULL::numeric, 'gemini',    0.01::numeric),
    ('[DEMO] Grok Live',         '["grok-4"]',             3.00::numeric, 15.00::numeric, 3.60::numeric, 0.30::numeric, NULL::numeric, 'token',       NULL::numeric, 'grok',      NULL::numeric),
    ('[DEMO] Grok Live',         '["grok-live"]',          NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, NULL::numeric, 'per_request', 0.08::numeric, 'grok',      NULL::numeric)
) v(channel_name, models, input_price, output_price, cache_write_price,
    cache_read_price, image_output_price, billing_mode, per_request_price,
    platform, image_input_price)
JOIN channels c ON c.name = v.channel_name;

INSERT INTO announcements (
    title, content, status, targeting, starts_at, ends_at, created_by,
    updated_by, notify_mode, created_at, updated_at
)
SELECT v.title, v.content, v.status, v.targeting::jsonb,
       v.starts_at, v.ends_at, a.id, a.id, v.notify_mode, v.created_at, now()
FROM (VALUES
    ('[DEMO] 企业蓝界面预览', '新版管理界面正在本地预览环境逐步重构，所有业务能力保持不变。', 'active', '{}', now() - interval '2 days', now() + interval '30 days', 'popup', now() - interval '2 days'),
    ('[DEMO] 服务维护通知', '本周六 02:00 至 03:00 将进行例行维护，期间可能出现短暂重连。', 'active', '{}', now() - interval '1 day', now() + interval '7 days', 'silent', now() - interval '1 day'),
    ('[DEMO] 高余额用户提醒', '当前公告用于验证按余额定向展示与通知样式。', 'active', '{"any_of":[{"all_of":[{"type":"balance","operator":"gte","value":50}]}]}', now() - interval '3 hours', now() + interval '14 days', 'popup', now() - interval '3 hours'),
    ('[DEMO] 历史公告归档', '该记录用于预览公告归档状态。', 'archived', '{}', now() - interval '30 days', now() - interval '20 days', 'silent', now() - interval '30 days')
) v(title, content, status, targeting, starts_at, ends_at, notify_mode, created_at)
CROSS JOIN LATERAL (
    SELECT id FROM users WHERE email = 'admin@admin.com' LIMIT 1
) a;

INSERT INTO subscription_plans (
    name, description, price, original_price, validity_days,
    validity_unit, features, product_name, for_sale, sort_order, currency,
    cycle_quota_usd, reset_interval_seconds, wallet_fallback_enabled,
    created_at, updated_at
)
SELECT v.name, v.description, v.price, v.original_price,
       v.validity_days, v.validity_unit, v.features, v.product_name,
       v.for_sale, v.sort_order, v.currency, v.cycle_quota_usd,
       v.reset_interval_seconds, v.wallet_fallback_enabled,
       now() - interval '20 days', now()
FROM (VALUES
    ('团队月付', '适合小团队的月度 Claude 订阅', 199.00::numeric, 239.00::numeric, 30, 'day', '每 7 天 $35；专属并发', 'SUB2API_UI_DEMO_TEAM_MONTHLY', true, 10, 'CNY', 35.00::numeric, 604800, true),
    ('团队季付', '三个月订阅与更高并发额度',      529.00::numeric, 597.00::numeric,  3, 'month', '每 7 天 $60；优先调度；额度提醒', 'SUB2API_UI_DEMO_TEAM_QUARTERLY', true, 20, 'CNY', 60.00::numeric, 604800, true),
    ('内部测试计划', '用于预览下架套餐状态',       29.00::numeric,  39.00::numeric,  7, 'day', '每 7 天 $10；仅供内部预览', 'SUB2API_UI_DEMO_INTERNAL', false, 90, 'USD', 10.00::numeric, 604800, false)
) v(name, description, price, original_price, validity_days, validity_unit,
    features, product_name, for_sale, sort_order, currency, cycle_quota_usd,
    reset_interval_seconds, wallet_fallback_enabled);

INSERT INTO subscription_plan_groups (plan_id, group_id)
SELECT p.id, g.id
FROM (VALUES
    ('SUB2API_UI_DEMO_TEAM_MONTHLY',   '[DEMO] Anthropic 企业标准'),
    ('SUB2API_UI_DEMO_TEAM_QUARTERLY', '[DEMO] Anthropic 企业标准'),
    ('SUB2API_UI_DEMO_TEAM_QUARTERLY', '[DEMO] OpenAI 企业标准'),
    ('SUB2API_UI_DEMO_INTERNAL',       '[DEMO] Gemini 视觉生成')
) v(product_name, group_name)
JOIN subscription_plans p ON p.product_name = v.product_name
JOIN groups g ON g.name = v.group_name;

INSERT INTO user_subscriptions (
    user_id, plan_id, starts_at, expires_at, status, daily_window_start,
    weekly_window_start, monthly_window_start, daily_usage_usd,
    weekly_usage_usd, monthly_usage_usd, cycle_quota_usd,
    reset_interval_seconds, cycle_started_at, cycle_usage_usd,
    wallet_fallback_enabled, assigned_by, assigned_at, notes, created_at,
    updated_at
)
SELECT u.id, p.id,
       now() - make_interval(days => v.started_days),
       CASE WHEN v.status = 'expired' THEN now() - interval '2 days'
            ELSE now() + make_interval(days => v.remaining_days) END,
       v.status,
       date_trunc('day', now()), date_trunc('week', now()), date_trunc('month', now()),
       v.daily_usage, v.weekly_usage, v.monthly_usage,
       p.cycle_quota_usd, p.reset_interval_seconds, date_trunc('week', now()),
       v.weekly_usage, p.wallet_fallback_enabled,
       a.id, now() - make_interval(days => v.started_days),
       'SUB2API_UI_DEMO', now() - make_interval(days => v.started_days), now()
FROM (VALUES
    ('demo.lin@example.com',  'SUB2API_UI_DEMO_TEAM_MONTHLY',    5, 25, 'active',    2.35::numeric, 11.80::numeric, 28.40::numeric),
    ('demo.zhou@example.com', 'SUB2API_UI_DEMO_TEAM_QUARTERLY',  9, 21, 'active',    5.72::numeric, 19.20::numeric, 47.60::numeric),
    ('demo.chen@example.com', 'SUB2API_UI_DEMO_TEAM_MONTHLY',    2, 28, 'active',    1.08::numeric,  7.45::numeric, 13.90::numeric),
    ('demo.xu@example.com',   'SUB2API_UI_DEMO_TEAM_QUARTERLY', 18, 72, 'active',    6.48::numeric, 31.50::numeric, 88.20::numeric),
    ('demo.tang@example.com', 'SUB2API_UI_DEMO_TEAM_MONTHLY',   45,  0, 'expired',   0.00::numeric,  0.00::numeric, 94.10::numeric),
    ('demo.gu@example.com',   'SUB2API_UI_DEMO_INTERNAL',        7, 14, 'suspended', 3.20::numeric,  9.80::numeric, 39.00::numeric)
) v(email, product_name, started_days, remaining_days, status, daily_usage, weekly_usage, monthly_usage)
JOIN users u ON u.email = v.email
JOIN subscription_plans p ON p.product_name = v.product_name
CROSS JOIN LATERAL (SELECT id FROM users WHERE email = 'admin@admin.com' LIMIT 1) a;

-- Orders exercise the complete status palette and both balance/subscription
-- order types without contacting a payment provider.
INSERT INTO payment_orders (
    user_id, user_email, user_name, user_notes, amount, pay_amount, fee_rate,
    recharge_code, payment_type, payment_trade_no, order_type, plan_id,
    subscription_plan_snapshot, subscription_days, status, refund_amount,
    refund_reason, refund_at, refund_requested_at, refund_request_reason,
    refund_requested_by, expires_at, paid_at, completed_at, failed_at,
    failed_reason, client_ip, src_host, src_url, out_trade_no,
    provider_key, provider_snapshot, created_at, updated_at
)
SELECT
    u.id, u.email, u.username, u.notes,
    v.amount, v.pay_amount, v.fee_rate,
    'DEMO-RECHARGE-' || lpad(v.seq::text, 3, '0'),
    v.payment_type,
    CASE WHEN v.status IN ('PAID','COMPLETED','REFUND_REQUESTED','REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED') THEN 'DEMO-PAY-' || v.seq::text ELSE '' END,
    v.order_type,
    CASE WHEN v.order_type = 'subscription' THEN sp.id END,
    CASE WHEN v.order_type = 'subscription' THEN jsonb_build_object(
        'schema_version', 2,
        'plan_id', sp.id,
        'plan_name', sp.name,
        'included_group_ids', sp.included_group_ids,
        'included_group_names', sp.included_group_names,
        'cycle_quota_usd', sp.cycle_quota_usd,
        'reset_interval_seconds', sp.reset_interval_seconds,
        'wallet_fallback_enabled', sp.wallet_fallback_enabled,
        'validity_days', sp.validity_days
    ) END,
    CASE WHEN v.order_type = 'subscription' THEN sp.validity_days END,
    v.status,
    v.refund_amount,
    CASE WHEN v.status IN ('PARTIALLY_REFUNDED','REFUNDED') THEN '用户申请退款' END,
    CASE WHEN v.status IN ('PARTIALLY_REFUNDED','REFUNDED') THEN now() - interval '1 day' END,
    CASE WHEN v.status IN ('REFUND_REQUESTED','REFUND_PENDING') THEN now() - interval '6 hours' END,
    CASE WHEN v.status IN ('REFUND_REQUESTED','REFUND_PENDING') THEN '套餐调整' END,
    CASE WHEN v.status IN ('REFUND_REQUESTED','REFUND_PENDING') THEN 'user' END,
    now() + interval '30 minutes',
    CASE WHEN v.status IN ('PAID','COMPLETED','REFUND_REQUESTED','REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED') THEN now() - make_interval(days => v.age_days) + interval '3 minutes' END,
    CASE WHEN v.status IN ('COMPLETED','REFUND_REQUESTED','REFUND_PENDING','PARTIALLY_REFUNDED','REFUNDED') THEN now() - make_interval(days => v.age_days) + interval '5 minutes' END,
    CASE WHEN v.status = 'FAILED' THEN now() - make_interval(days => v.age_days) + interval '2 minutes' END,
    CASE WHEN v.status = 'FAILED' THEN '支付渠道返回失败' END,
    '127.0.0.' || (10 + v.seq)::text,
    '127.0.0.1:3000',
    'http://127.0.0.1:3000/payment',
    'DEMO-ORDER-' || lpad(v.seq::text, 3, '0'),
    'preview-provider',
    jsonb_build_object('display_name','本地预览支付','environment','demo'),
    now() - make_interval(days => v.age_days), now()
FROM (VALUES
    (1,  'demo.lin@example.com',  'COMPLETED',          'balance',      'alipay',  100.00::numeric, 100.00::numeric, 0.006::numeric, 0.00::numeric,  0),
    (2,  'demo.zhou@example.com', 'PENDING',            'subscription', 'wxpay',   199.00::numeric, 199.00::numeric, 0.006::numeric, 0.00::numeric,  0),
    (3,  'demo.chen@example.com', 'PAID',               'balance',      'stripe',   50.00::numeric,  50.00::numeric, 0.029::numeric, 0.00::numeric,  1),
    (4,  'demo.zhao@example.com', 'FAILED',             'balance',      'easypay',  30.00::numeric,  30.00::numeric, 0.012::numeric, 0.00::numeric,  2),
    (5,  'demo.xu@example.com',   'REFUND_REQUESTED',   'subscription', 'alipay',  199.00::numeric, 199.00::numeric, 0.006::numeric, 199.00::numeric, 3),
    (6,  'demo.he@example.com',   'REFUND_PENDING',     'balance',      'wxpay',    20.00::numeric,  20.00::numeric, 0.006::numeric,  20.00::numeric, 4),
    (7,  'demo.gu@example.com',   'PARTIALLY_REFUNDED', 'balance',      'stripe',  120.00::numeric, 120.00::numeric, 0.029::numeric,  30.00::numeric, 5),
    (8,  'demo.tang@example.com', 'REFUNDED',           'balance',      'alipay',   80.00::numeric,  80.00::numeric, 0.006::numeric,  80.00::numeric, 7),
    (9,  'demo.song@example.com', 'EXPIRED',            'balance',      'wxpay',    10.00::numeric,  10.00::numeric, 0.006::numeric,  0.00::numeric, 9),
    (10, 'demo.lu@example.com',   'CANCELLED',          'subscription', 'airwallex',529.00::numeric, 529.00::numeric, 0.025::numeric, 0.00::numeric, 12)
) v(seq, email, status, order_type, payment_type, amount, pay_amount, fee_rate, refund_amount, age_days)
JOIN users u ON u.email = v.email
JOIN LATERAL (
    SELECT
        p.id,
        p.name,
        p.cycle_quota_usd,
        p.reset_interval_seconds,
        p.wallet_fallback_enabled,
        CASE lower(p.validity_unit)
            WHEN 'month' THEN p.validity_days * 30
            WHEN 'months' THEN p.validity_days * 30
            WHEN 'year' THEN p.validity_days * 365
            WHEN 'years' THEN p.validity_days * 365
            ELSE p.validity_days
        END AS validity_days,
        COALESCE((
            SELECT jsonb_agg(spg.group_id ORDER BY spg.group_id)
            FROM subscription_plan_groups spg
            WHERE spg.plan_id = p.id
        ), '[]'::jsonb) AS included_group_ids,
        COALESCE((
            SELECT jsonb_agg(g.name ORDER BY spg.group_id)
            FROM subscription_plan_groups spg
            JOIN groups g ON g.id = spg.group_id
            WHERE spg.plan_id = p.id
        ), '[]'::jsonb) AS included_group_names
    FROM subscription_plans p
    WHERE p.product_name = CASE WHEN v.amount > 500 THEN 'SUB2API_UI_DEMO_TEAM_QUARTERLY'
                                ELSE 'SUB2API_UI_DEMO_TEAM_MONTHLY' END
    LIMIT 1
) sp ON true;

INSERT INTO redeem_codes (
    code, type, value, status, used_by, used_at, notes, plan_id,
    validity_days, expires_at, created_at
)
SELECT
    'DEMO-' || v.code,
    v.type,
    v.value,
    v.status,
    CASE WHEN v.status = 'used' THEN u.id END,
    CASE WHEN v.status = 'used' THEN now() - interval '2 days' END,
    'SUB2API_UI_DEMO - ' || v.notes,
    CASE WHEN v.type = 'subscription' THEN p.id END,
    v.validity_days,
    v.expires_at,
    now() - make_interval(days => v.age_days)
FROM (VALUES
    ('BALANCE-100-A', 'balance',      100.00::numeric, 'unused',   '未使用余额码', 30, now() + interval '60 days', 5,  'demo.lin@example.com'),
    ('BALANCE-50-B',  'balance',       50.00::numeric, 'used',     '已兑换余额码', 30, now() + interval '30 days', 8,  'demo.zhou@example.com'),
    ('CONCURRENCY-5', 'concurrency',     5.00::numeric, 'unused',   '并发额度码',   30, now() + interval '90 days', 2,  'demo.chen@example.com'),
    ('SUB-30D-A',     'subscription',    1.00::numeric, 'unused',   '月度订阅码',   30, now() + interval '120 days', 3, 'demo.zhao@example.com'),
    ('SUB-90D-B',     'subscription',    1.00::numeric, 'used',     '季度订阅码',   90, now() + interval '120 days', 12,'demo.xu@example.com'),
    ('EXPIRED-001',   'balance',         20.00::numeric, 'expired', '过期兑换码',   30, now() - interval '1 day', 40,  'demo.he@example.com'),
    ('DISABLED-001',  'balance',         88.00::numeric, 'disabled','停用兑换码',   30, now() + interval '40 days', 6,  'demo.gu@example.com'),
    ('INVITE-001',    'invitation',       1.00::numeric, 'unused',  '邀请注册码',   14, now() + interval '20 days', 1,  'demo.tang@example.com')
) v(code, type, value, status, notes, validity_days, expires_at, age_days, user_email)
JOIN users u ON u.email = v.user_email
LEFT JOIN LATERAL (
    SELECT id
    FROM subscription_plans
    WHERE v.type = 'subscription'
      AND product_name = CASE WHEN v.validity_days > 30
                              THEN 'SUB2API_UI_DEMO_TEAM_QUARTERLY'
                              ELSE 'SUB2API_UI_DEMO_TEAM_MONTHLY' END
    LIMIT 1
) p ON true;

-- Generate 30 days of hourly usage plus a dense recent five-minute window.
-- The data spans seven models, all request types, both billing types, multiple
-- endpoints, cache usage, image generation and video generation.
WITH demo_user_ids AS (
    SELECT array_agg(id ORDER BY id) AS ids
    FROM users
    WHERE notes = 'SUB2API_UI_DEMO'
), raw_series AS (
    SELECT
        (hour_no * 2 + slot)::integer AS n,
        now() - make_interval(hours => hour_no::integer)
              - make_interval(mins => (slot * 22 + hour_no % 13)::integer)
              - interval '5 seconds' AS occurred_at
    FROM generate_series(0, 719) AS hour_no
    CROSS JOIN generate_series(0, 1) AS slot
    UNION ALL
    SELECT
        (2000 + recent_no)::integer AS n,
        now() - make_interval(secs => (5 + recent_no * 8)::double precision) AS occurred_at
    FROM generate_series(0, 29) AS recent_no
), assigned AS (
    SELECT
        s.*,
        d.ids[1 + (s.n % array_length(d.ids, 1))] AS user_id,
        CASE s.n % 7
            WHEN 0 THEN 'claude-sonnet-4-5'
            WHEN 1 THEN 'claude-opus-4-6'
            WHEN 2 THEN 'gpt-5'
            WHEN 3 THEN 'gpt-5-mini'
            WHEN 4 THEN 'gemini-2.5-pro'
            WHEN 5 THEN 'gemini-2.5-flash'
            ELSE 'grok-4'
        END AS model,
        CASE s.n % 7
            WHEN 0 THEN 'anthropic'
            WHEN 1 THEN 'anthropic'
            WHEN 2 THEN 'openai'
            WHEN 3 THEN 'openai'
            WHEN 4 THEN 'gemini'
            WHEN 5 THEN 'gemini'
            ELSE 'grok'
        END AS platform,
        (650 + (s.n * 97) % 7200)::integer AS input_tokens,
        (180 + (s.n * 53) % 2600)::integer AS output_tokens,
        CASE WHEN s.n % 4 <> 0 THEN (120 + (s.n * 31) % 1800)::integer ELSE 0 END AS cache_read_tokens,
        CASE WHEN s.n % 6 = 0 THEN (80 + (s.n * 17) % 900)::integer ELSE 0 END AS cache_creation_tokens,
        CASE WHEN s.n % 29 = 0 THEN 'video'
             WHEN s.n % 17 = 0 THEN 'image'
             WHEN s.n % 11 = 0 THEN 'per_request'
             ELSE 'token' END AS billing_mode
    FROM raw_series s
    CROSS JOIN demo_user_ids d
), related AS (
    SELECT
        x.*,
        k.id AS api_key_id,
        a.id AS account_id,
        std_group.id AS standard_group_id,
        sub.id AS subscription_id,
        CASE WHEN sub.id IS NOT NULL AND x.n % 5 = 0 THEN 1 ELSE 0 END::smallint AS billing_type
    FROM assigned x
    JOIN LATERAL (
        SELECT id
        FROM api_keys
        WHERE user_id = x.user_id AND status = 'active'
        ORDER BY id
        LIMIT 1
    ) k ON true
    JOIN LATERAL (
        SELECT id
        FROM accounts
        WHERE notes = 'SUB2API_UI_DEMO' AND platform = x.platform
        ORDER BY (status = 'active' AND schedulable) DESC, priority ASC, id ASC
        LIMIT 1
    ) a ON true
    JOIN LATERAL (
        SELECT id
        FROM groups
        WHERE name = CASE x.platform
            WHEN 'anthropic' THEN '[DEMO] Anthropic 企业标准'
            WHEN 'openai' THEN '[DEMO] OpenAI 企业标准'
            WHEN 'gemini' THEN '[DEMO] Gemini 视觉生成'
            ELSE '[DEMO] Grok 实时与视频'
        END
        LIMIT 1
    ) std_group ON true
    LEFT JOIN LATERAL (
        SELECT us.id
        FROM user_subscriptions us
        WHERE us.user_id = x.user_id
          AND us.notes = 'SUB2API_UI_DEMO'
          AND us.status = 'active'
          AND us.expires_at > x.occurred_at
          AND EXISTS (
              SELECT 1
              FROM subscription_plan_groups spg
              WHERE spg.plan_id = us.plan_id
                AND spg.group_id = std_group.id
          )
        ORDER BY us.id
        LIMIT 1
    ) sub ON true
), enriched AS (
    SELECT
        r.*,
        r.standard_group_id AS group_id,
        CASE WHEN r.billing_mode IN ('image', 'video') THEN 1 + (r.n % 3) ELSE 0 END AS image_count,
        CASE WHEN r.billing_mode = 'video' THEN 1 + (r.n % 2) ELSE 0 END AS video_count,
        ROUND((r.input_tokens::numeric / 1000000) * (1.4 + (r.n % 7) * 0.42), 8) AS input_cost,
        ROUND((r.output_tokens::numeric / 1000000) * (5.2 + (r.n % 7) * 1.25), 8) AS output_cost,
        ROUND((r.cache_creation_tokens::numeric / 1000000) * 1.80, 8) AS cache_creation_cost,
        ROUND((r.cache_read_tokens::numeric / 1000000) * 0.18, 8) AS cache_read_cost,
        CASE WHEN r.billing_mode = 'image' THEN (0.025 + (r.n % 3) * 0.025)::numeric ELSE 0::numeric END AS image_output_cost,
        CASE WHEN r.billing_mode = 'image' THEN (0.004 + (r.n % 3) * 0.003)::numeric ELSE 0::numeric END AS image_input_cost,
        CASE WHEN r.billing_mode = 'video' THEN (0.12 + (r.n % 3) * 0.08)::numeric ELSE 0::numeric END AS video_cost
    FROM related r
), costed AS (
    SELECT
        e.*,
        ROUND(e.input_cost + e.output_cost + e.cache_creation_cost + e.cache_read_cost
              + e.image_output_cost + e.image_input_cost + e.video_cost, 8) AS standard_cost
    FROM enriched e
), finalized AS (
    SELECT
        c.*,
        ROUND(c.standard_cost * (0.74 + (c.n % 8) * 0.045), 8) AS charged_cost,
        ch.id AS channel_id
    FROM costed c
    LEFT JOIN LATERAL (
        SELECT channels.id
        FROM channels
        JOIN channel_groups cg ON cg.channel_id = channels.id
        WHERE cg.group_id = c.group_id AND channels.status = 'active'
        ORDER BY channels.id
        LIMIT 1
    ) ch ON true
)
INSERT INTO usage_logs (
    user_id, api_key_id, account_id, request_id, model,
    input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
    cache_creation_5m_tokens, cache_creation_1h_tokens,
    input_cost, output_cost, cache_creation_cost, cache_read_cost,
    total_cost, actual_cost, stream, duration_ms, created_at, group_id,
    subscription_id, rate_multiplier, first_token_ms, billing_type,
    user_agent, image_count, image_size, ip_address, account_rate_multiplier,
    reasoning_effort, cache_ttl_overridden, openai_ws_mode, request_type,
    service_tier, inbound_endpoint, upstream_endpoint, upstream_model,
    requested_model, channel_id, model_mapping_chain, billing_tier,
    billing_mode, image_output_tokens, image_output_cost, account_stats_cost,
    image_input_size, image_output_size, image_size_source,
    image_size_breakdown, video_count, video_resolution,
    video_duration_seconds, long_context_billing_applied,
    image_input_tokens, image_input_cost, session_id
)
SELECT
    f.user_id,
    f.api_key_id,
    f.account_id,
    'DEMO-' || to_char(f.occurred_at, 'YYYYMMDDHH24MISS') || '-' || f.n::text,
    f.model,
    f.input_tokens,
    f.output_tokens,
    f.cache_creation_tokens,
    f.cache_read_tokens,
    CASE WHEN f.cache_creation_tokens > 0 AND f.n % 2 = 0 THEN f.cache_creation_tokens ELSE 0 END,
    CASE WHEN f.cache_creation_tokens > 0 AND f.n % 2 = 1 THEN f.cache_creation_tokens ELSE 0 END,
    f.input_cost,
    f.output_cost,
    f.cache_creation_cost,
    f.cache_read_cost,
    f.standard_cost,
    f.charged_cost,
    f.n % 3 <> 0,
    420 + (f.n * 137) % 9200,
    f.occurred_at,
    f.group_id,
    CASE WHEN f.billing_type = 1 THEN f.subscription_id END,
    CASE WHEN f.billing_type = 1 THEN 1.00 ELSE 0.82 + (f.n % 6) * 0.06 END,
    90 + (f.n * 41) % 1350,
    f.billing_type,
    CASE f.n % 5
        WHEN 0 THEN 'Claude-Code/2.1 (darwin; arm64)'
        WHEN 1 THEN 'codex-cli/1.12 (macOS)'
        WHEN 2 THEN 'OpenAI-Python/1.68'
        WHEN 3 THEN 'Mozilla/5.0 Sub2API-Dashboard'
        ELSE 'curl/8.7.1'
    END,
    f.image_count,
    CASE WHEN f.image_count > 0 AND f.billing_mode <> 'video'
         THEN (ARRAY['1K','2K','4K','mixed'])[1 + (f.n % 4)] END,
    '10.20.' || (f.n % 12)::text || '.' || (20 + f.n % 210)::text,
    0.68 + (f.n % 7) * 0.07,
    CASE f.n % 4 WHEN 0 THEN 'low' WHEN 1 THEN 'medium' WHEN 2 THEN 'high' ELSE 'xhigh' END,
    f.n % 9 = 0,
    f.n % 5 = 2,
    (1 + f.n % 5)::smallint,
    CASE f.n % 4 WHEN 0 THEN 'default' WHEN 1 THEN 'priority' WHEN 2 THEN 'flex' ELSE 'auto' END,
    CASE f.n % 5
        WHEN 0 THEN '/v1/messages'
        WHEN 1 THEN '/v1/responses'
        WHEN 2 THEN '/v1/responses/ws'
        WHEN 3 THEN '/v1/images/generations'
        ELSE '/v1/chat/completions'
    END,
    CASE f.platform
        WHEN 'anthropic' THEN '/v1/messages'
        WHEN 'openai' THEN '/v1/responses'
        WHEN 'gemini' THEN '/v1beta/models:generateContent'
        ELSE '/v1/chat/completions'
    END,
    CASE f.model
        WHEN 'claude-sonnet-4-5' THEN 'claude-sonnet-4-5-20250929'
        WHEN 'claude-opus-4-6' THEN 'claude-opus-4-6-20260205'
        WHEN 'gpt-5' THEN 'gpt-5-2026-05-18'
        WHEN 'gpt-5-mini' THEN 'gpt-5-mini-2026-05-18'
        ELSE f.model
    END,
    CASE f.n % 4
        WHEN 0 THEN f.model
        WHEN 1 THEN replace(f.model, '-4-5', '-latest')
        WHEN 2 THEN CASE WHEN f.platform = 'openai' THEN 'gpt-latest' ELSE f.model END
        ELSE CASE WHEN f.platform = 'gemini' THEN 'gemini-pro' ELSE f.model END
    END,
    f.channel_id,
    CASE WHEN f.n % 4 = 0 THEN NULL
         ELSE coalesce(CASE WHEN f.platform = 'openai' THEN 'gpt-latest -> ' ELSE 'public -> ' END, '') || f.model END,
    CASE f.n % 3 WHEN 0 THEN 'standard' WHEN 1 THEN 'premium' ELSE 'batch' END,
    f.billing_mode,
    CASE WHEN f.billing_mode = 'image' THEN 900 + (f.n % 8) * 120 ELSE 0 END,
    f.image_output_cost,
    ROUND(f.standard_cost * (0.58 + (f.n % 5) * 0.06), 8),
    CASE WHEN f.billing_mode = 'image' THEN (ARRAY['512x512','1024x1024','2048x2048'])[1 + (f.n % 3)] END,
    CASE WHEN f.billing_mode = 'image' THEN (ARRAY['1024x1024','2048x2048','4096x4096'])[1 + (f.n % 3)] END,
    CASE WHEN f.billing_mode = 'image' THEN (ARRAY['input','output','default','legacy'])[1 + (f.n % 4)] END,
    CASE WHEN f.billing_mode = 'image'
         THEN jsonb_build_object('1K', CASE WHEN f.n % 2 = 0 THEN 1 ELSE 0 END,
                                 '2K', CASE WHEN f.n % 2 = 1 THEN 1 ELSE 0 END)
         END,
    f.video_count,
    CASE WHEN f.billing_mode = 'video' THEN (ARRAY['480p','720p','1080p'])[1 + (f.n % 3)] END,
    CASE WHEN f.billing_mode = 'video' THEN (ARRAY[5,10,15])[1 + (f.n % 3)] END,
    f.n % 19 = 0,
    CASE WHEN f.billing_mode = 'image' THEN 180 + (f.n % 6) * 40 ELSE 0 END,
    f.image_input_cost,
    'demo-session-' || (f.user_id % 5)::text || '-' || (f.n % 18)::text
FROM finalized f;

-- Rebuild dashboard aggregates from every usage row so demo and any preserved
-- non-demo data stay consistent. Buckets follow the backend's configured zone.
DELETE FROM usage_dashboard_hourly_users;
DELETE FROM usage_dashboard_daily_users;
DELETE FROM usage_dashboard_hourly;
DELETE FROM usage_dashboard_daily;

INSERT INTO usage_dashboard_hourly_users (bucket_start, user_id)
SELECT DISTINCT
    date_trunc('hour', created_at AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai',
    user_id
FROM usage_logs;

INSERT INTO usage_dashboard_daily_users (bucket_date, user_id)
SELECT DISTINCT
    (created_at AT TIME ZONE 'Asia/Shanghai')::date,
    user_id
FROM usage_logs;

INSERT INTO usage_dashboard_hourly (
    bucket_start, total_requests, input_tokens, output_tokens,
    cache_creation_tokens, cache_read_tokens, total_cost, actual_cost,
    account_cost, total_duration_ms, active_users, computed_at
)
SELECT
    date_trunc('hour', ul.created_at AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS bucket_start,
    count(*) AS total_requests,
    coalesce(sum(ul.input_tokens), 0),
    coalesce(sum(ul.output_tokens), 0),
    coalesce(sum(ul.cache_creation_tokens), 0),
    coalesce(sum(ul.cache_read_tokens), 0),
    coalesce(sum(ul.total_cost), 0),
    coalesce(sum(ul.actual_cost), 0),
    coalesce(sum(coalesce(ul.account_stats_cost, ul.total_cost) * coalesce(ul.account_rate_multiplier, 1)), 0),
    coalesce(sum(coalesce(ul.duration_ms, 0)), 0),
    count(DISTINCT ul.user_id),
    now()
FROM usage_logs ul
GROUP BY 1;

INSERT INTO usage_dashboard_daily (
    bucket_date, total_requests, input_tokens, output_tokens,
    cache_creation_tokens, cache_read_tokens, total_cost, actual_cost,
    account_cost, total_duration_ms, active_users, computed_at
)
SELECT
    (ul.created_at AT TIME ZONE 'Asia/Shanghai')::date AS bucket_date,
    count(*) AS total_requests,
    coalesce(sum(ul.input_tokens), 0),
    coalesce(sum(ul.output_tokens), 0),
    coalesce(sum(ul.cache_creation_tokens), 0),
    coalesce(sum(ul.cache_read_tokens), 0),
    coalesce(sum(ul.total_cost), 0),
    coalesce(sum(ul.actual_cost), 0),
    coalesce(sum(coalesce(ul.account_stats_cost, ul.total_cost) * coalesce(ul.account_rate_multiplier, 1)), 0),
    coalesce(sum(coalesce(ul.duration_ms, 0)), 0),
    count(DISTINCT ul.user_id),
    now()
FROM usage_logs ul
GROUP BY 1;

INSERT INTO usage_dashboard_aggregation_watermark (id, last_aggregated_at, updated_at)
VALUES (1, now(), now())
ON CONFLICT (id) DO UPDATE
SET last_aggregated_at = EXCLUDED.last_aggregated_at,
    updated_at = EXCLUDED.updated_at;

COMMIT;

-- Compact execution report for local verification.
SELECT 'users' AS entity, count(*) AS rows FROM users WHERE notes = 'SUB2API_UI_DEMO'
UNION ALL SELECT 'groups', count(*) FROM groups WHERE name LIKE '[DEMO] %'
UNION ALL SELECT 'accounts', count(*) FROM accounts WHERE notes = 'SUB2API_UI_DEMO'
UNION ALL SELECT 'proxies', count(*) FROM proxies WHERE name LIKE '[DEMO] %'
UNION ALL SELECT 'api_keys', count(*) FROM api_keys WHERE key LIKE 'sk-demo-%'
UNION ALL SELECT 'channels', count(*) FROM channels WHERE name LIKE '[DEMO] %'
UNION ALL SELECT 'announcements', count(*) FROM announcements WHERE title LIKE '[DEMO] %'
UNION ALL SELECT 'subscription_plans', count(*) FROM subscription_plans WHERE product_name LIKE 'SUB2API_UI_DEMO%'
UNION ALL SELECT 'subscriptions', count(*) FROM user_subscriptions WHERE notes = 'SUB2API_UI_DEMO'
UNION ALL SELECT 'payment_orders', count(*) FROM payment_orders WHERE out_trade_no LIKE 'DEMO-%'
UNION ALL SELECT 'redeem_codes', count(*) FROM redeem_codes WHERE code LIKE 'DEMO-%'
UNION ALL SELECT 'usage_logs', count(*) FROM usage_logs WHERE request_id LIKE 'DEMO-%'
ORDER BY entity;
