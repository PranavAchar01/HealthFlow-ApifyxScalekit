import { NextRequest, NextResponse } from 'next/server'

function clearSessionCookie(res: NextResponse) {
  res.cookies.set('scalekit_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function GET(_req: NextRequest) {
  const res = NextResponse.redirect('http://localhost:3001/login')
  clearSessionCookie(res)
  return res
}

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ logoutUrl: 'http://localhost:3001/login' })
  clearSessionCookie(res)
  return res
}
