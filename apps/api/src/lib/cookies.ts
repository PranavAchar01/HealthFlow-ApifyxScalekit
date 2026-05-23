import { cookies } from 'next/headers'

const SESSION_COOKIE = 'scalekit_session'
const STATE_COOKIE = 'oauth_state'

export interface SessionTokens {
  access_token: string
  refresh_token: string
  id_token: string
  expires_at: number
  expires_in: number
}

export interface SessionUser {
  sub: string
  email: string
  name: string
  given_name?: string
  family_name?: string
  preferred_username?: string
}

export interface SessionData {
  user: SessionUser
  tokens: SessionTokens
  roles?: string[]
  permissions?: string[]
  hfRole?: string      // HealthFlow role (doctor/nurse/paramedic/dispatcher)
  hfPort?: number      // target app port
}

const isProduction = process.env.NODE_ENV === 'production'

export async function getSession(): Promise<SessionData | null> {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (!raw) return null
  try { return JSON.parse(raw) as SessionData } catch { return null }
}

export async function setSession(data: SessionData): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: new Date(data.tokens.expires_at * 1000),
  })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

export async function getOAuthState(): Promise<string | null> {
  const store = await cookies()
  return store.get(STATE_COOKIE)?.value ?? null
}

export async function setOAuthState(state: string): Promise<void> {
  const store = await cookies()
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 min
  })
}

export async function clearOAuthState(): Promise<void> {
  const store = await cookies()
  store.delete(STATE_COOKIE)
}

export function isTokenExpired(session: SessionData): boolean {
  return session.tokens.expires_at * 1000 < Date.now() + 5 * 60 * 1000
}
