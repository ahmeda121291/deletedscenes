import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Server-side owner check for API routes. The proxy already gates these
 * paths, but mutations never trust the client — verify again here.
 * RLS remains the final word regardless. */
export async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supabase,
      user: null,
      unauthorized: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { supabase, user, unauthorized: null };
}
