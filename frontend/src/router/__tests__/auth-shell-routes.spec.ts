import { describe, expect, it } from 'vitest'

import router from '@/router'

type AuthRouteExpectation = {
  path: string
  name: string
  title: string
  titleKey?: string
}

const authRoutes: AuthRouteExpectation[] = [
  { path: '/login', name: 'Login', title: 'Login', titleKey: 'home.login' },
  { path: '/register', name: 'Register', title: 'Register', titleKey: 'auth.createAccount' },
  { path: '/email-verify', name: 'EmailVerify', title: 'Verify Email' },
  { path: '/auth/callback', name: 'OAuthCallback', title: 'OAuth Callback', titleKey: 'auth.oauthCallbackPageTitle' },
  { path: '/auth/oauth/callback', name: 'OAuthCallback', title: 'OAuth Callback', titleKey: 'auth.oauthCallbackPageTitle' },
  { path: '/auth/linuxdo/callback', name: 'LinuxDoOAuthCallback', title: 'LinuxDo OAuth Callback', titleKey: 'auth.linuxdoCallbackPageTitle' },
  { path: '/auth/wechat/callback', name: 'WeChatOAuthCallback', title: 'WeChat OAuth Callback', titleKey: 'auth.wechatCallbackPageTitle' },
  { path: '/auth/wechat/payment/callback', name: 'WeChatPaymentOAuthCallback', title: 'WeChat Payment Callback', titleKey: 'auth.wechatPaymentCallbackPageTitle' },
  { path: '/auth/dingtalk/callback', name: 'DingTalkOAuthCallback', title: 'DingTalk OAuth Callback', titleKey: 'auth.dingtalkCallbackPageTitle' },
  { path: '/auth/dingtalk/email-completion', name: 'dingtalk-email-completion', title: 'DingTalk Email Completion' },
  { path: '/auth/oidc/callback', name: 'OIDCOAuthCallback', title: 'OIDC OAuth Callback', titleKey: 'auth.oidcCallbackPageTitle' },
  { path: '/forgot-password', name: 'ForgotPassword', title: 'Forgot Password', titleKey: 'auth.forgotPasswordTitle' },
  { path: '/reset-password', name: 'ResetPassword', title: 'Reset Password' },
]

describe('authentication shell routes', () => {
  it.each(authRoutes)('keeps $path inside the persistent authentication shell', (expected) => {
    const resolved = router.resolve(expected.path)

    expect(resolved.path).toBe(expected.path)
    expect(resolved.name).toBe(expected.name)
    expect(resolved.meta.requiresAuth).toBe(false)
    expect(resolved.meta.title).toBe(expected.title)
    expect(resolved.meta.titleKey).toBe(expected.titleKey)
    expect(resolved.matched[0]?.path).toBe('/auth-entry')
    expect(resolved.matched.at(-1)?.name).toBe(expected.name)
  })

  it('keeps the authentication entry redirect pointed at login', () => {
    const shell = router.getRoutes().find((record) => record.path === '/auth-entry')

    expect(shell?.redirect).toBe('/login')
  })
})
