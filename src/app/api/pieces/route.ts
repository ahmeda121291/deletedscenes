import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { requireOwner } from "@/lib/auth";
import { countWords, slugify } from "@/lib/text";
import type { PieceStatus, PieceType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: PieceType[] = ["essay", "story", "movie", "misc"];
const STATUSES: PieceStatus[] = ["draft", "unlisted", "published"];

/** Create a piece (draft by default). Optionally links a darkroom session. */
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "untitled";
  const type = TYPES.includes(body.type as PieceType)
    ? (body.type as PieceType)
    : "essay";
  const status = STATUSES.includes(body.status as PieceStatus)
    ? (body.status as PieceStatus)
    : "draft";
  const developed =
    typeof body.developed_content === "string" ? body.developed_content : null;

  let slug =
    typeof body.slug === "string" && body.slug.trim()
      ? slugify(body.slug)
      : slugify(title);
  // unlisted pieces get an unguessable suffix
  if (status === "unlisted") slug = `${slug}-${nanoid(6)}`;

  const row = {
    title,
    slug,
    type,
    status,
    collection_id:
      typeof body.collection_id === "string" ? body.collection_id : null,
    raw_content:
      typeof body.raw_content === "string" ? body.raw_content : null,
    developed_content: developed,
    excerpt: typeof body.excerpt === "string" ? body.excerpt.slice(0, 140) : null,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    show_raw: body.show_raw === true,
    word_count: developed ? countWords(developed) : 0,
    published_at: status === "published" ? new Date().toISOString() : null,
  };

  let { data, error } = await supabase
    .from("pieces")
    .insert(row)
    .select()
    .single();

  // slug collision → retry once with a suffix
  if (error?.code === "23505") {
    ({ data, error } = await supabase
      .from("pieces")
      .insert({ ...row, slug: `${row.slug}-${nanoid(6)}` })
      .select()
      .single());
  }
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert failed" },
      { status: 500 }
    );
  }

  if (typeof body.session_id === "string") {
    await supabase
      .from("darkroom_sessions")
      .update({ piece_id: data.id })
      .eq("id", body.session_id);
  }

  return NextResponse.json(data);
}
