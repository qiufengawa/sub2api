-- Complete Test-account fixtures for user-side UI preview.
--
-- Safety properties:
--   * only runs against the local sub2api_preview database;
--   * never changes test@test.com's password or authentication bindings;
--   * replaces only TEST-UI-* / SUB2API_TEST_UI_PREVIEW records;
--   * can be executed repeatedly without accumulating rows.

BEGIN;

SET LOCAL TIME ZONE 'Asia/Shanghai';

DO $guard$
BEGIN
    IF current_database() <> 'sub2api_preview' THEN
        RAISE EXCEPTION 'Refusing to seed database "%"; expected sub2api_preview', current_database();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'test@test.com') THEN
        RAISE EXCEPTION 'Preview user test@test.com does not exist';
    END IF;
END
$guard$;

-- Delete marker-owned rows from leaves to roots. No unrelated Test data or
-- global preview data is removed.
DELETE FROM batch_image_jobs
WHERE batch_id LIKE 'TEST-UI-BATCH-%'
  AND user_id = (SELECT id FROM users WHERE email = 'test@test.com');

DELETE FROM ops_error_logs
WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.com')
  AND request_id LIKE 'TEST-UI-ERROR-%';

DELETE FROM user_affiliate_ledger
WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.com')
  AND source_user_id IN (
      SELECT id FROM users WHERE notes = 'SUB2API_TEST_UI_PREVIEW_INVITEE'
  );

DELETE FROM users
WHERE notes = 'SUB2API_TEST_UI_PREVIEW_INVITEE'
  AND email LIKE 'test.ui.invitee.%@example.invalid';

DELETE FROM payment_orders
WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.com')
  AND out_trade_no LIKE 'TEST-UI-ORDER-%';

DELETE FROM redeem_codes
WHERE used_by = (SELECT id FROM users WHERE email = 'test@test.com')
  AND code LIKE 'TEST-UI-%';

DELETE FROM usage_logs
WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.com')
  AND request_id LIKE 'TEST-UI-USAGE-%';

DELETE FROM user_subscriptions
WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.com')
  AND notes = 'SUB2API_TEST_UI_PREVIEW';

DELETE FROM api_keys
WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.com')
  AND key LIKE 'sk-test-ui-preview-%';

DELETE FROM subscription_plans
WHERE product_name LIKE 'TEST-UI-PLAN-%';

DELETE FROM groups
WHERE name LIKE 'TEST-UI-SUB-%';

DELETE FROM channel_monitors
WHERE name LIKE 'TEST-UI-MONITOR-%';

DELETE FROM payment_provider_instances
WHERE name LIKE 'TEST-UI-PAYMENT-%';

-- Account-level information shown by Profile and Dashboard. Authentication
-- fields are intentionally absent from this update.
UPDATE users
SET balance = 82.36,
    frozen_balance = 6.80,
    concurrency = 6,
    total_recharged = 368.00,
    balance_notify_enabled = true,
    balance_notify_threshold = 20.00,
    last_active_at = now() - interval '3 minutes',
    updated_at = now()
WHERE email = 'test@test.com';

-- Three provider subscriptions cover near-limit, healthy and unlimited states.
-- The Gemini group also unlocks the local batch-image preview key.
INSERT INTO groups (
    name, description, platform, rate_multiplier, is_exclusive, status,
    subscription_type, daily_limit_usd, weekly_limit_usd, monthly_limit_usd,
    default_validity_days, peak_rate_enabled, peak_start, peak_end,
    peak_rate_multiplier, allow_image_generation, allow_batch_image_generation,
    batch_image_discount_multiplier, batch_image_hold_multiplier,
    models_list_config, created_at, updated_at
)
VALUES
    (
        'TEST-UI-SUB-企业版', '接近日额度上限，用于验证风险提示和紧凑进度行',
        'openai', 1.00, true, 'active', 'subscription',
        10.00, 45.00, 160.00, 30, true, '09:00', '18:00', 1.15,
        false, false, 0.50, 0.60,
        '{"include":["gpt-5.4","gpt-4.1","o4-mini"]}',
        now() - interval '40 days', now()
    ),
    (
        'TEST-UI-SUB-稳定版', '用量健康，用于验证常规订阅状态和多周期额度',
        'anthropic', 0.90, true, 'active', 'subscription',
        20.00, 80.00, 300.00, 30, false, '', '', 1.00,
        false, false, 0.50, 0.60,
        '{"include":["claude-sonnet-4-5","claude-opus-4-1"]}',
        now() - interval '20 days', now()
    ),
    (
        'TEST-UI-SUB-无限版', '无限额度与批量图片，用于验证无上限订阅和任务工作台',
        'gemini', 1.05, true, 'active', 'subscription',
        NULL, NULL, NULL, 90, false, '', '', 1.00,
        true, true, 0.45, 0.55,
        '{"include":["gemini-2.5-pro","gemini-2.5-flash"]}',
        now() - interval '10 days', now()
    );

-- Reuse local non-routable demo Gemini accounts for model discovery only.
INSERT INTO account_groups (account_id, group_id, priority)
SELECT a.id, g.id, 10
FROM accounts a
CROSS JOIN groups g
WHERE a.notes = 'SUB2API_UI_DEMO'
  AND a.platform = 'gemini'
  AND a.status = 'active'
  AND g.name = 'TEST-UI-SUB-无限版'
ON CONFLICT DO NOTHING;

INSERT INTO subscription_plans (
    group_id, name, description, price, original_price, validity_days,
    validity_unit, features, product_name, for_sale, sort_order, currency,
    created_at, updated_at
)
SELECT g.id, v.name, v.description, v.price, v.original_price, v.validity_days,
       v.validity_unit, v.features, v.product_name, true, v.sort_order, 'CNY',
       now() - interval '20 days', now()
