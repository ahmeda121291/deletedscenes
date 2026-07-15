import Link from "next/link";

/** Quiet mono nav for subpages. The homepage has the masthead instead. */
export function SiteNav() {
  return (
    <nav className="mx-auto flex max-w-[680px] items-baseline justify-between px-5 pt-8 font-mono text-xs tracking-widest text-muted">
      <Link href="/" className="fade hover:text-accent">
        DELETED SCENES
      </Link>
      <span className="flex gap-5">
        <Link href="/search" className="fade hover:text-accent">
          SEARCH
        </Link>
        <Link href="/about" className="fade hover:text-accent">
          ABOUT
        </Link>
      </span>
    </nav>
  );
}
