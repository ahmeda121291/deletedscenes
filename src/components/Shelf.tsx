import Link from "next/link";
import { PieceCard, type ShelfPiece } from "@/components/PieceCard";
import type { Collection } from "@/lib/types";

/** One horizontal scroll row per collection. CSS scroll-snap, no JS. */
export function Shelf({
  collection,
  pieces,
}: {
  collection: Pick<Collection, "name" | "slug" | "description">;
  pieces: ShelfPiece[];
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="font-mono text-xs tracking-[0.2em] text-muted">
          {collection.name.toUpperCase()}
          {collection.description && (
            <span className="ml-4 font-serif text-sm normal-case italic tracking-normal">
              {collection.description}
            </span>
          )}
        </h2>
        {pieces.length > 0 && (
          <Link
            href={`/c/${collection.slug}`}
            className="fade font-mono text-[11px] tracking-wider text-muted hover:text-accent"
          >
            everything →
          </Link>
        )}
      </div>
      {pieces.length === 0 ? (
        <p className="border-t border-hairline pt-4 font-serif text-sm italic text-muted">
          not developed yet.
        </p>
      ) : (
        <div className="shelf-row">
          {pieces.map((p) => (
            <PieceCard key={p.id} piece={p} />
          ))}
        </div>
      )}
    </section>
  );
}
