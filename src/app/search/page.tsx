import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/SiteNav";
import { MetaLine } from "@/components/MetaLine";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "search" };

type Props = { searchParams: Promise<{ q?: string; tag?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q, tag } = await searchParams;
  const supabase = await createClient();

  let results: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    word_count: number;
    published_at: string | null;
    tags: string[];
  }[] = [];

  const hasQuery = Boolean(q?.trim() || tag?.trim());

  if (hasQuery) {
    let query = supabase
      .from("pieces")
      .select("id, title, slug, excerpt, word_count, published_at, tags")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    if (q?.trim()) query = query.textSearch("search", q.trim(), { type: "websearch" });
    if (tag?.trim()) query = query.contains("tags", [tag.trim()]);
    const { data } = await query;
    results = data ?? [];
  }

  // tag cloud from published pieces
  const { data: tagRows } = await supabase
    .from("pieces")
    .select("tags")
    .eq("status", "published")
    .limit(500);
  const allTags = Array.from(
    new Set((tagRows ?? []).flatMap((r) => r.tags as string[]))
  ).sort();

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[680px] px-5 pb-24 pt-14">
        <h1 className="font-serif text-4xl tracking-tight">search</h1>

        <form method="GET" action="/search" className="mt-8">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="what are you looking for"
            aria-label="Search"
            className="w-full border-b border-hairline bg-transparent pb-2 font-serif text-xl italic text-text outline-none placeholder:text-muted focus:border-accent"
          />
        </form>

        {allTags.length > 0 && (
          <p className="mt-6 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] tracking-wider">
            {allTags.map((t) => (
              <Link
                key={t}
                href={`/search?tag=${encodeURIComponent(t)}`}
                className={`fade ${
                  t === tag ? "text-accent" : "text-muted hover:text-text"
                }`}
              >
                {t}
              </Link>
            ))}
            {tag && (
              <Link href="/search" className="fade text-muted hover:text-accent">
                × clear
              </Link>
            )}
          </p>
        )}

        {hasQuery && (
          <div className="mt-12 border-t border-hairline pt-8">
            {results.length === 0 ? (
              <p className="font-serif italic text-muted">nothing&rsquo;s on.</p>
            ) : (
              <ul className="space-y-8">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link href={`/s/${p.slug}`} className="fade group block">
                      <h2 className="fade font-serif text-xl leading-snug group-hover:text-accent">
                        {p.title}
                      </h2>
                      {p.excerpt && (
                        <p className="mt-1 font-serif text-sm text-muted">
                          {p.excerpt}
                        </p>
                      )}
                      <MetaLine
                        className="mt-2"
                        date={p.published_at}
                        words={p.word_count}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </>
  );
}
