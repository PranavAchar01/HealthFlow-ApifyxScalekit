import { getSession } from './cookies'

type AuthToken = {
  userId: string; name: string; role: string;
  permissions: string[]; issuedAt: string; expiresAt: string;
};

const DEMO_USERS: Record<string, AuthToken> = {
  paramedic_sarah: { userId: "pm-001", name: "Sarah Mitchell", role: "paramedic", permissions: ["field_data_entry", "view_encounters"], issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 8*60*60*1000).toISOString() },
  dr_chen:         { userId: "dr-001", name: "Dr. James Chen",  role: "physician", permissions: ["cpoe", "view_encounters", "approve_orders", "ehr_write"], issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 12*60*60*1000).toISOString() },
  nurse_rodriguez: { userId: "rn-001", name: "Maria Rodriguez, RN", role: "nurse", permissions: ["view_encounters", "nursing_notes", "triage", "escalate"], issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 12*60*60*1000).toISOString() },
  admin_ops:       { userId: "admin-001", name: "Admin Operations", role: "admin", permissions: ["view_encounters", "view_audit", "manage_users"], issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 4*60*60*1000).toISOString() },
};

export function validateToken(authHeader: string | null): AuthToken | null {
  if (!authHeader) return null;
  return DEMO_USERS[authHeader.replace("Bearer ", "")] ?? null;
}

export function requirePermission(token: AuthToken, permission: string): boolean {
  return token.permissions.includes(permission);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

export async function getCurrentUser() {
  const session = await getSession()
  return session?.user ?? null
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  return session?.tokens.access_token ?? null
}

export async function hasPermission(permission: string): Promise<boolean> {
  const session = await getSession()
  return session?.permissions?.includes(permission) ?? false
}

export async function getAvailableUsers() {
  return [
    { email: 'shanaygaitonde@gmail.com', role: 'dispatcher', name: 'Shanay', port: 3005 },
    { email: 'nithin.alaska@gmail.com',  role: 'paramedic',  name: 'Nithin', port: 3002 },
    { email: 'sahielbose@gmail.com',     role: 'nurse',      name: 'Sahiel', port: 3004 },
    { email: 'achar.pranav@gmail.com', role: 'doctor',     name: 'Pranav', port: 3003 },
  ]
}
