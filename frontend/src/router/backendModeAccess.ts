const EXACT_ALLOWED_PATHS = [
  '/login',
  '/key-usage',
  '/setup',
  '/payment/result',
  '/payment/airwallex',
]

const ALLOWED_PATH_PREFIXES = ['/legal/']

const CALLBACK_PATHS = [
  '/auth/callback',
  '/auth/linuxdo/callback',
  '/auth/dingtalk/callback',
  '/auth/dingtalk/email-completion',
  '/auth/oidc/callback',
  '/auth/wechat/callback',
  '/auth/wechat/payment/callback',
]

const PENDING_AUTH_PATHS = ['/register', '/email-verify']

export function isBackendModePublicRouteAllowed(
  path: string,
  hasPendingAuthSession: boolean,
): boolean {
  if (
    EXACT_ALLOWED_PATHS.includes(path)
    || ALLOWED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return true
  }

  if (CALLBACK_PATHS.includes(path)) {
    return true
  }

  return hasPendingAuthSession && PENDING_AUTH_PATHS.includes(path)
}
