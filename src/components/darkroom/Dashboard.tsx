"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, formatRuntime } from "@/lib/text";
import type { Collection, Piece, PieceStatus } from "@/lib/types";

type SessionRef = { id: string; piece_id: string | null; updated_at: string };

export function Dashboard({
  pieces,
  collections,
  sessions,
}: {
  pieces: Piece[];
  collections: Collection[];
  sessions: SessionRef[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const collectionName = (id: string | null) =>
    collections.find((c) => c.id === id)?.name ?? "—";

  const newScene = async () => {
    setBusy("new");
    const res = await fetch("/api/sessions", { method: "POST" });
    setBusy(null);
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/darkroom/write/${id}`);
    }
  };

  const edit = async (piece: Piece) => {
    const existing = sessions.find((s) => s.piece_id === piece.id);
    if (existing) {
      router.push(`/darkroom/write/${existing.id}`);
      return;
    }
    setBusy(piece.id);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ piece_id: piece.id }),
    });
    setBusy(null);
    if (res.ok) {
      const { id } = await res.json();
      router.push(`/darkroom/write/${id}`);
    }
  };

  const setStatus = async (piece: Piece, status: PieceStatus) => {
    setBusy(piece.id);
    await fetch(`/api/pieces/${piece.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    router.refresh();
  };

  const copyLink = async (piece: Piece) => {
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await navigator.clipboard.writeText(`${base}/s/${piece.slug}`);
    setCopied(piece.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const remove = async (piece: Piece) => {
    if (!window.confirm(`delete "${piece.title}"? this cannot be undone.`))
      return;
    setBusy(piece.id);
    await fetch(`/api/pieces/${piece.id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-12">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">the darkroom</h1>
          <p className="mt-1 font-mono text-[11px] tracking-wider text-muted">
            {pieces.length} PIECES ·{" "}
            {pieces.filter((p) => p.status === "published").length} PUBLISHED
          </p>
        </div>
        <div className="flex gap-3 font-mono text-[11px] tracking-[0.15em]">
          <button
            onClick={newScene}
            disabled={busy === "new"}
            className="fade border border-accent px-4 py-2 text-accent hover:bg-accent hover:text-bg disabled:opacity-50"
          >
            NEW SCENE
          </button>
          <a
            href="/api/export"
            className="fade border border-hairline px-4 py-2 text-muted hover:border-muted hover:text-text"
          >
            EXPORT
          </a>
          <Link
            href="/darkroom/settings"
            className="fade border border-hairline px-4 py-2 text-muted hover:border-muted hover:text-text"
          >
            SETTINGS
          </Link>
        </div>
      </header>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-hairline text-left tracking-[0.15em] text-muted">
              <th className="py-3 pr-4 font-normal">TITLE</th>
              <th className="py-3 pr-4 font-normal">STATUS</th>
              <th className="py-3 pr-4 font-normal">SHELF</th>
              <th className="py-3 pr-4 font-normal">RUNTIME</th>
              <th className="py-3 pr-4 font-normal">VIEWS</th>
              <th className="py-3 pr-4 font-normal">UPDATED</th>
              <th className="py-3 font-normal">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {pieces.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center font-serif text-base italic text-muted"
                >
                  not developed yet.
                </td>
              </tr>
            )}
            {pieces.map((p) => (
              <tr
                key={p.id}
                className={`border-b border-hairline ${
                  busy === p.id ? "opacity-40" : ""
                }`}
              >
                <td className="max-w-64 truncate py-3 pr-4 font-serif text-sm">
                  {p.title}
                </td>
                <td className="py-3 pr-4">
                  <select
                    value={p.status}
                    onChange={(e) =>
                      setStatus(p, e.target.value as PieceStatus)
                    }
                    aria-label={`status of ${p.title}`}
                    className={`border border-hairline bg-surface px-2 py-1 text-[11px] tracking-wider outline-none focus:border-accent ${
                      p.status === "published" ? "text-accent" : "text-muted"
                    }`}
                  >
                    <option value="draft">draft</option>
                    <option value="unlisted">unlisted</option>
                    <option value="published">published</option>
                  </select>
                </td>
                <td className="py-3 pr-4 text-muted">
                  {collectionName(p.collection_id)}
                </td>
                <td className="py-3 pr-4 text-muted">
                  {formatRuntime(p.word_count)}
                </td>
                <td className="py-3 pr-4 text-muted">{p.view_count}</td>
                <td className="py-3 pr-4 text-muted">
                  {formatDate(p.updated_at)}
                </td>
                <td className="py-3">
                  <span className="flex gap-3 tracking-wider">
                    <button
                      onClick={() => edit(p)}
                      className="fade text-accent hover:opacity-70"
                    >
                      edit
                    </button>
                    <button
                      onClick={() => copyLink(p)}
                      className="fade text-muted hover:text-text"
                    >
                      {copied === p.id ? "copied" : "link"}
                    </button>
                    <button
                      onClick={() => remove(p)}
                      className="fade text-muted hover:text-red-400"
                    >
                      delete
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8">
        <Link
          href="/"
          className="fade font-mono text-[11px] tracking-[0.15em] text-muted hover:text-accent"
        >
          ← THE FLOOR
        </Link>
      </p>
    </main>
  );
}
