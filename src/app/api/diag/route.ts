import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** TEMPORARY diagnostic route — removed once the upload corruption is
 * solved. Round-trips a known-good image through storage on the deployed
 * runtime and inspects an existing corrupt file. Guarded by a key. */
const DIAG_KEY = "1e46495f3f6065021d34e538";

function head(buf: Uint8Array, n = 24): { hex: string; ascii: string } {
  const slice = buf.slice(0, n);
  return {
    hex: Array.from(slice)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" "),
    ascii: Array.from(slice)
      .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
      .join(""),
  };
}

async function tryDecode(bytes: Uint8Array): Promise<string> {
  try {
    const meta = await sharp(Buffer.from(bytes)).metadata();
    return `ok: ${meta.format} ${meta.width}x${meta.height}`;
  } catch (e) {
    return `FAIL: ${e instanceof Error ? e.message.slice(0, 100) : "?"}`;
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("key") !== DIAG_KEY) {
    return NextResponse.json({ error: "nope" }, { status: 404 });
  }

  const admin = createAdminClient();
  const report: Record<string, unknown> = {};

  // 1. generate a known-good webp on this runtime
  const original = await sharp({
    create: { width: 32, height: 32, channels: 3, background: { r: 200, g: 20, b: 20 } },
  })
    .webp()
    .toBuffer();
  report.generated = {
    bytes: original.byteLength,
    head: head(original),
    decode: await tryDecode(original),
  };

  // 2. round-trip three body types through storage
  const variants: [string, () => Blob | ArrayBuffer | Buffer][] = [
    ["blob", () => new Blob([new Uint8Array(original)], { type: "image/webp" })],
    [
      "arraybuffer",
      () =>
        original.buffer.slice(
          original.byteOffset,
          original.byteOffset + original.byteLength
        ) as ArrayBuffer,
    ],
    ["buffer", () => original],
  ];
  for (const [name, make] of variants) {
    const path = `diag-${name}.webp`;
    const { error: upErr } = await admin.storage
      .from("media")
      .upload(path, make(), { contentType: "image/webp", upsert: true });
    if (upErr) {
      report[name] = { upload_error: upErr.message };
      continue;
    }
    const { data: dl, error: dlErr } = await admin.storage
      .from("media")
      .download(path);
    if (dlErr || !dl) {
      report[name] = { download_error: dlErr?.message };
      continue;
    }
    const back = new Uint8Array(await dl.arrayBuffer());
    report[name] = {
      sent: original.byteLength,
      stored: back.byteLength,
      identical:
        back.byteLength === original.byteLength &&
        back.every((b, i) => b === original[i]),
      head: head(back),
      decode: await tryDecode(back),
    };
  }

  // 3. inspect the corrupt file the owner just uploaded
  const target = request.nextUrl.searchParams.get("inspect");
  if (target && !target.includes("..") && !target.includes("/")) {
    const { data: dl, error } = await admin.storage.from("media").download(target);
    if (dl && !error) {
      const bytes = new Uint8Array(await dl.arrayBuffer());
      report.inspected = {
        path: target,
        bytes: bytes.byteLength,
        head: head(bytes, 48),
        decode: await tryDecode(bytes),
      };
    } else {
      report.inspected = { path: target, error: error?.message };
    }
  }

  return NextResponse.json(report);
}
