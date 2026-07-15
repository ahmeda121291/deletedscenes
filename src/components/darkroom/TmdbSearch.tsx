"use client";

import { useState } from "react";
import type { MediaItem, Piece, TmdbInfo } from "@/lib/types";

interface Result {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  original_title: string;
  year: string | null;
  overview: string;
}

/** Movie metadata via the server-side TMDB proxy. Picking a result
 * downloads the poster into our storage and stores {tmdb_id, year,
 * director} on the piece. Results are text-only — no third-party images
 * load in the browser. */
export function TmdbSearch({
  pieceId,
  current,
  onAttached,
}: {
  pieceId: string;
  current: TmdbInfo | null;
  onAttached: (piece: Piece, poster: MediaItem | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [attaching, setAttaching] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<TmdbInfo | null>(current);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`);
    setBusy(false);
    if (!res.ok) {
      setError("search failed");
      return;
    }
    const data = await res.json();
    setResults(data.results ?? []);
  };

  const attach = async (r: Result) => {
    setAttaching(r.tmdb_id);
    setError(null);
    const res = await fetch("/api/tmdb/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        piece_id: pieceId,
        tmdb_id: r.tmdb_id,
        media_type: r.media_type,
      }),
    });
    setAttaching(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "attach failed");
      return;
    }
    const { piece, media } = await res.json();
    setInfo(piece.tmdb);
    setResults([]);
    setQ("");
    onAttached(piece as Piece, (media ?? null) as MediaItem | null);
  };

  return (
    <section className="rounded-[2px] border border-hairline bg-surface p-4">
      <h3 className="font-mono text-[11px] tracking-[0.2em] text-muted">
        THE FILM
      </h3>

      {info && (
        <p className="mt-2 font-mono text-[11px] tracking-wider text-accent">
          TMDB #{info.tmdb_id}
          {info.year ? ` · ${info.year}` : ""}
          {info.director ? ` · DIR. ${info.director.toUpperCase()}` : ""}
        </p>
      )}

      <form onSubmit={search} className="mt-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search tmdb"
          aria-label="Search TMDB"
          className="flex-1 border-b border-hairline bg-transparent pb-1 font-serif text-sm outline-none placeholder:italic placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !q.trim()}
          className="fade border border-hairline px-3 py-1 font-mono text-[11px] tracking-[0.15em] text-muted hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {busy ? "…" : "SEARCH"}
        </button>
      </form>

      {error && (
        <p className="mt-2 font-serif text-sm italic text-red-400">{error}</p>
      )}

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((r) => (
            <li
              key={r.tmdb_id}
              className="flex items-baseline justify-between gap-3 border-t border-hairline pt-2"
            >
              <span className="font-serif text-sm">
                {r.title}
                <span className="ml-2 font-mono text-[11px] text-muted">
                  {[r.media_type === "tv" ? "TV" : null, r.year]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {r.overview && (
                  <span className="block font-serif text-xs italic text-muted">
                    {r.overview}
                  </span>
                )}
              </span>
              <button
                onClick={() => void attach(r)}
                disabled={attaching !== null}
                className="fade shrink-0 font-mono text-[11px] tracking-wider text-accent hover:opacity-70 disabled:opacity-40"
              >
                {attaching === r.tmdb_id ? "FILING…" : "ATTACH"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
