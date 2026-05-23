import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.SCALEKIT_CLIENT_SECRET ?? 'healthflow-dev-secret'
)

export interface SessionPayload {
  userId: string
  email: string
  name: string
  role: string
  permissions: string[]
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
