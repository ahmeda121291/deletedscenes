"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";

/**
 * The piece body, with the RAW/DEVELOPED toggle when show_raw is on.
 * Developed renders in serif; raw renders in mono, pre-wrap — the negative
 * next to the print.
 */
export function PieceBody({
  developed,
  raw,
  showRawToggle,
}: {
  developed: string;
  raw: string | null;
  showRawToggle: boolean;
}) {
  const [mode, setMode] = useState<"developed" | "raw">("developed");
  const canToggle = showRawToggle && raw !== null;

  return (
    <div>
      {canToggle && (
        <div className="mb-8 flex justify-end gap-4 font-mono text-[11px] tracking-[0.15em]">
          <button
            onClick={() => setMode("raw")}
            aria-pressed={mode === "raw"}
            className={`fade ${
              mode === "raw" ? "text-accent" : "text-muted hover:text-text"
            }`}
          >
            RAW
          </button>
          <button
            onClick={() => setMode("developed")}
            aria-pressed={mode === "developed"}
            className={`fade ${
              mode === "developed"
                ? "text-accent"
                : "text-muted hover:text-text"
            }`}
          >
            DEVELOPED
          </button>
        </div>
      )}
      {mode === "raw" && canToggle ? (
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-text">
          {raw}
        </pre>
      ) : (
        <Markdown>{developed}</Markdown>
      )}
      <p aria-hidden className="mt-14 text-center text-muted">
        ■
      </p>
    </div>
  );
}
