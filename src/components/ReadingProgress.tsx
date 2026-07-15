"use client";

import { useEffect, useState } from "react";

/** 2px amber reading-progress bar fixed at the top, scroll-linked. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? Math.min(1, el.scrollTop / total) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-40 h-[2px] origin-left bg-accent"
      style={{ transform: `scaleX(${progress})` }}
    />
  );
}
