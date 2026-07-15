import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://deletedscenes.blog";

  let items = "";
  try {
    const supabase = await createClient();
    // published pieces only — unlisted never appears in the feed
    const { data: pieces } = await supabase
      .from("pieces")
      .select("title, slug, excerpt, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);

    items = (pieces ?? [])
      .map(
        (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${site}/s/${p.slug}</link>
      <guid isPermaLink="true">${site}/s/${p.slug}</guid>
      ${p.excerpt ? `<description>${esc(p.excerpt)}</description>` : ""}
      ${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ""}
    </item>`
      )
      .join("\n");
  } catch {
    // feed renders empty rather than erroring
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Deleted Scenes</title>
    <link>${site}</link>
    <description>the parts that didn't make the cut.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