FROM (VALUES
    ('企业月付', '适合稳定生产调用', 168.00::numeric, 198.00::numeric, 30, 'day',
     '每日 $10；每周 $45；高峰倍率 1.15x', 'TEST-UI-PLAN-OPENAI', 10, 'TEST-UI-SUB-企业版'),
    ('稳定月付', '适合长文本与数据分析', 228.00::numeric, 268.00::numeric, 30, 'day',
     '每日 $20；每周 $80；月度 $300', 'TEST-UI-PLAN-ANTHROPIC', 20, 'TEST-UI-SUB-稳定版'),
    ('视觉季付', '包含批量图片能力', 498.00::numeric, 568.00::numeric, 90, 'day',
     '无周期额度上限；批量图片折扣', 'TEST-UI-PLAN-GEMINI', 30, 'TEST-UI-SUB-无限版')
) v(name, description, price, original_price, validity_days, validity_unit,
    features, product_name, sort_order, group_name)
JOIN groups g ON g.name = v.group_name;

INSERT INTO user_subscriptions (
    user_id, group_id, starts_at, expires_at, status,
    daily_window_start, weekly_window_start, monthly_window_start,
    daily_usage_usd, weekly_usage_usd, monthly_usage_usd,
    assigned_by, assigned_at, notes, created_at, updated_at
)
SELECT
    u.id, g.id,
    now() - make_interval(days => v.started_days),
    now() + make_interval(days => v.remaining_days),
    'active',
    date_trunc('day', now()), date_trunc('week', now()), date_trunc('month', now()),
    v.daily_usage, v.weekly_usage, v.monthly_usage,
    (SELECT id FROM users WHERE email = 'admin@admin.com' LIMIT 1),
    now() - make_interval(days => v.started_days),
    'SUB2API_TEST_UI_PREVIEW',
    now() - make_interval(days => v.started_days), now()
FROM (VALUES
    ('TEST-UI-SUB-企业版',  24,  6, 9.25::numeric, 31.80::numeric,  86.40::numeric),
    ('TEST-UI-SUB-稳定版',  11, 26, 6.20::numeric, 24.50::numeric, 112.00::numeric),
    ('TEST-UI-SUB-无限版',   5, 55, 0.00::numeric,  0.00::numeric,   0.00::numeric)
) v(group_name, started_days, remaining_days, daily_usage, weekly_usage, monthly_usage)
JOIN groups g ON g.name = v.group_name
CROSS JOIN users u
WHERE u.email = 'test@test.com';

-- Three harmless, non-routable keys populate the complete key workbench.
INSERT INTO api_keys (
    user_id, key, name, group_id, status, ip_whitelist, ip_blacklist,
    quota, quota_used, expires_at, last_used_at,
    rate_limit_5h, rate_limit_1d, rate_limit_7d,
    usage_5h, usage_1d, usage_7d,
    window_5h_start, window_1d_start, window_7d_start, created_at, updated_at
)
SELECT u.id, v.key, v.name, g.id, v.status, v.allowlist::jsonb, '[]'::jsonb,
       v.quota, v.quota_used, now() + make_interval(days => v.expires_days),
       now() - make_interval(mins => v.last_used_minutes),
       v.limit_5h, v.limit_1d, v.limit_7d,
       v.used_5h, v.used_1d, v.used_7d,
       now() - interval '2 hours', date_trunc('day', now()), date_trunc('week', now()),
       now() - interval '45 days', now()
FROM (VALUES
    ('sk-test-ui-preview-openai-not-valid', 'TEST-UI-KEY-生产环境', 'TEST-UI-SUB-企业版',
     'active', '["127.0.0.1","10.0.0.0/8"]', 250::numeric, 86.40::numeric, 90, 4,
     15::numeric, 45::numeric, 150::numeric, 4.80::numeric, 12.60::numeric, 42.30::numeric),
    ('sk-test-ui-preview-anthropic-not-valid', 'TEST-UI-KEY-数据分析', 'TEST-UI-SUB-稳定版',
     'active', '[]', 120::numeric, 42.75::numeric, 35, 22,
     12::numeric, 36::numeric, 120::numeric, 2.40::numeric, 8.10::numeric, 31.20::numeric),
    ('sk-test-ui-preview-gemini-not-valid', 'TEST-UI-KEY-图像任务', 'TEST-UI-SUB-无限版',
     'active', '[]', 80::numeric, 18.20::numeric, 15, 180,
     8::numeric, 24::numeric, 80::numeric, 1.60::numeric, 5.80::numeric, 18.20::numeric)
) v(key, name, group_name, status, allowlist, quota, quota_used, expires_days,
    last_used_minutes, limit_5h, limit_1d, limit_7d, used_5h, used_1d, used_7d)
JOIN groups g ON g.name = v.group_name
CROSS JOIN users u
WHERE u.email = 'test@test.com';

