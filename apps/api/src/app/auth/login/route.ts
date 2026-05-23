import { NextResponse } from 'next/server'
import { getScalekitClient, getRedirectUri, getDefaultScopes } from '@/lib/scalekit'

export async function GET() {
  const authUrl = getScalekitClient().getAuthorizationUrl(getRedirectUri(), {
    scopes: getDefaultScopes(),
  })
  return NextResponse.redirect(authUrl)
}
