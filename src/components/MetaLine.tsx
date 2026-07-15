import { formatDate, formatRuntime } from "@/lib/text";

/** `2026.07.14 · 18 MIN · MARRIAGE` — date · runtime · collection, in mono. */
export function MetaLine({
  date,
  words,
  collectionName,
  runtimeOverride,
  className = "",
}: {
  date: string | null;
  words: number;
  collectionName?: string | null;
  runtimeOverride?: React.ReactNode;
  className?: string;
}) {
  const parts: React.ReactNode[] = [];
  if (date) parts.push(formatDate(date));
  parts.push(runtimeOverride ?? formatRuntime(words));
  if (collectionName) parts.push(collectionName.toUpperCase());

  return (
    <p
      className={`font-mono text-xs tracking-wider text-muted ${className}`}
    >
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-2">·</span>}
          {p}
        </span>
      ))}
    </p>
  );
}
