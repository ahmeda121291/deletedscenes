import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-aware server client. Anonymous for visitors; carries the owner's
 * session in the Darkroom. RLS does the actual gatekeeping. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — session refresh is handled
            // by the proxy, so this can be safely ignored.
          }
        },
      },
    }
  );
}
