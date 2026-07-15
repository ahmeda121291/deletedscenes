import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_AUDIO_BYTES = 8_000_000;

/**
 * Speech-to-text for the rant box. The browser records the mic and posts
 * the audio here; we forward it to ElevenLabs (key stays server-side) and
 * return only the transcript. The audio itself is never stored.
 */
export async function POST(request: NextRequest) {
  const { unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY not set — add it in Vercel env vars" },
      { status: 500 }
    );
  }

  let audio: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    audio = form.get("audio");
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "no audio received" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "recording too large — keep takes under ~15 minutes" },
      { status: 413 }
    );
  }

  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "rant.webm");
  upstream.append("model_id", "scribe_v1");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: upstream,
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `transcription failed (${res.status}) — the recording was not saved, try again` },
      { status: 502 }
    );
  }

  const data = await res.json();
  return NextResponse.json({ text: typeof data.text === "string" ? data.text : "" });
}
