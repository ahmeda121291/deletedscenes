import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Attach a TMDB movie to a piece: store {tmdb_id, year, director,
 * original_title}, and ingest the poster into our own storage — never
 * hotlinked, and re-encoded through sharp like every other image.
 */
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  let body: { piece_id?: unknown; tmdb_id?: unknown; media_type?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const pieceId = typeof body.piece_id === "string" ? body.piece_id : null;
  const tmdbId = typeof body.tmdb_id === "number" ? body.tmdb_id : null;
  const mediaType = body.media_type === "tv" ? "tv" : "movie";
  if (!pieceId || !tmdbId) {
    return NextResponse.json(
      { error: "piece_id and tmdb_id required" },
      { status: 400 }
    );
  }

  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "TMDB_API_KEY not set" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?append_to_response=credits&api_key=${key}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "tmdb lookup failed" }, { status: 502 });
  }
  const movie = await res.json();

  // movies credit a director; shows credit their creator(s)
  const director =
    mediaType === "tv"
      ? ((movie.created_by as Array<{ name: string }> | undefined)?.[0]?.name ??
        null)
      : ((
          movie.credits?.crew as Array<{ job: string; name: string }> | undefined
        )?.find((c) => c.job === "Director")?.name ?? null);
  const releaseDate = (movie.release_date ?? movie.first_air_date) as
    | string
    | undefined;
  const tmdb = {
    tmdb_id: tmdbId,
    media_type: mediaType,
    year:
      typeof releaseDate === "string" && releaseDate
        ? releaseDate.slice(0, 4)
        : null,
    director,
    original_title: movie.original_title ?? movie.original_name ?? null,
  };

  // poster → our storage, as the piece's lead media
  let mediaRow = null;
  if (movie.poster_path) {
    const posterRes = await fetch(
      `https://image.tmdb.org/t/p/w780${movie.poster_path}`,
      { cache: "no-store" }
    );
    if (posterRes.ok) {
      const original = Buffer.from(await posterRes.arrayBuffer());
      const processed = await sharp(original)
        .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      const path = `${nanoid()}.webp`;
      const admin = createAdminClient();
      // Blob, not raw Buffer — Buffers get serialized incorrectly by the
      // storage client and the stored image is corrupt
      const { error: uploadError } = await admin.storage
        .from("media")
        .upload(path, new Blob([new Uint8Array(processed)], { type: "image/webp" }), {
          contentType: "image/webp",
        });
      if (!uploadError) {
        const { data: first } = await supabase
          .from("media")
          .select("sort_order")
          .eq("piece_id", pieceId)
          .order("sort_order", { ascending: true })
          .limit(1);
        const leadOrder = (first?.[0]?.sort_order ?? 1) - 1;
        const { data } = await supabase
          .from("media")
          .insert({
            piece_id: pieceId,
            storage_path: path,
            type: "image",
            caption: null,
            sort_order: leadOrder,
          })
          .select()
          .single();
        mediaRow = data;
      }
    }
  }

  const { data: piece, error } = await supabase
    .from("pieces")
    .update({ tmdb, type: "movie" })
    .eq("id", pieceId)
    .select()
    .single();
  if (error || !piece) {
    return NextResponse.json(
      { error: error?.message ?? "update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ piece, media: mediaRow });
}
