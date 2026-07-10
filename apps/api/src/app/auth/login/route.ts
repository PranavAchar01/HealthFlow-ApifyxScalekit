import { NextResponse } from 'next/server'
import { getScalekitClient, getRedirectUri, getDefaultScopes } from '@/lib/scalekit'

export async function GET() {
  const authUrl = getScalekitClient().getAuthorizationUrl(getRedirectUri(), {
    scopes: getDefaultScopes(),
  })

  // Force the login form even when Scalekit has an active SSO session
  const url = new URL(authUrl)
  url.searchParams.set('prompt', 'login')
  return NextResponse.redirect(url.toString())
}
