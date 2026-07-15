import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Dashboard } from "@/components/darkroom/Dashboard";
import type { Collection, Piece } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "the darkroom", robots: { index: false } };

export default async function DarkroomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: pieces }, { data: collections }, { data: sessions }] =
    await Promise.all([
      supabase
        .from("pieces")
        .select(
          "id, title, slug, type, collection_id, status, word_count, view_count, updated_at, published_at"
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("collections")
        .select("id, name, slug, description, sort_order, created_at")
        .order("sort_order"),
      supabase.from("darkroom_sessions").select("id, piece_id, updated_at"),
    ]);

  return (
    <Dashboard
      pieces={(pieces ?? []) as Piece[]}
      collections={(collections ?? []) as Collection[]}
      sessions={sessions ?? []}
    />
  );
}
