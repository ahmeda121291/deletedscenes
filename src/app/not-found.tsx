import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5">
      <p className="font-serif text-2xl italic">nothing&rsquo;s on.</p>
      <Link
        href="/"
        className="fade mt-6 font-mono text-[11px] tracking-[0.2em] text-muted hover:text-accent"
      >
        ← HOME
      </Link>
    </main>
  );
}