-- 180 calls over 30 days, seven models, varied endpoints, request types,
-- billing modes, cache activity, cost, duration and stream modes.
WITH generated AS (
    SELECT n,
           now() - make_interval(hours => ((n - 1) * 4)::integer) AS occurred_at,
           (ARRAY['gpt-4.1','claude-sonnet-4-5','claude-opus-4-1',
                  'gemini-2.5-pro','gemini-2.5-flash','o4-mini','gpt-5.4'])[1 + ((n - 1) % 7)] AS model,
           (ARRAY['openai','anthropic','anthropic','gemini','gemini','openai','openai'])[1 + ((n - 1) % 7)] AS platform
    FROM generate_series(1, 180) n
), related AS (
    SELECT x.*,
           k.id AS api_key_id,
           k.group_id,
           a.id AS account_id,
           us.id AS subscription_id
    FROM generated x
    JOIN LATERAL (
        SELECT ak.id, ak.group_id
        FROM api_keys ak
        JOIN groups g ON g.id = ak.group_id
        WHERE ak.user_id = (SELECT id FROM users WHERE email = 'test@test.com')
          AND ak.key LIKE 'sk-test-ui-preview-%'
          AND g.platform = x.platform
        ORDER BY ak.id
        LIMIT 1
    ) k ON true
    JOIN LATERAL (
        SELECT id FROM accounts
        WHERE notes = 'SUB2API_UI_DEMO' AND platform = x.platform
        ORDER BY (status = 'active' AND schedulable) DESC, priority, id
        LIMIT 1
    ) a ON true
    LEFT JOIN LATERAL (
        SELECT id FROM user_subscriptions
        WHERE user_id = (SELECT id FROM users WHERE email = 'test@test.com')
          AND group_id = k.group_id
          AND notes = 'SUB2API_TEST_UI_PREVIEW'
        LIMIT 1
    ) us ON true
)
INSERT INTO usage_logs (
    user_id, api_key_id, account_id, request_id, model,
    input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
    cache_creation_5m_tokens, cache_creation_1h_tokens,
    input_cost, output_cost, cache_creation_cost, cache_read_cost,
    total_cost, actual_cost, stream, duration_ms, created_at, group_id,
    subscription_id, rate_multiplier, first_token_ms, billing_type,
    user_agent, ip_address, account_rate_multiplier, reasoning_effort,
    cache_ttl_overridden, openai_ws_mode, request_type, service_tier,
    inbound_endpoint, upstream_endpoint, upstream_model, requested_model,
    billing_tier, billing_mode, account_stats_cost, session_id
)
SELECT
    (SELECT id FROM users WHERE email = 'test@test.com'),
    r.api_key_id, r.account_id,
    'TEST-UI-USAGE-' || lpad(r.n::text, 4, '0'),
    r.model,
    300 + (r.n * 137) % 1500,
    180 + (r.n * 83) % 2600,
    CASE WHEN r.n % 4 = 0 THEN 2400 + (r.n * 31) % 5600 ELSE 0 END,
    CASE WHEN r.n % 4 <> 0 THEN 2400 + (r.n * 53) % 7600 ELSE 0 END,
    CASE WHEN r.n % 8 = 0 THEN 2400 + (r.n * 31) % 5600 ELSE 0 END,
    CASE WHEN r.n % 4 = 0 AND r.n % 8 <> 0 THEN 2400 + (r.n * 31) % 5600 ELSE 0 END,
    round(((300 + (r.n * 137) % 1500)::numeric / 1000000) * (1.8 + r.n % 5), 8),
    round(((180 + (r.n * 83) % 2600)::numeric / 1000000) * (7.2 + r.n % 6), 8),
    CASE WHEN r.n % 4 = 0 THEN round(((2400 + (r.n * 31) % 5600)::numeric / 1000000) * 2.2, 8) ELSE 0 END,
    CASE WHEN r.n % 4 <> 0 THEN round(((2400 + (r.n * 53) % 7600)::numeric / 1000000) * 0.22, 8) ELSE 0 END,
    round(0.0035 + (r.n % 17) * 0.00115, 8),
    round((0.0035 + (r.n % 17) * 0.00115) * (0.78 + (r.n % 5) * 0.06), 8),
    r.n % 3 <> 0,
    420 + (r.n * 137) % 8200,
    r.occurred_at,
    r.group_id,
    CASE WHEN r.n % 5 = 0 THEN r.subscription_id END,
    CASE WHEN r.n % 5 = 0 THEN 1.00 ELSE 0.82 + (r.n % 6) * 0.06 END,
    90 + (r.n * 41) % 1350,
    CASE WHEN r.n % 5 = 0 THEN 1 ELSE 0 END,
    (ARRAY['OpenAI-Python/1.68','Claude-Code/2.1','codex-cli/1.12','curl/8.7.1'])[1 + (r.n % 4)],
    '10.20.' || (r.n % 12)::text || '.' || (20 + r.n % 210)::text,
    0.72 + (r.n % 5) * 0.07,
    (ARRAY['low','medium','high','xhigh'])[1 + (r.n % 4)],
    r.n % 9 = 0,
    r.n % 7 = 0,
    (r.n % 6)::smallint,
    (ARRAY['default','priority','flex','auto'])[1 + (r.n % 4)],
    (ARRAY['/v1/chat/completions','/v1/messages','/v1/images/generations','/v1/responses'])[1 + (r.n % 4)],
    CASE r.platform WHEN 'anthropic' THEN '/v1/messages' WHEN 'gemini' THEN '/v1beta/models:generateContent' ELSE '/v1/responses' END,
    r.model || '-preview',
    r.model,
    (ARRAY['standard','premium','batch'])[1 + (r.n % 3)],
    CASE WHEN r.n % 11 = 0 THEN 'per_request' ELSE 'token' END,
    round((0.0035 + (r.n % 17) * 0.00115) * 0.64, 8),
    'test-ui-session-' || (r.n % 12)::text
FROM related r;

