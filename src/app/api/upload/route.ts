import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "gif"];
const VIDEO_EXTS = ["mp4", "webm"];
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/**
 * Finish an upload. The client puts the original file in the PRIVATE
 * `media-staging` bucket (dodging serverless body limits and keeping raw
 * EXIF off the public bucket), then calls here. Images are re-encoded
 * through sharp — resize to max 2000px, output WebP. Re-encoding strips
 * EXIF/GPS: this is the anonymity layer, not an optimization. Videos
 * (mp4/webm ≤ 50MB) are stored as-is.
 */
export async function POST(request: NextRequest) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  let body: {
    path?: unknown;
    piece_id?: unknown;
    caption?: unknown;
    target?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const stagingPath = typeof body.path === "string" ? body.path : "";
  const pieceId = typeof body.piece_id === "string" ? body.piece_id : null;
  const caption = typeof body.caption === "string" ? body.caption : null;
  const isSiteOg = body.target === "site-og";
  const ext = stagingPath.split(".").pop()?.toLowerCase() ?? "";

  if (!stagingPath || stagingPath.includes("..")) {
    return NextResponse.json({ error: "bad path" }, { status: 400 });
  }
  const isImage = IMAGE_EXTS.includes(ext);
  const isVideo = VIDEO_EXTS.includes(ext);
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: `unsupported file type .${ext}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: file, error: downloadError } = await admin.storage
    .from("media-staging")
    .download(stagingPath);
  if (downloadError || !file) {
    return NextResponse.json(
      { error: "staged file not found" },
      { status: 404 }
    );
  }
  const original = Buffer.from(await file.arrayBuffer());

  // the site-wide OG image lives at a fixed path — same sharp pipeline
  // (EXIF/GPS stripped), swappable without a deploy, no media row
  if (isSiteOg) {
    if (!isImage) {
      await admin.storage.from("media-staging").remove([stagingPath]);
      return NextResponse.json(
        { error: "the site OG image must be an image" },
        { status: 400 }
      );
    }
    const processed = await sharp(original)
      .rotate()
      .resize(1200, 630, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    const { error } = await admin.storage
      .from("media")
      .upload("site-og.webp", processed, {
        contentType: "image/webp",
        upsert: true,
      });
    await admin.storage.from("media-staging").remove([stagingPath]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ storage_path: "site-og.webp" });
  }

  let finalPath: string;
  if (isImage) {
    // rotate() applies EXIF orientation before the metadata is dropped;
    // the re-encode itself carries zero EXIF/GPS forward
    const processed = await sharp(original)
      .rotate()
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    finalPath = `${nanoid()}.webp`;
    const { error } = await admin.storage
      .from("media")
      .upload(finalPath, processed, { contentType: "image/webp" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    if (original.byteLength > MAX_VIDEO_BYTES) {
      await admin.storage.from("media-staging").remove([stagingPath]);
      return NextResponse.json({ error: "video over 50MB" }, { status: 413 });
    }
    finalPath = `${nanoid()}.${ext}`;
    const { error } = await admin.storage
      .from("media")
      .upload(finalPath, original, {
        contentType: ext === "mp4" ? "video/mp4" : "video/webm",
      });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await admin.storage.from("media-staging").remove([stagingPath]);

  // next sort_order for this piece
  let sortOrder = 0;
  if (pieceId) {
    const { data: last } = await supabase
      .from("media")
      .select("sort_order")
      .eq("piece_id", pieceId)
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = (last?.[0]?.sort_order ?? -1) + 1;
  }

  const { data: row, error: insertError } = await supabase
    .from("media")
    .insert({
      piece_id: pieceId,
      storage_path: finalPath,
      type: isImage ? "image" : "video",
      caption,
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (insertError || !row) {
    return NextResponse.json(
      { error: insertError?.message ?? "insert failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(row);
}
