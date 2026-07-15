import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.caption === "string" || body.caption === null)
    update.caption = body.caption;
  if (typeof body.sort_order === "number") update.sort_order = body.sort_order;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("media")
    .update(update)
    .eq("id", id)
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

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  const { data: row } = await supabase
    .from("media")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (row) {
    await supabase.storage.from("media").remove([row.storage_path]);
  }
  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
