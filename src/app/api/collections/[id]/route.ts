import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { slugify } from "@/lib/text";

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
  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
    if (body.keep_slug !== true) update.slug = slugify(body.name);
  }
  if (typeof body.slug === "string" && body.slug.trim())
    update.slug = slugify(body.slug);
  if (typeof body.description === "string" || body.description === null)
    update.description = body.description;
  if (typeof body.sort_order === "number")
    update.sort_order = body.sort_order;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("collections")
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

/** Delete only when empty. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  const { count } = await supabase
    .from("pieces")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "collection is not empty" },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
