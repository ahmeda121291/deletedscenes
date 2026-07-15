import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Edit epigraph / about copy without a deploy. */
export async function PATCH(request: NextRequest) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const update: Record<string, unknown> = { id: 1 };
  if (typeof body.epigraph === "string") update.epigraph = body.epigraph;
  if (typeof body.about_md === "string") update.about_md = body.about_md;

  const { data, error } = await supabase
    .from("site_settings")
    .upsert(update)
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "update failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}
