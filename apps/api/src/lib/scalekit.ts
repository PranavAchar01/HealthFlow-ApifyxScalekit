import { ScalekitClient } from '@scalekit-sdk/node'

let _client: ScalekitClient | null = null

export function getScalekitClient(): ScalekitClient {
  if (!_client) {
    const envUrl = process.env.SCALEKIT_ENV_URL
    const clientId = process.env.SCALEKIT_CLIENT_ID
    const clientSecret = process.env.SCALEKIT_CLIENT_SECRET
    if (!envUrl || !clientId || !clientSecret) {
      throw new Error('Missing SCALEKIT_ENV_URL, SCALEKIT_CLIENT_ID, or SCALEKIT_CLIENT_SECRET')
    }
    _client = new ScalekitClient(envUrl, clientId, clientSecret)
  }
  return _client
}

export function getRedirectUri(): string {
  return process.env.SCALEKIT_REDIRECT_URI ?? 'http://localhost:3001/auth/callback'
}

export function getDefaultScopes(): string[] {
  const raw = process.env.SCALEKIT_SCOPES ?? 'openid profile email offline_access'
  return raw.split(' ').filter(Boolean)
}

// HealthFlow role routing table
export const USER_ROLE_MAP: Record<string, { role: string; port: number; name: string }> = {
  'achar.pranav@gmail.com':    { role: 'doctor',     port: 3003, name: 'Pranav' },
  'shanaygaitonde@gmail.com':  { role: 'dispatcher', port: 3005, name: 'Shanay' },
  'nithin.alaska@gmail.com':   { role: 'paramedic',  port: 3002, name: 'Nithin' },
  'sahielbose@gmail.com':      { role: 'nurse',      port: 3004, name: 'Sahiel' },
}

// ScaleKit role → HealthFlow role fallback
export const SCALEKIT_ROLE_MAP: Record<string, { role: string; port: number }> = {
  admin:      { role: 'doctor',     port: 3003 },
  doctor:     { role: 'doctor',     port: 3003 },
  physician:  { role: 'doctor',     port: 3003 },
  dispatcher: { role: 'dispatcher', port: 3005 },
  paramedic:  { role: 'paramedic',  port: 3002 },
  nurse:      { role: 'nurse',      port: 3004 },
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  dispatcher: ['view_encounters', 'launch_pipeline'],
  paramedic:  ['field_data_entry', 'view_own_encounters'],
  nurse:      ['view_encounters', 'nursing_notes', 'triage', 'escalate'],
  doctor:     ['cpoe', 'view_encounters', 'approve_orders', 'ehr_write'],
}
