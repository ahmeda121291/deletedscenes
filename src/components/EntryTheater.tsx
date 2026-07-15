"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

/**
 * The homepage keystroke listener. Type the codeword anywhere (outside an
 * input) and a login modal fades in. This is theater, not security — the
 * codeword ships in the client bundle by design; real security is Supabase
 * Auth + RLS + middleware.
 */
export function EntryTheater() {
  const codeword = (process.env.NEXT_PUBLIC_DARKROOM_CODEWORD || "").toLowerCase();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const buffer = useRef("");
  const router = useRouter();

  const show = useCallback(async () => {
    // Already signed in? Skip the modal and walk straight in.
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      router.push("/darkroom");
      return;
    }
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  }, [router]);

  useEffect(() => {
    if (!codeword) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key.length !== 1) return;
      buffer.current = (buffer.current + e.key.toLowerCase()).slice(
        -codeword.length
      );
      if (buffer.current === codeword) {
        buffer.current = "";
        void show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [codeword, show]);

  const close = () => {
    setVisible(false);
    setTimeout(() => setOpen(false), 150);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) {
      setError("nothing's on.");
      return;
    }
    router.push("/darkroom");
    router.refresh();
  };

  if (!open) return null;

  return (
    <div
      className={`fade fixed inset-0 z-[60] flex items-center justify-center bg-bg/85 backdrop-blur-[2px] ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Darkroom login"
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <button
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        onClick={close}
        tabIndex={-1}
      />
      <form
        onSubmit={submit}
        className="relative w-72 rounded-[2px] border border-hairline bg-surface p-6 shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
      >
        <p className="mb-4 font-mono text-[11px] tracking-[0.2em] text-muted">
          THE DARKROOM
        </p>
        <label className="block font-mono text-[11px] tracking-wider text-muted">
          EMAIL
          <input
            type="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border-b border-hairline bg-transparent pb-1 font-mono text-sm text-text outline-none focus:border-accent"
          />
        </label>
        <label className="mt-4 block font-mono text-[11px] tracking-wider text-muted">
          PASSWORD
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border-b border-hairline bg-transparent pb-1 font-mono text-sm text-text outline-none focus:border-accent"
          />
        </label>
        {error && (
          <p className="mt-3 font-serif text-sm italic text-muted">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="fade mt-5 w-full border border-hairline py-2 font-mono text-[11px] tracking-[0.2em] text-accent hover:border-accent disabled:opacity-50"
        >
          {busy ? "DEVELOPING…" : "ENTER"}
        </button>
      </form>
    </div>
  );
}
