"use client";

import { useRef, useState } from "react";

/** Muted looping clip; click to unmute. */
export function VideoClip({
  src,
  caption,
}: {
  src: string;
  caption: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  return (
    <figure className="my-8">
      <video
        ref={ref}
        src={src}
        muted={muted}
        loop
        autoPlay
        playsInline
        onClick={() => setMuted((m) => !m)}
        className="w-full cursor-pointer rounded-[2px] border border-hairline"
        aria-label={caption ?? "clip — click to toggle sound"}
      />
      <figcaption className="mt-2 flex justify-between font-mono text-[11px] tracking-wider text-muted">
        <span>{caption}</span>
        <span>{muted ? "CLICK FOR SOUND" : "SOUND ON"}</span>
      </figcaption>
    </figure>
  );
}