-- Failed-request rows drive the user error-log tab without storing prompts or
-- credentials. Messages are sanitized and synthetic.
INSERT INTO ops_error_logs (
    request_id, client_request_id, user_id, api_key_id, account_id, group_id,
    client_ip, platform, model, request_path, stream, user_agent,
    error_phase, error_type, severity, status_code, is_business_limited,
    error_message, error_source, error_owner, upstream_status_code,
    provider_error_code, duration_ms, created_at, inbound_endpoint,
    upstream_endpoint, requested_model, upstream_model, request_type,
    api_key_prefix
)
SELECT
    'TEST-UI-ERROR-' || lpad(v.n::text, 3, '0'),
    'test-client-error-' || v.n::text,
    u.id, k.id, a.id, k.group_id,
    ('192.0.2.' || (20 + v.n)::text)::inet,
    g.platform,
    (ARRAY['gpt-5.4','claude-sonnet-4-5','gemini-2.5-pro'])[1 + ((v.n - 1) % 3)],
    (ARRAY['/v1/responses','/v1/messages','/v1/chat/completions'])[1 + ((v.n - 1) % 3)],
    v.n % 2 = 0,
    'SUB2API-Test-Preview/1.0',
    (ARRAY['upstream','routing','authentication','billing'])[1 + ((v.n - 1) % 4)],
    (ARRAY['rate_limit','upstream_error','no_account','invalid_request'])[1 + ((v.n - 1) % 4)],
    CASE WHEN v.n % 5 = 0 THEN 'P1' ELSE 'P2' END,
    (ARRAY[429,502,503,400])[1 + ((v.n - 1) % 4)],
    v.n % 4 = 1,
    (ARRAY['请求频率达到上游限制','上游服务暂时不可用','当前没有可调度账号','请求参数校验失败'])[1 + ((v.n - 1) % 4)],
    'upstream', 'provider',
    (ARRAY[429,502,503,400])[1 + ((v.n - 1) % 4)],
    (ARRAY['rate_limit_exceeded','upstream_unavailable','no_available_account','invalid_request'])[1 + ((v.n - 1) % 4)],
    520 + v.n * 137,
    now() - make_interval(hours => v.n * 7),
    (ARRAY['/v1/responses','/v1/messages','/v1/chat/completions'])[1 + ((v.n - 1) % 3)],
    CASE g.platform WHEN 'anthropic' THEN '/v1/messages' WHEN 'gemini' THEN '/v1beta/models:generateContent' ELSE '/v1/responses' END,
    (ARRAY['gpt-5.4','claude-sonnet-4-5','gemini-2.5-pro'])[1 + ((v.n - 1) % 3)],
    (ARRAY['gpt-5.4-preview','claude-sonnet-4-5-preview','gemini-2.5-pro-preview'])[1 + ((v.n - 1) % 3)],
    (v.n % 6)::smallint,
    left(k.key, 12)
FROM generate_series(1, 12) v(n)
CROSS JOIN users u
JOIN LATERAL (
    SELECT ak.id, ak.key, ak.group_id
    FROM api_keys ak
    WHERE ak.user_id = u.id AND ak.key LIKE 'sk-test-ui-preview-%'
    ORDER BY ak.id OFFSET ((v.n - 1) % 3) LIMIT 1
) k ON true
JOIN groups g ON g.id = k.group_id
JOIN LATERAL (
    SELECT id FROM accounts
    WHERE notes = 'SUB2API_UI_DEMO' AND platform = g.platform
    ORDER BY (status = 'active' AND schedulable) DESC, priority, id
    LIMIT 1
) a ON true
WHERE u.email = 'test@test.com';

INSERT INTO redeem_codes (
    code, type, value, status, used_by, used_at, notes, group_id,
    validity_days, expires_at, created_at
)
SELECT v.code, v.type, v.value, 'used', u.id,
       now() - make_interval(hours => v.age_hours),
       'SUB2API_TEST_UI_PREVIEW - ' || v.notes,
       CASE WHEN v.group_name <> '' THEN g.id END,
       v.validity_days, now() + interval '90 days',
       now() - make_interval(hours => v.age_hours + 2)
FROM (VALUES
    ('TEST-UI-BALANCE-50', 'balance', 50::numeric, '余额兑换成功', '', 30, 4),
    ('TEST-UI-CONCURRENCY', 'concurrency', 3::numeric, '并发额度兑换成功', '', 30, 26),
    ('TEST-UI-SUB-30D', 'subscription', 1::numeric, 'Claude 团队订阅', 'TEST-UI-SUB-稳定版', 30, 74),
    ('TEST-UI-ADMIN-BAL', 'admin_balance', -5::numeric, '管理员账务校正', '', 30, 122),
    ('TEST-UI-ADMIN-CONC', 'admin_concurrency', 1::numeric, '管理员并发调整', '', 30, 194)
) v(code, type, value, notes, group_name, validity_days, age_hours)
CROSS JOIN users u
LEFT JOIN groups g ON g.name = v.group_name
WHERE u.email = 'test@test.com';

