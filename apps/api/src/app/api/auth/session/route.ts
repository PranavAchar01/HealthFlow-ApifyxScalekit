import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/cookies'

const ALLOWED_ORIGINS = [
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3004',
  'http://localhost:3005',
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin')
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ session: null }, { status: 401, headers: corsHeaders(origin) })
  }

  return NextResponse.json({
    session: {
      userId: session.user.sub,
      email: session.user.email,
      name: session.user.name,
      role: session.hfRole,
      permissions: session.permissions ?? [],
    }
  }, { headers: corsHeaders(origin) })
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { headers: corsHeaders(req.headers.get('origin')) })
}
