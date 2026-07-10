import { NextRequest, NextResponse } from 'next/server'
import { decodeJwt } from 'jose'
import {
  getScalekitClient, getRedirectUri,
  USER_ROLE_MAP, SCALEKIT_ROLE_MAP, ROLE_PERMISSIONS,
} from '@/lib/scalekit'
import { setSession } from '@/lib/cookies'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`http://localhost:3001`)
  }

  try {
    const client = getScalekitClient()
    const authResponse = await client.authenticateWithCode(code, getRedirectUri())

    // Decode tokens to extract claims
    const idClaims = decodeJwt(authResponse.idToken)
    const accessClaims = decodeJwt(authResponse.accessToken)

    // Extract roles from token claims
    const roles: string[] = (
      (idClaims.roles as string[]) ??
      (accessClaims.roles as string[]) ??
      []
    )

    // Extract permissions
    const permissions: string[] = (
      (accessClaims.permissions as string[]) ??
      (accessClaims['https://scalekit.com/permissions'] as string[]) ??
      []
    )

    // Resolve display name
    const email = (authResponse.user?.email ?? idClaims.email ?? '') as string
    const givenName = (authResponse.user?.givenName ?? idClaims.given_name ?? '') as string
    const familyName = (authResponse.user?.familyName ?? idClaims.family_name ?? '') as string
    const fullName = [givenName, familyName].filter(Boolean).join(' ')
    const name = (authResponse.user?.name as string)
      ?? (idClaims.name as string)
      ?? (fullName || email.split('@')[0])

    // Token expiry — decode exp from access token
    const expiresAt = (accessClaims.exp as number) ?? Math.floor(Date.now() / 1000) + 3600
    const expiresIn = expiresAt - Math.floor(Date.now() / 1000)

    // Resolve HealthFlow role: email map first, then ScaleKit roles
    let hfRole = 'doctor'
    let hfPort = 3003
    let hfName = name

    const emailLower = email.toLowerCase()
    if (USER_ROLE_MAP[emailLower]) {
      hfRole = USER_ROLE_MAP[emailLower].role
      hfPort = USER_ROLE_MAP[emailLower].port
      hfName = USER_ROLE_MAP[emailLower].name
    } else {
      for (const r of roles) {
        const mapped = SCALEKIT_ROLE_MAP[r.toLowerCase()]
        if (mapped) { hfRole = mapped.role; hfPort = mapped.port; break }
      }
    }

    const hfPermissions = [...new Set([...permissions, ...(ROLE_PERMISSIONS[hfRole] ?? [])])]

    const sessionData = {
      user: {
        sub: (idClaims.sub ?? authResponse.user?.id ?? email) as string,
        email,
        name: hfName,
        given_name: givenName,
        family_name: familyName,
      },
      tokens: {
        access_token: authResponse.accessToken,
        refresh_token: authResponse.refreshToken ?? '',
        id_token: authResponse.idToken,
        expires_at: expiresAt,
        expires_in: expiresIn,
      },
      roles,
      permissions: hfPermissions,
      hfRole,
      hfPort,
    }

    // Set session cookie directly on the redirect response
    const response = NextResponse.redirect(`http://localhost:${hfPort}`)
    response.cookies.set('scalekit_session', JSON.stringify(sessionData), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    })
    // Clear the state cookie
    response.cookies.delete('oauth_state')
    return response
  } catch (err) {
    console.error('ScaleKit callback error:', err)
    return NextResponse.redirect(`http://localhost:3001`)
  }
}
