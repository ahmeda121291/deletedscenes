import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Create a darkroom session ("New scene"), or — given a piece_id — return
 * that piece's existing session so Edit always lands somewhere. */
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  let pieceId: string | null = null;
  try {
    const body = await request.json();
    if (typeof body.piece_id === "string") pieceId = body.piece_id;
  } catch {
    // empty body is fine — plain "New scene"
  }

  if (pieceId) {
    const { data: existing } = await supabase
      .from("darkroom_sessions")
      .select("id")
      .eq("piece_id", pieceId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json(existing);
  }

  const { data, error } = await supabase
    .from("darkroom_sessions")
    .insert({ piece_id: pieceId })
    .select("id")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}
