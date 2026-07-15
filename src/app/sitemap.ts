import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://deletedscenes.blog";

  const entries: MetadataRoute.Sitemap = [
    { url: site },
    { url: `${site}/about` },
    { url: `${site}/search` },
  ];

  try {
    const supabase = await createClient();
    // published pieces and collections only — unlisted never appears
    const [{ data: collections }, { data: pieces }] = await Promise.all([
      supabase.from("collections").select("slug"),
      supabase
        .from("pieces")
        .select("slug, updated_at")
        .eq("status", "published"),
    ]);

    for (const c of collections ?? []) {
      entries.push({ url: `${site}/c/${c.slug}` });
    }
    for (const p of pieces ?? []) {
      entries.push({
        url: `${site}/s/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      });
    }
  } catch {
    // base entries only
  }

  return entries;
}
