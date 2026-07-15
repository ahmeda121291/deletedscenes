import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runtimeMinutes } from "@/lib/text";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SIGNED_URL_TTL = 7 * 24 * 60 * 60; // 7 days

function frontmatterEscape(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * The fire escape. Streams a zip of everything:
 *   content/{slug}.md   — frontmatter + developed body
 *   raw/{slug}.txt      — the verbatim rants
 *   media-manifest.json — 7-day signed URLs for every media file
 * Media files stay out of the zip to dodge serverless limits; the manifest
 * is the recovery path. Years of writing are never hostage to this stack.
 */
export async function GET() {
  const { unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const [{ data: pieces }, { data: collections }, { data: media }] =
    await Promise.all([
      admin.from("pieces").select("*").order("created_at"),
      admin.from("collections").select("id, name"),
      admin.from("media").select("*").order("piece_id"),
    ]);

  const collectionName = new Map(
    (collections ?? []).map((c) => [c.id, c.name])
  );
  const pieceSlug = new Map((pieces ?? []).map((p) => [p.id, p.slug]));

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const out = new PassThrough();
  archive.pipe(out);
  const chunks: Buffer[] = [];
  const done = new Promise<void>((resolve, reject) => {
    out.on("data", (c: Buffer) => chunks.push(c));
    out.on("end", () => resolve());
    archive.on("error", reject);
  });

  const usedSlugs = new Set<string>();
  for (const p of pieces ?? []) {
    let slug = p.slug || p.id;
    while (usedSlugs.has(slug)) slug = `${slug}-dup`;
    usedSlugs.add(slug);

    const fm = [
      "---",
      `title: ${frontmatterEscape(p.title)}`,
      `date: ${p.published_at ?? p.created_at}`,
      `status: ${p.status}`,
      `collection: ${frontmatterEscape(
        collectionName.get(p.collection_id) ?? ""
      )}`,
      `tags: [${(p.tags ?? []).map((t: string) => frontmatterEscape(t)).join(", ")}]`,
      `runtime: ${runtimeMinutes(p.word_count ?? 0)} min`,
      "---",
      "",
    ].join("\n");
    archive.append(`${fm}${p.developed_content ?? ""}\n`, {
      name: `content/${slug}.md`,
    });
    if (p.raw_content) {
      archive.append(p.raw_content, { name: `raw/${slug}.txt` });
    }
  }

  const manifest = [];
  for (const m of media ?? []) {
    const { data: signed } = await admin.storage
      .from("media")
      .createSignedUrl(m.storage_path, SIGNED_URL_TTL);
    manifest.push({
      piece_slug: m.piece_id ? (pieceSlug.get(m.piece_id) ?? null) : null,
      storage_path: m.storage_path,
      type: m.type,
      caption: m.caption,
      sort_order: m.sort_order,
      signed_url: signed?.signedUrl ?? null,
      signed_url_expires_in_days: 7,
    });
  }
  archive.append(JSON.stringify(manifest, null, 2), {
    name: "media-manifest.json",
  });

  await archive.finalize();
  await done;

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(Buffer.concat(chunks)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="deleted-scenes-export-${date}.zip"`,
    },
  });
}