-- Complete order status palette for the user's order history and result pages.
INSERT INTO payment_orders (
    user_id, user_email, user_name, user_notes, amount, pay_amount, fee_rate,
    recharge_code, payment_type, payment_trade_no, order_type, plan_id,
    subscription_group_id, subscription_days, status, refund_amount,
    refund_reason, refund_at, refund_requested_at, refund_request_reason,
    refund_requested_by, expires_at, paid_at, completed_at, failed_at,
    failed_reason, client_ip, src_host, src_url, out_trade_no,
    provider_key, provider_snapshot, created_at, updated_at
)
SELECT
    u.id, u.email, u.username, 'SUB2API_TEST_UI_PREVIEW',
    v.amount, v.pay_amount, v.fee_rate,
    'TEST-UI-RECHARGE-' || lpad(v.seq::text, 3, '0'),
    v.payment_type,
    CASE WHEN v.status IN ('PAID','COMPLETED','REFUND_REQUESTED','PARTIALLY_REFUNDED','REFUNDED') THEN 'TEST-UI-PAY-' || v.seq::text ELSE '' END,
    v.order_type,
    CASE WHEN v.order_type = 'subscription' THEN sp.id END,
    CASE WHEN v.order_type = 'subscription' THEN sp.group_id END,
    CASE WHEN v.order_type = 'subscription' THEN 30 END,
    v.status, v.refund_amount,
    CASE WHEN v.status IN ('PARTIALLY_REFUNDED','REFUNDED') THEN '套餐调整' END,
    CASE WHEN v.status IN ('PARTIALLY_REFUNDED','REFUNDED') THEN now() - interval '1 day' END,
    CASE WHEN v.status = 'REFUND_REQUESTED' THEN now() - interval '6 hours' END,
    CASE WHEN v.status = 'REFUND_REQUESTED' THEN '重复购买' END,
    CASE WHEN v.status = 'REFUND_REQUESTED' THEN 'user' END,
    now() - make_interval(days => v.age_days) + interval '30 minutes',
    CASE WHEN v.status IN ('PAID','COMPLETED','REFUND_REQUESTED','PARTIALLY_REFUNDED','REFUNDED') THEN now() - make_interval(days => v.age_days) + interval '3 minutes' END,
    CASE WHEN v.status IN ('COMPLETED','REFUND_REQUESTED','PARTIALLY_REFUNDED','REFUNDED') THEN now() - make_interval(days => v.age_days) + interval '5 minutes' END,
    CASE WHEN v.status = 'FAILED' THEN now() - make_interval(days => v.age_days) + interval '2 minutes' END,
    CASE WHEN v.status = 'FAILED' THEN '本地预览支付失败' END,
    '127.0.0.1', '127.0.0.1:3000', 'http://127.0.0.1:3000/payment',
    'TEST-UI-ORDER-' || lpad(v.seq::text, 3, '0'),
    'test-ui-preview-provider',
    '{"display_name":"本地预览支付","environment":"test-ui"}'::jsonb,
    now() - make_interval(days => v.age_days), now()
FROM (VALUES
    (1, 'COMPLETED',          'balance',      'alipay',   100::numeric, 100::numeric, 0.006::numeric,   0::numeric,  1),
    (2, 'PENDING',            'subscription', 'wxpay',    168::numeric, 168::numeric, 0.006::numeric,   0::numeric,  0),
    (3, 'PAID',               'balance',      'stripe',    50::numeric,  51.45::numeric, 0.029::numeric, 0::numeric,  2),
    (4, 'FAILED',             'balance',      'easypay',   30::numeric,  30.36::numeric, 0.012::numeric, 0::numeric,  3),
    (5, 'REFUND_REQUESTED',   'subscription', 'alipay',   228::numeric, 228::numeric, 0.006::numeric, 228::numeric,  6),
    (6, 'PARTIALLY_REFUNDED', 'balance',      'airwallex',120::numeric, 123::numeric, 0.025::numeric,  30::numeric,  9),
    (7, 'REFUNDED',           'balance',      'wxpay',     80::numeric,  80::numeric, 0.006::numeric,  80::numeric, 12),
    (8, 'CANCELLED',          'subscription', 'stripe',   498::numeric, 512.44::numeric, 0.029::numeric, 0::numeric, 15)
) v(seq, status, order_type, payment_type, amount, pay_amount, fee_rate, refund_amount, age_days)
CROSS JOIN users u
JOIN LATERAL (
    SELECT id, group_id FROM subscription_plans
    WHERE product_name = CASE WHEN v.seq = 8 THEN 'TEST-UI-PLAN-GEMINI'
                              WHEN v.seq = 5 THEN 'TEST-UI-PLAN-ANTHROPIC'
                              ELSE 'TEST-UI-PLAN-OPENAI' END
    LIMIT 1
) sp ON true
WHERE u.email = 'test@test.com';

-- Four synthetic invitees and rebate ledger entries. Password hashes are copied
-- only to satisfy the local users schema; no credentials are documented or used.
INSERT INTO users (
    email, password_hash, role, balance, concurrency, status, username, notes,
    signup_source, created_at, updated_at
)
SELECT v.email, t.password_hash, 'user', v.balance, 5, 'active', v.username,
       'SUB2API_TEST_UI_PREVIEW_INVITEE', 'email',
       now() - make_interval(days => v.age_days), now()
FROM (VALUES
    ('test.ui.invitee.01@example.invalid', '林屿', 18.20::numeric, 3),
    ('test.ui.invitee.02@example.invalid', '周然', 42.80::numeric, 9),
    ('test.ui.invitee.03@example.invalid', '陈墨',  7.60::numeric, 18),
    ('test.ui.invitee.04@example.invalid', '许舟', 63.40::numeric, 27)
) v(email, username, balance, age_days)
CROSS JOIN users t
WHERE t.email = 'test@test.com';

INSERT INTO user_affiliates (
    user_id, aff_code, inviter_id, aff_count, aff_quota,
    aff_history_quota, aff_frozen_quota, created_at, updated_at
)
SELECT i.id, 'TESTUIINV' || lpad(row_number() OVER (ORDER BY i.id)::text, 2, '0'),
       t.id, 0, 0, 0, 0, i.created_at, now()
FROM users i
CROSS JOIN users t
WHERE i.notes = 'SUB2API_TEST_UI_PREVIEW_INVITEE'
  AND t.email = 'test@test.com';

