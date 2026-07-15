"use client";

import { useState } from "react";
import type { SiteSettings } from "@/lib/types";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [epigraph, setEpigraph] = useState(settings.epigraph ?? "");
  const [aboutMd, setAboutMd] = useState(settings.about_md ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epigraph, about_md: aboutMd }),
    });
    setState(res.ok ? "saved" : "error");
    if (res.ok) setTimeout(() => setState("idle"), 1500);
  };

  return (
    <form onSubmit={save} className="mt-10 border-t border-hairline pt-8">
      <h2 className="font-mono text-xs tracking-[0.2em] text-muted">COPY</h2>

      <label className="mt-6 block font-mono text-[11px] tracking-wider text-muted">
        EPIGRAPH
        <input
          value={epigraph}
          onChange={(e) => setEpigraph(e.target.value)}
          className="mt-2 w-full border-b border-hairline bg-transparent pb-1 font-serif text-lg italic text-text outline-none focus:border-accent"
        />
      </label>

      <label className="mt-6 block font-mono text-[11px] tracking-wider text-muted">
        ABOUT (MARKDOWN)
        <textarea
          value={aboutMd}
          onChange={(e) => setAboutMd(e.target.value)}
          rows={5}
          className="mt-2 w-full resize-y border border-hairline bg-surface p-3 font-serif text-base text-text outline-none focus:border-accent"
        />
      </label>

      <button
        type="submit"
        disabled={state === "saving"}
        className="fade mt-4 border border-accent px-4 py-2 font-mono text-[11px] tracking-[0.15em] text-accent hover:bg-accent hover:text-bg disabled:opacity-50"
      >
        {state === "saving"
          ? "SAVING…"
          : state === "saved"
            ? "SAVED"
            : state === "error"
              ? "FAILED — RETRY"
              : "SAVE COPY"}
      </button>
    </form>
  );
}
