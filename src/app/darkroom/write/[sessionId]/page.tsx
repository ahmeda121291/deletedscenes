import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Editor } from "@/components/darkroom/Editor";
import type {
  Collection,
  DarkroomSession,
  MediaItem,
  Piece,
  PieceVersion,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "write", robots: { index: false } };

export default async function WritePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: session } = await supabase
    .from("darkroom_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) notFound();

  let piece: Piece | null = null;
  let versions: PieceVersion[] = [];
  let media: MediaItem[] = [];
  if (session.piece_id) {
    const [pieceRes, versionsRes, mediaRes] = await Promise.all([
      supabase.from("pieces").select("*").eq("id", session.piece_id).maybeSingle(),
      supabase
        .from("piece_versions")
        .select("id, piece_id, developed_content, created_at")
        .eq("piece_id", session.piece_id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("media")
        .select("*")
        .eq("piece_id", session.piece_id)
        .order("sort_order"),
    ]);
    piece = pieceRes.data as Piece | null;
    versions = (versionsRes.data ?? []) as PieceVersion[];
    media = (mediaRes.data ?? []) as MediaItem[];
  }

  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, slug, description, sort_order, created_at")
    .order("sort_order");

  return (
    <Editor
      session={session as DarkroomSession}
      initialPiece={piece}
      initialVersions={versions}
      initialMedia={media}
      collections={(collections ?? []) as Collection[]}
    />
  );
}
