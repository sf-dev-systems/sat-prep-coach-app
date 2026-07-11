import { NextResponse, type NextRequest } from 'next/server';
// Edge-safe entry point — see lib/db/edge.ts's doc comment. Do not switch
// this back to './lib/db': that file imports @supabase/supabase-js, which
// isn't Edge Runtime-safe and reintroduces the process.version warning.
import { getSupabaseServerClient } from './lib/db/edge';

// Paths reachable without an authenticated session. /api/cron is included
// because cron requests (Vercel Cron, or a manual test call) carry no
// session cookies at all — the actual security gate for that path is the
// CRON_SECRET bearer-token check inside app/api/cron/*/route.ts itself, not
// this middleware. See that route's doc comment for why this is the one
// deliberate exception to session-derived identity in this app.
const PUBLIC_PATHS = ['/login', '/api/cron'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = getSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as any));
    },
  });

  // Refreshes the session token if expired — required on every request per
  // the @supabase/ssr middleware contract, otherwise sessions silently die.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets, image optimization, and PWA files; run on everything else.
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
