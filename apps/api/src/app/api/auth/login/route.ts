import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getScalekitClient, getRedirectUri, getDefaultScopes } from '@/lib/scalekit'

export async function GET() {
  const state = randomBytes(32).toString('base64url')

  const authUrl = getScalekitClient().getAuthorizationUrl(getRedirectUri(), {
    state,
    scopes: getDefaultScopes(),
    prompt: 'login',  // always show ScaleKit login, never silent SSO re-auth
  })

  // Set cookie directly on the response — next/headers cookies().set() is unreliable
  // in JSON-returning route handlers in Next.js 15
  const res = NextResponse.json({ authUrl })
  res.cookies.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',  // must be lax, not strict — ScaleKit redirect is cross-site
    path: '/',
    maxAge: 60 * 10,
  })
  return res
}
