import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/darkroom/SettingsForm";
import { CollectionsManager } from "@/components/darkroom/CollectionsManager";
import type { Collection, SiteSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "settings", robots: { index: false } };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: settings }, { data: collections }, { data: counts }] =
    await Promise.all([
      supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("collections")
        .select("id, name, slug, description, sort_order, created_at")
        .order("sort_order"),
      supabase.from("pieces").select("id, collection_id"),
    ]);

  const pieceCounts: Record<string, number> = {};
  for (const p of counts ?? []) {
    if (p.collection_id) {
      pieceCounts[p.collection_id] = (pieceCounts[p.collection_id] ?? 0) + 1;
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12">
      <header className="flex items-baseline justify-between">
        <h1 className="font-serif text-3xl tracking-tight">settings</h1>
        <Link
          href="/darkroom"
          className="fade font-mono text-[11px] tracking-[0.15em] text-muted hover:text-accent"
        >
          ← DARKROOM
        </Link>
      </header>

      <SettingsForm settings={(settings ?? { id: 1, epigraph: "", about_md: "" }) as SiteSettings} />
      <CollectionsManager
        collections={(collections ?? []) as Collection[]}
        pieceCounts={pieceCounts}
      />
    </main>
  );
}
