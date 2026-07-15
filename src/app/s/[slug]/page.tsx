import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/SiteNav";
import { MetaLine } from "@/components/MetaLine";
import { PieceBody } from "@/components/PieceBody";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ViewPing } from "@/components/ViewPing";
import { VideoClip } from "@/components/VideoClip";
import { ClipRuntime } from "@/components/ClipRuntime";
import { publicMediaUrl } from "@/lib/media";
import { PUBLIC_PIECE_COLUMNS, type MediaItem, type PublicPiece } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

type PieceWithRelations = PublicPiece & {
  collections: { name: string } | null;
  media: MediaItem[];
};

async function fetchPiece(slug: string): Promise<PieceWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pieces")
    .select(
      `${PUBLIC_PIECE_COLUMNS}, collections(name), media(id, piece_id, storage_path, type, caption, sort_order, created_at)`
    )
    .eq("slug", slug)
    .in("status", ["published", "unlisted"])
    .maybeSingle();
  return data as unknown as PieceWithRelations | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const piece = await fetchPiece(slug);
  if (!piece) return {};
  return {
    title: piece.title,
    description: piece.excerpt ?? undefined,
    // unlisted pieces are reachable purely by knowing the slug — never indexed
    robots: piece.status === "unlisted" ? { index: false, follow: false } : undefined,
  };
}

export default async function PiecePage({ params }: Props) {
  const { slug } = await params;
  const piece = await fetchPiece(slug);
  if (!piece || !piece.developed_content) notFound();

  const media = (piece.media ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const images = media.filter((m) => m.type === "image");
  const clips = media.filter((m) => m.type === "video");
  const poster = piece.type === "movie" ? images[0] : null;
  const isMovie = piece.type === "movie";

  return (
    <>
      <ReadingProgress />
      <ViewPing slug={piece.slug} />
      <SiteNav />
      <main className="mx-auto max-w-[680px] px-5 pb-24 pt-14">
        <article>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicMediaUrl(poster.storage_path)}
              alt={piece.title}
              className="mx-auto mb-10 w-56 rounded-[2px] border border-hairline shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
            />
          )}

          <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">
            {piece.title}
          </h1>
          <MetaLine
            className="mt-4"
            date={piece.published_at ?? piece.created_at}
            words={piece.word_count}
            collectionName={piece.collections?.name}
            runtimeOverride={
              isMovie && clips.length > 0 ? (
                <ClipRuntime
                  clipUrl={publicMediaUrl(clips[0].storage_path)}
                  fallbackWords={piece.word_count}
                />
              ) : undefined
            }
          />
          {isMovie && piece.tmdb && (
            <p className="mt-1 font-mono text-xs tracking-wider text-muted">
              {[
                piece.tmdb.year,
                piece.tmdb.director
                  ? `${piece.tmdb.media_type === "tv" ? "CREATED BY" : "DIR."} ${piece.tmdb.director.toUpperCase()}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          <div className="mt-10">
            <PieceBody
              developed={piece.developed_content!}
              raw={piece.show_raw ? piece.raw_content : null}
              showRawToggle={piece.show_raw}
            />
          </div>

          {isMovie &&
            clips.map((c) => (
              <VideoClip
                key={c.id}
                src={publicMediaUrl(c.storage_path)}
                caption={c.caption}
              />
            ))}

          {piece.tags.length > 0 && (
            <p className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-hairline pt-6 font-mono text-[11px] tracking-wider text-muted">
              {piece.tags.map((t) => (
                <Link
                  key={t}
                  href={`/search?tag=${encodeURIComponent(t)}`}
                  className="fade hover:text-accent"
                >
                  {t}
                </Link>
              ))}
            </p>
          )}
        </article>
      </main>
    </>
  );
}
