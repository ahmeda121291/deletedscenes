"use client";

import { useRef, useState } from "react";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/browser";
import { publicMediaUrl } from "@/lib/media";
import type { MediaItem } from "@/lib/types";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(jpeg|png|webp|heic|heif|avif|gif)$/;
const VIDEO_TYPES = /^video\/(mp4|webm)$/;

/**
 * Attach media to a piece. Originals go to the PRIVATE staging bucket from
 * the browser, then /api/upload runs the sharp pipeline (resize, WebP,
 * EXIF/GPS stripped) and files land in public storage.
 *
 * The list itself is owned by the Editor, so a TMDB poster attach can
 * surface here without a reload.
 */
export function MediaManager({
  pieceId,
  media,
  onChange,
}: {
  pieceId: string;
  media: MediaItem[];
  onChange: (next: MediaItem[]) => void;
}) {
  const setMedia = (
    update: MediaItem[] | ((current: MediaItem[]) => MediaItem[])
  ) => onChange(typeof update === "function" ? update(media) : update);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    const isImage = IMAGE_TYPES.test(file.type);
    const isVideo = VIDEO_TYPES.test(file.type);
    if (!isImage && !isVideo) {
      setError("images (jpg/png/webp/heic) or clips (mp4/webm) only.");
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setError("clips must be 50MB or under.");
      return;
    }

    setBusy("uploading…");
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const stagingPath = `${nanoid()}.${ext}`;
      const supabase = createClient();
      const { error: stageError } = await supabase.storage
        .from("media-staging")
        .upload(stagingPath, file, { contentType: file.type });
      if (stageError) throw new Error(stageError.message);

      setBusy(isImage ? "developing (stripping exif)…" : "filing…");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: stagingPath, piece_id: pieceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "upload failed");
      }
      const row = (await res.json()) as MediaItem;
      setMedia((m) => [...m, row]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveCaption = async (item: MediaItem, caption: string) => {
    setMedia((m) =>
      m.map((x) => (x.id === item.id ? { ...x, caption } : x))
    );
    await fetch(`/api/media/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption }),
    }).catch(() => setError("caption save failed"));
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= media.length) return;
    const a = media[index];
    const b = media[target];
    const next = [...media];
    next[index] = { ...b, sort_order: a.sort_order };
    next[target] = { ...a, sort_order: b.sort_order };
    setMedia(next.sort((x, y) => x.sort_order - y.sort_order));
    await Promise.all([
      fetch(`/api/media/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
      fetch(`/api/media/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
    ]).catch(() => setError("reorder failed"));
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm("remove this file?")) return;
    setMedia((m) => m.filter((x) => x.id !== item.id));
    await fetch(`/api/media/${item.id}`, { method: "DELETE" }).catch(() =>
      setError("delete failed")
    );
  };

  return (
    <section className="rounded-[2px] border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] tracking-[0.2em] text-muted">
          MEDIA
        </h3>
        <label className="fade cursor-pointer border border-hairline px-3 py-1 font-mono text-[11px] tracking-[0.15em] text-muted hover:border-accent hover:text-accent">
          {busy ?? "UPLOAD"}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif,video/mp4,video/webm"
            disabled={Boolean(busy)}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
            className="sr-only"
          />
        </label>
      </div>

      {/* permanent note — the anonymity layer only covers images */}
      <p className="mt-2 font-mono text-[10px] tracking-wider text-muted">
        photos are re-encoded and lose all exif/gps. export clips fresh —
        screen recordings carry no location data.
      </p>

      {error && (
        <p className="mt-2 font-serif text-sm italic text-red-400">{error}</p>
      )}

      {media.length > 0 && (
        <ul className="mt-4 space-y-3">
          {media.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3">
              {m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={publicMediaUrl(m.storage_path)}
                  alt={m.caption ?? ""}
                  className="h-14 w-14 rounded-[2px] border border-hairline object-cover"
                />
              ) : (
                <video
                  src={publicMediaUrl(m.storage_path)}
                  muted
                  className="h-14 w-14 rounded-[2px] border border-hairline object-cover"
                />
              )}
              <input
                defaultValue={m.caption ?? ""}
                placeholder="caption"
                onBlur={(e) => void saveCaption(m, e.target.value)}
                aria-label="caption"
                className="flex-1 border-b border-hairline bg-transparent pb-1 font-serif text-sm outline-none placeholder:italic placeholder:text-muted focus:border-accent"
              />
              <span className="flex gap-2 font-mono text-[11px] text-muted">
                <button
                  onClick={() => void move(i, -1)}
                  disabled={i === 0}
                  aria-label="move up"
                  className="fade hover:text-text disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => void move(i, 1)}
                  disabled={i === media.length - 1}
                  aria-label="move down"
                  className="fade hover:text-text disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => void remove(m)}
                  className="fade hover:text-red-400"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
