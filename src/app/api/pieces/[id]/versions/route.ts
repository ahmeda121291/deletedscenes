import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  const { data, error } = await supabase
    .from("piece_versions")
    .select("id, piece_id, developed_content, created_at")
    .eq("piece_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
