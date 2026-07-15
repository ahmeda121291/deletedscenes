/** Shared text helpers: word counts, runtimes, dates, slugs. */

const WORDS_PER_MINUTE = 230;

/** Strip markdown syntax so word counts reflect prose, not markup. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*>+\s?/gm, "") // blockquotes
    .replace(/^\s*[-*+]\s+/gm, "") // list bullets
    .replace(/^\s*\d+\.\s+/gm, "") // ordered lists
    .replace(/[*_~]{1,3}/g, "") // emphasis
    .replace(/<[^>]+>/g, " ") // html tags
    .replace(/^-{3,}\s*$/gm, " "); // hr
}

export function countWords(text: string): number {
  const stripped = stripMarkdown(text).trim();
  if (!stripped) return 0;
  return stripped.split(/\s+/).length;
}

export function runtimeMinutes(words: number): number {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** The one motif: word count rendered as runtime. `18 MIN` */
export function formatRuntime(words: number): string {
  return `${runtimeMinutes(words)} MIN`;
}

/** `2026.07.14` */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

/** kebab-case a title into a slug. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "") || "untitled"
  );
}

/** Concatenate rant messages, in order, into the raw text. */
export function concatMessages(messages: { text: string }[]): string {
  return messages
    .map((m) => m.text)
    .filter((t) => t.trim().length > 0)
    .join("\n\n");
}

/** Split text at paragraph boundaries into chunks of at most maxWords. */
export function chunkAtParagraphs(text: string, maxWords = 5000): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const p of paragraphs) {
    const w = p.trim() ? p.trim().split(/\s+/).length : 0;
    if (currentWords + w > maxWords && current.length > 0) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
    current.push(p);
    currentWords += w;
  }
  if (current.length > 0) chunks.push(current.join("\n\n"));
  return chunks.filter((c) => c.trim().length > 0);
}
