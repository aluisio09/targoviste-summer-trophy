import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect all /admin/* routes except the login page itself
  if (pathname.startsWith('/admin') && pathname !== '/admin') {
    const token = request.cookies.get('admin_token')?.value
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
