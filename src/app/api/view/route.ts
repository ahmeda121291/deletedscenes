import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Light in-memory rate limit per IP (per serverless instance). */
const hits = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 30;
const WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "slow down" }, { status: 429 });
  }

  let slug: unknown;
  try {
    ({ slug } = await request.json());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (typeof slug !== "string" || !slug || slug.length > 200) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // anon client — increment_view is security definer and only touches
  // published/unlisted rows
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  await supabase.rpc("increment_view", { piece_slug: slug });

  return new Response(null, { status: 204 });
}
