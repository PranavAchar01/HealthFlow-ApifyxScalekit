import { NextRequest, NextResponse } from 'next/server'

const REQUIRED_ROLE = 'dispatcher'
const LOGIN = 'http://localhost:3001'

export async function middleware(req: NextRequest) {
  const raw = req.cookies.get('scalekit_session')?.value
  if (!raw) return NextResponse.redirect(LOGIN)

  try {
    const session = JSON.parse(raw)
    if (session?.hfRole !== REQUIRED_ROLE) {
      return NextResponse.redirect(LOGIN + '?error=forbidden')
    }
    // Reject expired sessions
    if (session?.tokens?.expires_at && session.tokens.expires_at * 1000 < Date.now()) {
      const res = NextResponse.redirect(LOGIN + '?error=expired')
      res.cookies.delete('scalekit_session')
      return res
    }
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(LOGIN)
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
