import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Service-role client. Server-only — used by export, the upload pipeline
 * and the view RPC. NEVER import this from a client component. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
