import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "@/components/SiteNav";
import { MetaLine } from "@/components/MetaLine";
import { stripMarkdown } from "@/lib/text";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("collections")
    .select("name, description")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return {};
  return { title: data.name, description: data.description ?? undefined };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .maybeSingle();
  if (!collection) notFound();

  const { data: pieces } = await supabase
    .from("pieces")
    .select("id, title, slug, excerpt, developed_content, word_count, published_at")
    .eq("status", "published")
    .eq("collection_id", collection.id)
    .order("published_at", { ascending: false });

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-[680px] px-5 pb-24 pt-14">
        <h1 className="font-serif text-4xl tracking-tight">
          {collection.name}
        </h1>
        {collection.description && (
          <p className="mt-2 font-serif italic text-muted">
            {collection.description}
          </p>
        )}

        {!pieces || pieces.length === 0 ? (
          <p className="mt-12 border-t border-hairline pt-6 font-serif italic text-muted">
            not developed yet.
          </p>
        ) : (
          <ul className="mt-12 space-y-10 border-t border-hairline pt-10">
            {pieces.map((p) => {
              const first =
                p.excerpt ??
                stripMarkdown(p.developed_content ?? "")
                  .trim()
                  .split("\n")[0]
                  ?.slice(0, 140);
              return (
                <li key={p.id}>
                  <Link href={`/s/${p.slug}`} className="fade group block">
                    <h2 className="fade font-serif text-2xl leading-snug group-hover:text-accent">
                      {p.title}
                    </h2>
                    {first && (
                      <p className="mt-1 font-serif text-muted">{first}</p>
                    )}
                    <MetaLine
                      className="mt-2"
                      date={p.published_at}
                      words={p.word_count}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
