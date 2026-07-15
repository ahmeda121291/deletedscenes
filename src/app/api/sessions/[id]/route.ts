import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import type { RantMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_MESSAGES_BYTES = 4_000_000;

/** Persist the rant thread (debounced from the editor). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  let body: { messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  const messages: RantMessage[] = body.messages
    .filter(
      (m): m is { text: string; ts?: string } =>
        !!m && typeof m.text === "string"
    )
    .map((m) => ({
      role: "writer",
      text: m.text,
      ts: typeof m.ts === "string" ? m.ts : new Date().toISOString(),
    }));

  if (JSON.stringify(messages).length > MAX_MESSAGES_BYTES) {
    return NextResponse.json({ error: "session too large" }, { status: 413 });
  }

  const { data, error } = await supabase
    .from("darkroom_sessions")
    .update({ messages })
    .eq("id", id)
    .select("id, updated_at")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "update failed" },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;
  const { id } = await params;

  const { error } = await supabase
    .from("darkroom_sessions")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