INSERT INTO user_affiliates (
    user_id, aff_code, inviter_id, aff_count, aff_quota,
    aff_history_quota, aff_rebate_rate_percent, aff_code_custom,
    aff_frozen_quota, created_at, updated_at
)
SELECT id, 'TESTUIPREVIEW', NULL, 4, 26.80, 58.40, 12.60, true, 8.40,
       now() - interval '40 days', now()
FROM users WHERE email = 'test@test.com'
ON CONFLICT (user_id) DO UPDATE
SET aff_code = EXCLUDED.aff_code,
    aff_count = EXCLUDED.aff_count,
    aff_quota = EXCLUDED.aff_quota,
    aff_history_quota = EXCLUDED.aff_history_quota,
    aff_rebate_rate_percent = EXCLUDED.aff_rebate_rate_percent,
    aff_code_custom = EXCLUDED.aff_code_custom,
    aff_frozen_quota = EXCLUDED.aff_frozen_quota,
    updated_at = now();

INSERT INTO user_affiliate_ledger (
    user_id, action, amount, source_user_id, frozen_until,
    balance_after, aff_quota_after, aff_frozen_quota_after,
    aff_history_quota_after, created_at, updated_at
)
SELECT t.id, 'accrue', v.amount, i.id,
       CASE WHEN v.frozen THEN now() + interval '5 days' END,
       t.balance, 26.80, CASE WHEN v.frozen THEN 8.40 ELSE 0 END, 58.40,
       now() - make_interval(days => v.age_days), now()
FROM (VALUES
    ('test.ui.invitee.01@example.invalid',  5.60::numeric, false,  1),
    ('test.ui.invitee.01@example.invalid',  3.20::numeric, true,   0),
    ('test.ui.invitee.02@example.invalid', 12.40::numeric, false,  4),
    ('test.ui.invitee.02@example.invalid',  5.20::numeric, false, 11),
    ('test.ui.invitee.03@example.invalid',  4.80::numeric, true,   2),
    ('test.ui.invitee.04@example.invalid', 10.20::numeric, false,  8),
    ('test.ui.invitee.04@example.invalid',  7.00::numeric, false, 19)
) v(email, amount, frozen, age_days)
JOIN users i ON i.email = v.email
CROSS JOIN users t
WHERE t.email = 'test@test.com';

-- Batch image jobs cover running, completed, partial success and failed states.
INSERT INTO batch_image_jobs (
    batch_id, user_id, api_key_id, account_id, provider, model, status,
    provider_job_name, item_count, success_count, fail_count, cancelled_count,
    estimated_cost, hold_amount, actual_cost, currency, hold_id,
    idempotency_key, request_hash, manifest_hash, retry_count, version,
    output_expires_at, last_error_code, last_error_message,
    created_at, updated_at, submitted_at, started_at, finished_at, settled_at,
    base_unit_price, group_rate_multiplier, account_rate_multiplier,
    batch_discount_multiplier, hold_multiplier, billable_unit_price,
    hold_unit_price, pricing_snapshot_version, downloaded_at, task_name
)
SELECT
    v.batch_id, u.id, k.id, a.id, 'gemini_api', 'gemini-2.5-flash-image', v.status,
    'projects/test-ui/locations/global/jobs/' || v.seq::text,
    v.item_count, v.success_count, v.fail_count, v.cancelled_count,
    v.item_count * 0.018, v.item_count * 0.012,
    CASE WHEN v.status IN ('completed','failed','cancelled') THEN v.success_count * 0.018 END,
    'USD', 'TEST-UI-HOLD-' || v.seq::text,
    'TEST-UI-IDEMPOTENCY-' || v.seq::text,
    md5('test-ui-request-' || v.seq::text), md5('test-ui-manifest-' || v.seq::text),
    CASE WHEN v.status = 'failed' THEN 1 ELSE 0 END, 1,
    CASE WHEN v.status = 'completed' THEN now() + interval '14 days' END,
    CASE WHEN v.status = 'failed' THEN 'UPSTREAM_UNAVAILABLE' END,
    CASE WHEN v.status = 'failed' THEN '本地预览：上游任务暂时不可用' END,
    now() - make_interval(hours => v.age_hours), now(),
    now() - make_interval(hours => v.age_hours) + interval '2 minutes',
    now() - make_interval(hours => v.age_hours) + interval '4 minutes',
    CASE WHEN v.status IN ('completed','failed','cancelled') THEN now() - make_interval(hours => v.age_hours) + interval '18 minutes' END,
    CASE WHEN v.status IN ('completed','failed','cancelled') THEN now() - make_interval(hours => v.age_hours) + interval '20 minutes' END,
    0.04, 1.05, 0.78, 0.45, 0.55, 0.018, 0.012, 1,
    CASE WHEN v.downloaded THEN now() - interval '2 hours' END,
    v.task_name
FROM (VALUES
    (1, 'TEST-UI-BATCH-001', 'completed', 8, 8, 0, 0, 72, true,  '产品主视觉'),
    (2, 'TEST-UI-BATCH-002', 'completed', 8, 6, 2, 0, 28, false, '活动素材多版本'),
    (3, 'TEST-UI-BATCH-003', 'running',   12, 4, 0, 0,  1, false, '品牌场景生成'),
    (4, 'TEST-UI-BATCH-004', 'failed',     6, 0, 6, 0, 96, false, '失败任务示例')
) v(seq, batch_id, status, item_count, success_count, fail_count, cancelled_count,
    age_hours, downloaded, task_name)
