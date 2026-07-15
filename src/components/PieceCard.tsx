import Link from "next/link";
import { formatDate, formatRuntime, stripMarkdown } from "@/lib/text";
import { publicMediaUrl } from "@/lib/media";
import type { MediaItem, PublicPiece } from "@/lib/types";

export type ShelfPiece = Pick<
  PublicPiece,
  | "id"
  | "title"
  | "slug"
  | "type"
  | "excerpt"
  | "developed_content"
  | "word_count"
  | "published_at"
> & { media?: Pick<MediaItem, "storage_path" | "type" | "sort_order">[] };

function firstLine(piece: ShelfPiece): string {
  if (piece.excerpt) return piece.excerpt;
  const text = stripMarkdown(piece.developed_content ?? "").trim();
  const line = text.split("\n").find((l) => l.trim());
  return line ? line.trim().slice(0, 140) : "";
}

function posterPath(piece: ShelfPiece): string | null {
  const images = (piece.media ?? [])
    .filter((m) => m.type === "image")
    .sort((a, b) => a.sort_order - b.sort_order);
  return images[0]?.storage_path ?? null;
}

/** A shelf item. movie → poster card (2:3); text → title + first line. */
export function PieceCard({ piece }: { piece: ShelfPiece }) {
  const meta = (
    <p className="mt-2 font-mono text-[11px] tracking-wider text-muted">
      {formatDate(piece.published_at)}
      <span className="mx-1.5">·</span>
      {formatRuntime(piece.word_count)}
    </p>
  );

  const poster = piece.type === "movie" ? posterPath(piece) : null;

  if (poster) {
    return (
      <Link
        href={`/s/${piece.slug}`}
        className="fade group block w-36 hover:opacity-90 sm:w-40"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={publicMediaUrl(poster)}
          alt={piece.title}
          className="aspect-[2/3] w-full rounded-[2px] border border-hairline object-cover shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        />
        <h3 className="fade mt-3 font-serif text-sm leading-snug group-hover:text-accent">
          {piece.title}
        </h3>
        {meta}
      </Link>
    );
  }

  return (
    <Link
      href={`/s/${piece.slug}`}
      className="fade group flex aspect-[2/3] w-36 flex-col justify-between rounded-[2px] border border-hairline bg-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-muted sm:w-40"
    >
      <div>
        <h3 className="fade font-serif text-base leading-snug group-hover:text-accent">
          {piece.title}
        </h3>
        <p className="mt-3 line-clamp-4 font-serif text-xs leading-relaxed text-muted">
          {firstLine(piece)}
        </p>
      </div>
      {meta}
    </Link>
  );
}
