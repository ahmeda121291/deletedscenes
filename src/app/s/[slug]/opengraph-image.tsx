import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatRuntime } from "@/lib/text";

export const alt = "Deleted Scenes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: piece } = await supabase
    .from("pieces")
    .select("title, word_count, published_at, created_at, collections(name)")
    .eq("slug", slug)
    .in("status", ["published", "unlisted"])
    .maybeSingle();

  const [serif, mono] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Newsreader-Medium.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/IBMPlexMono-Regular.ttf")),
  ]);

  const title = piece?.title ?? "nothing's on.";
  const collection = (piece?.collections as unknown as { name: string } | null)
    ?.name;
  const meta = piece
    ? [
        formatDate(piece.published_at ?? piece.created_at),
        formatRuntime(piece.word_count),
        collection?.toUpperCase(),
      ]
        .filter(Boolean)
        .join("  ·  ")
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0F0D0A",
          color: "#F2EADB",
          padding: "72px 84px",
        }}
      >
        <div
          style={{
            fontFamily: "IBM Plex Mono",
            fontSize: 24,
            letterSpacing: 6,
            color: "#6E655A",
          }}
        >
          DELETED SCENES
        </div>
        <div
          style={{
            fontFamily: "Newsreader",
            fontSize: title.length > 60 ? 56 : 76,
            lineHeight: 1.15,
            letterSpacing: -1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "IBM Plex Mono",
            fontSize: 24,
            letterSpacing: 3,
            color: "#C9915C",
          }}
        >
          {meta}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: serif, style: "normal" },
        { name: "IBM Plex Mono", data: mono, style: "normal" },
      ],
    }
  );
}