CROSS JOIN users u
JOIN LATERAL (
    SELECT id FROM api_keys
    WHERE user_id = u.id AND key = 'sk-test-ui-preview-gemini-not-valid'
    LIMIT 1
) k ON true
JOIN LATERAL (
    SELECT id FROM accounts
    WHERE notes = 'SUB2API_UI_DEMO' AND platform = 'gemini' AND status = 'active'
    ORDER BY id LIMIT 1
) a ON true
WHERE u.email = 'test@test.com';

INSERT INTO batch_image_items (
    job_id, custom_id, status, request_hash, prompt_preview,
    provider_source_object, source_line_number, source_byte_offset,
    source_byte_length, mime_type, file_extension, image_count,
    error_code, error_message, billed_amount, created_at, indexed_at
)
SELECT
    j.batch_id,
    lower(replace(j.batch_id, 'TEST-UI-BATCH-', 'item-')) || '-' || lpad(n::text, 2, '0'),
    CASE
        WHEN j.status = 'running' THEN 'pending'
        WHEN j.status = 'failed' THEN 'failed'
        WHEN n <= j.success_count THEN 'success'
        ELSE 'failed'
    END,
    md5(j.batch_id || '-' || n::text),
    (ARRAY['企业蓝色产品发布主视觉','现代办公空间与柔和蓝光','简洁 SaaS 数据看板插画','抽象科技背景与留白'])[1 + ((n - 1) % 4)],
    'gs://test-ui-preview.invalid/' || j.batch_id || '/result.jsonl',
    n, (n - 1) * 512, 512,
    CASE WHEN n <= j.success_count THEN 'image/png' END,
    CASE WHEN n <= j.success_count THEN 'png' END,
    CASE WHEN n <= j.success_count THEN 1 ELSE 0 END,
    CASE WHEN n > j.success_count AND j.status <> 'running' THEN 'CONTENT_FILTERED' END,
    CASE WHEN n > j.success_count AND j.status <> 'running' THEN '本地预览：该条目未生成图片' END,
    CASE WHEN n <= j.success_count THEN 0.018 END,
    j.created_at + make_interval(secs => n * 8),
    CASE WHEN j.status <> 'running' THEN j.finished_at END
FROM batch_image_jobs j
CROSS JOIN LATERAL generate_series(1, j.item_count) n
WHERE j.batch_id LIKE 'TEST-UI-BATCH-%';

INSERT INTO batch_image_events (job_id, event_type, payload, event_hash, created_at)
SELECT j.batch_id, e.event_type,
       jsonb_build_object('status', j.status, 'source', 'SUB2API_TEST_UI_PREVIEW'),
       md5(j.batch_id || '-' || e.event_type),
       j.created_at + e.offset_time
FROM batch_image_jobs j
CROSS JOIN (VALUES
    ('created', interval '0 minutes'),
    ('submitted', interval '2 minutes'),
    ('status_updated', interval '10 minutes')
) e(event_type, offset_time)
WHERE j.batch_id LIKE 'TEST-UI-BATCH-%';

-- Enabled public monitor fixtures. The endpoint and encrypted credential are
-- non-routable placeholders; history rows are the only data used for preview.
INSERT INTO channel_monitors (
    name, provider, endpoint, api_key_encrypted, primary_model, extra_models,
    group_name, enabled, interval_seconds, last_checked_at, created_by,
    created_at, updated_at, extra_headers, body_override_mode, api_mode,
    jitter_seconds
)
SELECT v.name, v.provider, 'https://preview.invalid',
       'SUB2API_TEST_UI_PREVIEW_NON_ROUTABLE', v.primary_model, v.extra_models::jsonb,
       '本地预览', true, 3600, now() - interval '2 minutes', a.id,
       now() - interval '30 days', now(), '{}'::jsonb, 'off', v.api_mode, 0
FROM (VALUES
    ('TEST-UI-MONITOR-OpenAI', 'openai', 'gpt-5.4', '["gpt-4.1","o4-mini"]', 'responses'),
    ('TEST-UI-MONITOR-Anthropic', 'anthropic', 'claude-sonnet-4-5', '["claude-opus-4-1"]', 'chat_completions'),
    ('TEST-UI-MONITOR-Gemini', 'gemini', 'gemini-2.5-pro', '["gemini-2.5-flash"]', 'chat_completions')
) v(name, provider, primary_model, extra_models, api_mode)
CROSS JOIN LATERAL (SELECT id FROM users WHERE email = 'admin@admin.com' LIMIT 1) a;

INSERT INTO channel_monitor_histories (
    monitor_id, model, status, latency_ms, ping_latency_ms, message, checked_at
)
SELECT m.id, model_name,
       CASE
           WHEN n = 0 AND m.provider = 'openai' THEN 'operational'
           WHEN n = 0 AND m.provider = 'anthropic' THEN 'degraded'
           WHEN n = 0 AND m.provider = 'gemini' THEN 'failed'
           WHEN n % 19 = 0 THEN 'failed'
           WHEN n % 11 = 0 THEN 'degraded'
           ELSE 'operational'
       END,
       CASE WHEN (n = 0 AND m.provider = 'gemini') OR (n > 0 AND n % 19 = 0)
            THEN NULL ELSE 420 + (n * 67 + m.id * 31) % 1800 END,
       45 + (n * 13 + m.id * 7) % 180,
       CASE WHEN n = 0 AND m.provider = 'gemini' THEN '本地预览：请求超时'
            WHEN n = 0 AND m.provider = 'anthropic' THEN '本地预览：延迟升高'
            WHEN n > 0 AND n % 19 = 0 THEN '本地预览：请求超时'
            WHEN n % 11 = 0 THEN '本地预览：延迟升高'
            ELSE '' END,
       now() - make_interval(hours => n * 6)
