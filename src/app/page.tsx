import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EntryTheater } from "@/components/EntryTheater";
import { Shelf } from "@/components/Shelf";
import type { ShelfPiece } from "@/components/PieceCard";
import { formatDate, formatRuntime } from "@/lib/text";
import type { Collection } from "@/lib/types";

export const dynamic = "force-dynamic";

const SHELF_COLUMNS =
  "id, title, slug, type, collection_id, excerpt, developed_content, word_count, published_at, media(storage_path, type, sort_order)";

type HomePiece = ShelfPiece & { collection_id: string | null };

export default async function HomePage() {
  const supabase = await createClient();

  const [settingsRes, collectionsRes, piecesRes] = await Promise.all([
    supabase.from("site_settings").select("epigraph").eq("id", 1).maybeSingle(),
    supabase
      .from("collections")
      .select("id, name, slug, description, sort_order, created_at")
      .order("sort_order"),
    // listing queries only ever request status = 'published'
    supabase
      .from("pieces")
      .select(SHELF_COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(200),
  ]);

  const epigraph =
    settingsRes.data?.epigraph ?? "the parts that didn't make the cut.";
  const collections = (collectionsRes.data ?? []) as Collection[];
  const pieces = (piecesRes.data ?? []) as unknown as HomePiece[];
  const recent = pieces.slice(0, 6);

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-16">
      <EntryTheater />

      <header>
        <h1 className="font-serif text-5xl tracking-[-0.03em] sm:text-6xl">
          DELETED SCENES
        </h1>
        <p className="mt-3 font-serif text-lg italic text-muted">{epigraph}</p>
      </header>

      {collections.map((c) => (
        <Shelf
          key={c.id}
          collection={c}
          pieces={pieces.filter((p) => p.collection_id === c.id).slice(0, 12)}
        />
      ))}

      {recent.length > 0 && (
        <section className="mt-16 border-t border-hairline pt-8">
          <h2 className="mb-4 font-mono text-xs tracking-[0.2em] text-muted">
            RECENTLY ADDED
          </h2>
          <ul className="space-y-2">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/s/${p.slug}`}
                  className="fade group font-mono text-xs tracking-wider text-muted hover:text-text"
                >
                  {formatDate(p.published_at)}
                  <span className="mx-2">·</span>
                  <span className="fade text-text group-hover:text-accent">
                    {p.title}
                  </span>
                  <span className="mx-2">·</span>
                  {formatRuntime(p.word_count)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-20 flex gap-6 border-t border-hairline pt-6 font-mono text-[11px] tracking-wider text-muted">
        <Link href="/about" className="fade hover:text-accent">
          about
        </Link>
        <Link href="/search" className="fade hover:text-accent">
          search
        </Link>
        <a href="/rss.xml" className="fade hover:text-accent">
          rss
        </a>
      </footer>
    </main>
  );
}
