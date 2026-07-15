import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Sanitized markdown body. react-markdown never injects raw HTML —
 * html in the source is skipped, which is the sanitization layer. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-scene">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
