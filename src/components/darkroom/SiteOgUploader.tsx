"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/browser";
import { publicMediaUrl } from "@/lib/media";

/** The site-wide OG image (link previews for the homepage and any page
 * without its own). Runs through the sharp pipeline — EXIF/GPS stripped,
 * cropped to 1200×630 — and swaps without a deploy. */
export function SiteOgUploader() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const upload = async (file: File) => {
    setError(null);
    if (!/^image\//.test(file.type)) {
      setError("images only.");
      return;
    }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const stagingPath = `${nanoid()}.${ext}`;
      const supabase = createClient();
      const { error: stageError } = await supabase.storage
        .from("media-staging")
        .upload(stagingPath, file, { contentType: file.type });
      if (stageError) throw new Error(stageError.message);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: stagingPath, target: "site-og" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "upload failed");
      }
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12 border-t border-hairline pt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-[0.2em] text-muted">
          SITE OG IMAGE
        </h2>
        <label className="fade cursor-pointer border border-hairline px-3 py-1 font-mono text-[11px] tracking-[0.15em] text-muted hover:border-accent hover:text-accent">
          {busy ? "DEVELOPING…" : "UPLOAD"}
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
            className="sr-only"
          />
        </label>
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-wider text-muted">
        the picture link previews show. cropped to 1200×630, exif stripped.
        piece pages keep their own generated card.
      </p>
      {error && (
        <p className="mt-2 font-serif text-sm italic text-red-400">{error}</p>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={version}
        src={`${publicMediaUrl("site-og.webp")}?v=${version}`}
        alt=""
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
        className="mt-4 aspect-[1200/630] w-full max-w-md rounded-[2px] border border-hairline object-cover"
      />
    </section>
  );
}
