import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** TMDB search proxy — the key never leaves the server. */
export async function GET(request: NextRequest) {
  const { unauthorized } = await requireOwner();
  if (unauthorized) return unauthorized;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "TMDB_API_KEY not set" }, { status: 500 });
  }

  // multi-search covers both movies and TV shows
  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&include_adult=false&api_key=${key}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json({ error: "tmdb search failed" }, { status: 502 });
  }
  const data = await res.json();

  return NextResponse.json({
    results: ((data.results ?? []) as Array<Record<string, unknown>>)
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, 8)
      .map((r) => {
        const date = (r.release_date ?? r.first_air_date) as string | undefined;
        return {
          tmdb_id: r.id,
          media_type: r.media_type,
          title: r.title ?? r.name,
          original_title: r.original_title ?? r.original_name,
          year: typeof date === "string" && date ? date.slice(0, 4) : null,
          overview:
            typeof r.overview === "string" ? r.overview.slice(0, 160) : "",
        };
      }),
  });
}
