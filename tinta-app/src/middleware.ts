import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated — redirect to /login for any protected route
  if (!user) {
    const isProtected =
      pathname.startsWith('/mahasiswa') || pathname.startsWith('/dosen')
    if (isProtected) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // Fetch the user's role from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // Mahasiswa trying to access /dosen routes
  if (pathname.startsWith('/dosen') && role !== 'dosen') {
    return NextResponse.redirect(new URL('/mahasiswa/dashboard', request.url))
  }

  // Dosen trying to access /mahasiswa routes
  if (pathname.startsWith('/mahasiswa') && role !== 'mahasiswa') {
    return NextResponse.redirect(new URL('/dosen/dashboard', request.url))
  }

  // Authenticated user visiting /login or /register — send to their dashboard
  if (pathname === '/login' || pathname === '/register') {
    const destination =
      role === 'dosen' ? '/dosen/dashboard' : '/mahasiswa/dashboard'
    return NextResponse.redirect(new URL(destination, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
