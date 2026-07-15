import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate. No session → /darkroom/* redirects home and protected API
 * routes return 401. Every mutation route ALSO verifies the session
 * server-side; this is the outer wall, RLS is the inner one.
 */

const PROTECTED_API_PREFIXES = [
  "/api/develop",
  "/api/upload",
  "/api/export",
  "/api/tmdb",
  "/api/pieces",
  "/api/collections",
  "/api/sessions",
  "/api/settings",
  "/api/media",
];

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (!user) {
    if (path.startsWith("/darkroom")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (PROTECTED_API_PREFIXES.some((p) => path.startsWith(p))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/darkroom/:path*",
    "/api/develop/:path*",
    "/api/develop",
    "/api/upload",
    "/api/export",
    "/api/tmdb/:path*",
    "/api/pieces/:path*",
    "/api/pieces",
    "/api/collections/:path*",
    "/api/collections",
    "/api/sessions/:path*",
    "/api/sessions",
    "/api/settings",
    "/api/media/:path*",
    "/api/media",
  ],
};
