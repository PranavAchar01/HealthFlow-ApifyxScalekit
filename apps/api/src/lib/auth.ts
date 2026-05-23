import { getSession } from './cookies'

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
