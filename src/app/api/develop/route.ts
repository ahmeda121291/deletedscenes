import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { buildDevelopPrompt, stripCodeFences } from "@/lib/develop";
import type { ChunkPosition, DevelopIntensity } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const INTENSITIES: DevelopIntensity[] = ["cleanup", "shape", "cut"];
const POSITIONS: ChunkPosition[] = ["only", "first", "middle", "last"];

/**
 * One Develop pass over one chunk. Chunking is client-orchestrated: the
 * editor splits >5,000-word rants at paragraph boundaries and calls this
 * sequentially. The rant itself is already persisted before this is ever
 * called — a failure here never loses a word.
 */
export async function POST(request: NextRequest) {
  const { unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  let body: { chunk?: unknown; intensity?: unknown; position?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const chunk = typeof body.chunk === "string" ? body.chunk : "";
  const intensity = INTENSITIES.includes(body.intensity as DevelopIntensity)
    ? (body.intensity as DevelopIntensity)
    : "shape";
  const position = POSITIONS.includes(body.position as ChunkPosition)
    ? (body.position as ChunkPosition)
    : "only";

  if (!chunk.trim()) {
    return NextResponse.json({ error: "nothing to develop" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.DEVELOP_MODEL || "claude-sonnet-4-6";

  try {
    const message = await client.messages
      .stream({
        model,
        max_tokens: 16000,
        system: buildDevelopPrompt(intensity, position),
        messages: [{ role: "user", content: chunk }],
      })
      .finalMessage();

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({ developed: stripCodeFences(text) });
  } catch (err) {
    const detail =
      err instanceof Anthropic.APIError
        ? `${err.status}: ${err.message}`
        : "develop call failed";
    return NextResponse.json(
      { error: `develop failed (${detail}) — your rant is safe, try again` },
      { status: 502 }
    );
  }
}
