"use client";

import { useEffect } from "react";

/** First-party, server-side view counting: once per session per piece.
 * No count is ever rendered publicly. */
export function ViewPing({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `ds:viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // storage unavailable — count anyway
    }
    void fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