FROM channel_monitors m
CROSS JOIN LATERAL jsonb_array_elements_text(
    to_jsonb(ARRAY[m.primary_model]) || m.extra_models
) models(model_name)
CROSS JOIN generate_series(0, 27) n
WHERE m.name LIKE 'TEST-UI-MONITOR-%';

INSERT INTO channel_monitor_daily_rollups (
    monitor_id, model, bucket_date, total_checks, ok_count, operational_count,
    degraded_count, failed_count, error_count, sum_latency_ms, count_latency,
    sum_ping_latency_ms, count_ping_latency, computed_at
)
SELECT m.id, model_name, current_date - d,
       24, 22, 20, 2, CASE WHEN d % 5 = 0 THEN 1 ELSE 0 END, 0,
       24 * (620 + d * 8), 24, 24 * (72 + d), 24, now()
FROM channel_monitors m
CROSS JOIN LATERAL jsonb_array_elements_text(
    to_jsonb(ARRAY[m.primary_model]) || m.extra_models
) models(model_name)
CROSS JOIN generate_series(1, 30) d
WHERE m.name LIKE 'TEST-UI-MONITOR-%';

-- Provider shells are deliberately credential-free. They make checkout method
-- selection and summaries visible, but cannot submit a real payment.
INSERT INTO payment_provider_instances (
    provider_key, name, config, supported_types, enabled, payment_mode,
    sort_order, limits, refund_enabled, allow_user_refund, created_at, updated_at
)
VALUES
    (
        'easypay', 'TEST-UI-PAYMENT-支付宝与微信', '{}', 'alipay,wxpay', true,
        'qrcode', 10,
        '{"alipay":{"single_min":10,"single_max":5000,"daily_limit":10000},"wxpay":{"single_min":10,"single_max":3000,"daily_limit":8000}}',
        false, false, now(), now()
    ),
    (
        'stripe', 'TEST-UI-PAYMENT-Stripe', '{"currency":"USD"}', 'card', true,
        'redirect', 20,
        '{"stripe":{"single_min":5,"single_max":2000,"daily_limit":5000}}',
        false, false, now(), now()
    ),
    (
        'airwallex', 'TEST-UI-PAYMENT-Airwallex', '{"currency":"USD"}', 'airwallex', true,
        'redirect', 30,
        '{"airwallex":{"single_min":5,"single_max":2000,"daily_limit":5000}}',
        false, false, now(), now()
    );

-- Local feature visibility only. No payment credentials or provider secrets are
-- introduced; checkout remains disabled at the provider level.
INSERT INTO settings (key, value, updated_at)
VALUES
    ('payment_enabled', 'true', now()),
    ('affiliate_enabled', 'true', now()),
    ('available_channels_enabled', 'true', now()),
    ('channel_monitor_enabled', 'true', now()),
    ('allow_user_view_error_requests', 'true', now()),
    ('payment_visible_method_alipay_enabled', 'true', now()),
    ('payment_visible_method_alipay_source', 'easypay_alipay', now()),
    ('payment_visible_method_wxpay_enabled', 'true', now()),
    ('payment_visible_method_wxpay_source', 'easypay_wxpay', now()),
    ('ENABLED_PAYMENT_TYPES', 'alipay,wxpay,stripe,airwallex', now())
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

COMMIT;

-- Compact execution report for idempotency checks.
WITH test_user AS (SELECT id FROM users WHERE email = 'test@test.com')
SELECT 'api_keys' AS entity, count(*) AS rows
FROM api_keys, test_user WHERE user_id = test_user.id AND key LIKE 'sk-test-ui-preview-%'
UNION ALL SELECT 'usage_logs', count(*) FROM usage_logs, test_user
  WHERE user_id = test_user.id AND request_id LIKE 'TEST-UI-USAGE-%'
UNION ALL SELECT 'failed_requests', count(*) FROM ops_error_logs, test_user
  WHERE user_id = test_user.id AND request_id LIKE 'TEST-UI-ERROR-%'
UNION ALL SELECT 'subscriptions', count(*) FROM user_subscriptions, test_user
  WHERE user_id = test_user.id AND notes = 'SUB2API_TEST_UI_PREVIEW'
UNION ALL SELECT 'redeem_codes', count(*) FROM redeem_codes, test_user
  WHERE used_by = test_user.id AND code LIKE 'TEST-UI-%'
UNION ALL SELECT 'payment_orders', count(*) FROM payment_orders, test_user
  WHERE user_id = test_user.id AND out_trade_no LIKE 'TEST-UI-ORDER-%'
UNION ALL SELECT 'affiliate_invitees', count(*) FROM user_affiliates, test_user
  WHERE inviter_id = test_user.id
UNION ALL SELECT 'affiliate_ledger', count(*) FROM user_affiliate_ledger, test_user
  WHERE user_id = test_user.id
UNION ALL SELECT 'batch_jobs', count(*) FROM batch_image_jobs, test_user
  WHERE user_id = test_user.id AND batch_id LIKE 'TEST-UI-BATCH-%'
UNION ALL SELECT 'channel_monitors', count(*) FROM channel_monitors
  WHERE name LIKE 'TEST-UI-MONITOR-%'
UNION ALL SELECT 'monitor_history', count(*) FROM channel_monitor_histories
  WHERE monitor_id IN (SELECT id FROM channel_monitors WHERE name LIKE 'TEST-UI-MONITOR-%')
UNION ALL SELECT 'payment_providers', count(*) FROM payment_provider_instances
  WHERE name LIKE 'TEST-UI-PAYMENT-%'
ORDER BY entity;
