"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Collection } from "@/lib/types";

/** Collections CRUD: create, rename, reorder (up/down), delete when empty. */
export function CollectionsManager({
  collections,
  pieceCounts,
}: {
  collections: Collection[];
  pieceCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (fn: () => Promise<Response>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "something failed");
      return false;
    }
    router.refresh();
    return true;
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    void call(() =>
      fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
    ).then((ok) => ok && setNewName(""));
  };

  const rename = (id: string) => {
    if (!renameValue.trim()) return;
    void call(() =>
      fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
    ).then((ok) => ok && setRenaming(null));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= collections.length) return;
    const a = collections[index];
    const b = collections[target];
    void call(async () => {
      await fetch(`/api/collections/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: b.sort_order, keep_slug: true }),
      });
      return fetch(`/api/collections/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: a.sort_order, keep_slug: true }),
      });
    });
  };

  const remove = (c: Collection) => {
    if ((pieceCounts[c.id] ?? 0) > 0) return;
    if (!window.confirm(`delete shelf "${c.name}"?`)) return;
    void call(() =>
      fetch(`/api/collections/${c.id}`, { method: "DELETE" })
    );
  };

  return (
    <section className="mt-12 border-t border-hairline pt-8">
      <h2 className="font-mono text-xs tracking-[0.2em] text-muted">
        SHELVES
      </h2>

      <ul className={`mt-6 space-y-3 ${busy ? "opacity-50" : ""}`}>
        {collections.map((c, i) => (
          <li
            key={c.id}
            className="flex items-center gap-3 border border-hairline bg-surface px-4 py-3"
          >
            {renaming === c.id ? (
              <form
                className="flex flex-1 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  rename(c.id);
                }}
              >
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="flex-1 border-b border-hairline bg-transparent font-serif text-base outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="fade font-mono text-[11px] tracking-wider text-accent hover:opacity-70"
                >
                  save
                </button>
                <button
                  type="button"
                  onClick={() => setRenaming(null)}
                  className="fade font-mono text-[11px] tracking-wider text-muted hover:text-text"
                >
                  cancel
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 font-serif text-base">
                  {c.name}
                  <span className="ml-3 font-mono text-[11px] tracking-wider text-muted">
                    /c/{c.slug} · {pieceCounts[c.id] ?? 0}
                  </span>
                </span>
                <span className="flex gap-3 font-mono text-[11px] tracking-wider">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`move ${c.name} up`}
                    className="fade text-muted hover:text-text disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === collections.length - 1}
                    aria-label={`move ${c.name} down`}
                    className="fade text-muted hover:text-text disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => {
                      setRenaming(c.id);
                      setRenameValue(c.name);
                    }}
                    className="fade text-accent hover:opacity-70"
                  >
                    rename
                  </button>
                  <button
                    onClick={() => remove(c)}
                    disabled={(pieceCounts[c.id] ?? 0) > 0}
                    title={
                      (pieceCounts[c.id] ?? 0) > 0
                        ? "only empty shelves can be deleted"
                        : undefined
                    }
                    className="fade text-muted hover:text-red-400 disabled:opacity-30"
                  >
                    delete
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={create} className="mt-4 flex gap-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="new shelf name"
          className="flex-1 border-b border-hairline bg-transparent pb-1 font-serif text-base outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="fade border border-hairline px-4 py-2 font-mono text-[11px] tracking-[0.15em] text-muted hover:border-accent hover:text-accent disabled:opacity-40"
        >
          ADD
        </button>
      </form>

      {error && (
        <p className="mt-3 font-serif text-sm italic text-red-400">{error}</p>
      )}
    </section>
  );
}
