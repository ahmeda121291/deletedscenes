import { NextResponse, type NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { requireOwner } from "@/lib/auth";
import { countWords, slugify } from "@/lib/text";
import type { PieceStatus, PieceType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: PieceType[] = ["essay", "story", "movie", "misc"];
const STATUSES: PieceStatus[] = ["draft", "unlisted", "published"];
const KEPT_VERSIONS = 50;

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

  const { data: current } = await supabase
    .from("pieces")
    .select("id, raw_content, published_at, status, slug")
    .eq("id", id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};

  if (typeof body.title === "string" && body.title.trim())
    update.title = body.title.trim();
  if (TYPES.includes(body.type as PieceType)) update.type = body.type;
  if (body.collection_id === null || typeof body.collection_id === "string")
    update.collection_id = body.collection_id;
  if (typeof body.excerpt === "string") update.excerpt = body.excerpt.slice(0, 140);
  if (body.excerpt === null) update.excerpt = null;
  if (Array.isArray(body.tags)) update.tags = body.tags.map(String);
  if (typeof body.show_raw === "boolean") update.show_raw = body.show_raw;

  if (typeof body.developed_content === "string") {
    update.developed_content = body.developed_content;
    update.word_count = countWords(body.developed_content);
  }

  // raw text is sacred: settable exactly once, when currently null.
  // A DB trigger enforces the same rule below us.
  if (typeof body.raw_content === "string" && current.raw_content === null) {
    update.raw_content = body.raw_content;
  }

  let nextStatus = current.status as PieceStatus;
  if (STATUSES.includes(body.status as PieceStatus)) {
    nextStatus = body.status as PieceStatus;
    update.status = nextStatus;
    if (nextStatus === "published" && !current.published_at) {
      update.published_at = new Date().toISOString();
    }
  }

  if (typeof body.slug === "string" && body.slug.trim()) {
    update.slug = slugify(body.slug);
  }
  // moving to unlisted: make the URL unguessable if it isn't already
  const effectiveSlug = (update.slug as string) ?? current.slug;
  if (
    nextStatus === "unlisted" &&
    !/-[A-Za-z0-9_-]{6}$/.test(effectiveSlug)
  ) {
    update.slug = `${effectiveSlug}-${nanoid(6)}`;
  }

  if (Object.keys(update).length === 0 && body.snapshot !== true) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  let data = null;
  if (Object.keys(update).length > 0) {
    let error = null;
    ({ data, error } = await supabase
      .from("pieces")
      .update(update)
      .eq("id", id)
      .select()
      .single());
    if (error?.code === "23505" && typeof update.slug === "string") {
      update.slug = `${update.slug}-${nanoid(6)}`;
      ({ data, error } = await supabase
        .from("pieces")
        .update(update)
        .eq("id", id)
        .select()
        .single());
    }
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "update failed" },
        { status: 500 }
      );
    }
  } else {
    ({ data } = await supabase
      .from("pieces")
      .select()
      .eq("id", id)
      .single());
  }

  // manual save → version snapshot, keep the most recent 50
  if (body.snapshot === true && typeof data?.developed_content === "string") {
    await supabase.from("piece_versions").insert({
      piece_id: id,
      developed_content: data.developed_content,
    });
    const { data: old } = await supabase
      .from("piece_versions")
      .select("id")
      .eq("piece_id", id)
      .order("created_at", { ascending: false })
      .range(KEPT_VERSIONS, KEPT_VERSIONS + 200);
    if (old && old.length > 0) {
      await supabase
        .from("piece_versions")
        .delete()
        .in(
          "id",
          old.map((v) => v.id)
        );
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  // remove this piece's files from storage, then the piece
  // (versions + media rows cascade)
  const { data: media } = await supabase
    .from("media")
    .select("storage_path")
    .eq("piece_id", id);
  if (media && media.length > 0) {
    await supabase.storage
      .from("media")
      .remove(media.map((m) => m.storage_path));
  }

  const { error } = await supabase.from("pieces").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
