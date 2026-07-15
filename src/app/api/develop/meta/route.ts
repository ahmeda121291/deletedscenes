import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { META_SYSTEM_PROMPT, stripCodeFences } from "@/lib/develop";
import type { DevelopMeta } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function parseMeta(raw: string): DevelopMeta | null {
  try {
    const parsed = JSON.parse(stripCodeFences(raw));
    if (
      Array.isArray(parsed.titles) &&
      parsed.titles.length >= 1 &&
      Array.isArray(parsed.tags) &&
      typeof parsed.suggested_collection === "string" &&
      typeof parsed.excerpt === "string"
    ) {
      return {
        titles: parsed.titles.slice(0, 3).map(String),
        tags: parsed.tags.slice(0, 6).map(String),
        suggested_collection: parsed.suggested_collection,
        excerpt: String(parsed.excerpt).slice(0, 140),
      };
    }
  } catch {
    // fall through
  }
  return null;
}

/** Titles / tags / collection / excerpt suggestions for a developed piece.
 * JSON-only; retries once on a malformed response. */
export async function POST(request: NextRequest) {
  const { unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  let body: { text?: unknown; collections?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const collections = Array.isArray(body.collections)
    ? body.collections.map(String)
    : [];
  if (!text.trim()) {
    return NextResponse.json({ error: "nothing to summarize" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.DEVELOP_MODEL || "claude-sonnet-4-6";

  const userContent = `Collections: ${collections.join(", ") || "(none)"}\n\nDeveloped text:\n\n${text}`;

  try {
    const ask = async (reminder: boolean) => {
      const message = await client.messages
        .stream({
          model,
          max_tokens: 1000,
          system: META_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: reminder
                ? `${userContent}\n\nReturn only valid JSON.`
                : userContent,
            },
          ],
        })
        .finalMessage();
      return message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    };

    let meta = parseMeta(await ask(false));
    if (!meta) meta = parseMeta(await ask(true));
    if (!meta) {
      return NextResponse.json(
        { error: "the model returned malformed suggestions — the piece itself is untouched" },
        { status: 502 }
      );
    }
    return NextResponse.json(meta);
  } catch (err) {
    const detail =
      err instanceof Anthropic.APIError
        ? `${err.status}: ${err.message}`
        : "meta call failed";
    return NextResponse.json(
      { error: `suggestions failed (${detail}) — the piece itself is untouched` },
      { status: 502 }
    );
  }
}
