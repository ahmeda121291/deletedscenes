"use client";

import { useEffect, useState } from "react";
import { formatRuntime } from "@/lib/text";

/** Movie posts with a clip show clip duration as the runtime instead of
 * reading time. Falls back to word-count runtime until metadata loads. */
export function ClipRuntime({
  clipUrl,
  fallbackWords,
}: {
  clipUrl: string;
  fallbackWords: number;
}) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = clipUrl;
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) {
        setMinutes(Math.max(1, Math.round(v.duration / 60)));
      }
    };
    return () => {
      v.src = "";
    };
  }, [clipUrl]);

  return <>{minutes !== null ? `${minutes} MIN` : formatRuntime(fallbackWords)}</>;
}
