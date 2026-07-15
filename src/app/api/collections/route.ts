import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { requireOwner } from "@/lib/auth";
import { slugify } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("collections")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const row = {
    name,
    slug: slugify(name),
    description:
      typeof body.description === "string" ? body.description : null,
    sort_order: nextOrder,
  };

  let { data, error } = await supabase
    .from("collections")
    .insert(row)
    .select()
    .single();
  if (error?.code === "23505") {
    ({ data, error } = await supabase
      .from("collections")
      .insert({ ...row, slug: `${row.slug}-${nanoid(4)}` })
      .select()
      .single());
  }
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}
