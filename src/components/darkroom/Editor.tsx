"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { MediaManager } from "@/components/darkroom/MediaManager";
import { TmdbSearch } from "@/components/darkroom/TmdbSearch";
import {
  chunkAtParagraphs,
  concatMessages,
  countWords,
  formatRuntime,
  slugify,
} from "@/lib/text";
import type {
  ChunkPosition,
  Collection,
  DarkroomSession,
  DevelopIntensity,
  DevelopMeta,
  MediaItem,
  Piece,
  PieceStatus,
  PieceType,
  PieceVersion,
  RantMessage,
} from "@/lib/types";

const CHUNK_WORDS = 5000;

interface Draft {
  title: string;
  slug: string;
  type: PieceType;
  collection_id: string | null;
  content: string;
  excerpt: string;
  tags: string[];
  status: PieceStatus;
  show_raw: boolean;
}

function draftFromPiece(piece: Piece | null): Draft {
  return {
    title: piece?.title ?? "untitled",
    slug: piece?.slug ?? "",
    type: piece?.type ?? "essay",
    collection_id: piece?.collection_id ?? null,
    content: piece?.developed_content ?? "",
    excerpt: piece?.excerpt ?? "",
    tags: piece?.tags ?? [],
    status: piece?.status ?? "draft",
    show_raw: piece?.show_raw ?? false,
  };
}

async function api<T = unknown>(
  url: string,
  method: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `${method} ${url} failed (${res.status})`);
  }
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

/**
 * The Darkroom editor. Two panels: the rant thread (a chat interface) and
 * the developed draft. Crash-proofing order: localStorage on every
 * keystroke → debounced server saves → version snapshots on manual save.
 */
export function Editor({
  session,
  initialPiece,
  initialVersions,
  initialMedia,
  collections,
}: {
  session: DarkroomSession;
  initialPiece: Piece | null;
  initialVersions: PieceVersion[];
  initialMedia: MediaItem[];
  collections: Collection[];
}) {
  const rantKey = `ds:rant:${session.id}`;
  const draftKey = `ds:draft:${session.id}`;

  const [messages, setMessages] = useState<RantMessage[]>(
    session.messages ?? []
  );
  const [input, setInput] = useState("");
  const [piece, setPiece] = useState<Piece | null>(initialPiece);
  const [draft, setDraft] = useState<Draft>(() => draftFromPiece(initialPiece));
  const [slugTouched, setSlugTouched] = useState(Boolean(initialPiece));
  const [versions, setVersions] = useState<PieceVersion[]>(initialVersions);
  const [showVersions, setShowVersions] = useState(false);
  const [preview, setPreview] = useState(false);
  const [intensity, setIntensity] = useState<DevelopIntensity>("shape");
  const [developing, setDeveloping] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [meta, setMeta] = useState<DevelopMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"clean" | "dirty" | "saving">(
    "clean"
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [rantRestore, setRantRestore] = useState<{
    messages: RantMessage[];
    pending: string;
  } | null>(null);
  const [draftRestore, setDraftRestore] = useState<Draft | null>(null);

  const [recState, setRecState] = useState<
    "idle" | "recording" | "transcribing"
  >("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunks = useRef<Blob[]>([]);
  const recTicker = useRef<ReturnType<typeof setInterval> | null>(null);
  const recElapsed = useRef(0);

  const threadRef = useRef<HTMLDivElement>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  const pieceRef = useRef(piece);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    pieceRef.current = piece;
  }, [piece]);

  /* ------------------------------------------------------------------ */
  /* crash-proofing: localStorage mirrors + restore offers               */
  /* ------------------------------------------------------------------ */

  // one-time load from localStorage (an external store, only readable
  // after mount) to offer crash recovery
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const rawRant = localStorage.getItem(rantKey);
      if (rawRant) {
        const local = JSON.parse(rawRant);
        const serverTs = new Date(session.updated_at).getTime();
        if (
          local.ts > serverTs &&
          (JSON.stringify(local.messages) !== JSON.stringify(session.messages) ||
            (local.pending ?? "").trim())
        ) {
          setRantRestore({
            messages: local.messages ?? [],
            pending: local.pending ?? "",
          });
        }
      }
      const rawDraft = localStorage.getItem(draftKey);
      if (rawDraft && initialPiece) {
        const local = JSON.parse(rawDraft);
        const serverTs = new Date(initialPiece.updated_at).getTime();
        if (
          local.ts > serverTs &&
          local.draft &&
          local.draft.content !== (initialPiece.developed_content ?? "")
        ) {
          setDraftRestore(local.draft);
        }
      }
    } catch {
      // unreadable localStorage — carry on with server state
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mirrorRant = useCallback(
    (msgs: RantMessage[], pending: string) => {
      try {
        localStorage.setItem(
          rantKey,
          JSON.stringify({ messages: msgs, pending, ts: Date.now() })
        );
      } catch {
        // storage full/unavailable — server persistence still runs
      }
    },
    [rantKey]
  );

  const mirrorDraft = useCallback(
    (d: Draft) => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({ draft: d, ts: Date.now() })
        );
      } catch {
        // ignore
      }
    },
    [draftKey]
  );

  /* ------------------------------------------------------------------ */
  /* rant thread                                                         */
  /* ------------------------------------------------------------------ */

  const persistMessages = useCallback(
    (msgs: RantMessage[]) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void api(`/api/sessions/${session.id}`, "PATCH", {
          messages: msgs,
        }).catch(() => {
          // localStorage still has everything; retried on next send
        });
      }, 1200);
    },
    [session.id]
  );

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const next = [
      ...messages,
      { role: "writer" as const, text, ts: new Date().toISOString() },
    ];
    setMessages(next);
    setInput("");
    mirrorRant(next, "");
    persistMessages(next);
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    });
  };

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, []);

  /* ------------------------------------------------------------------ */
  /* speak instead of type: record → transcribe → into the input box     */
  /* ------------------------------------------------------------------ */

  const MAX_REC_SECONDS = 600;

  const stopRecording = useCallback(() => {
    if (recTicker.current) clearInterval(recTicker.current);
    recTicker.current = null;
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop(); // onstop handles transcription
      setRecState("transcribing");
    } else {
      setRecState("idle");
    }
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      try {
        if (blob.size > 7_500_000) {
          throw new Error("recording too large — keep takes under ~15 minutes");
        }
        const fd = new FormData();
        fd.append("audio", blob, "rant.webm");
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "transcription failed");
        }
        const { text } = (await res.json()) as { text: string };
        if (text.trim()) {
          setInput((prev) => {
            const next = (prev ? `${prev}\n` : "") + text.trim();
            mirrorRant(messages, next);
            return next;
          });
        } else {
          setError("heard nothing — try again closer to the mic.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "transcription failed");
      } finally {
        setRecState("idle");
      }
    },
    [messages, mirrorRant]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recChunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) recChunks.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void transcribeBlob(new Blob(recChunks.current, { type: mime }));
      };
      rec.start();
      recRef.current = rec;
      recElapsed.current = 0;
      setRecSeconds(0);
      recTicker.current = setInterval(() => {
        recElapsed.current += 1;
        setRecSeconds(recElapsed.current);
        if (recElapsed.current >= MAX_REC_SECONDS) stopRecording();
      }, 1000);
      setRecState("recording");
    } catch {
      setError("microphone unavailable — check browser permissions.");
    }
  }, [stopRecording, transcribeBlob]);

  useEffect(() => {
    return () => {
      if (recTicker.current) clearInterval(recTicker.current);
      if (recRef.current && recRef.current.state !== "inactive") {
        recRef.current.stop();
      }
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* draft editing + autosave + versions                                 */
  /* ------------------------------------------------------------------ */

  const updateDraft = (patch: Partial<Draft>, touchSlug = false) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      if (patch.title !== undefined && !slugTouched && !touchSlug) {
        next.slug = slugify(patch.title);
      }
      mirrorDraft(next);
      return next;
    });
    if (touchSlug) setSlugTouched(true);
    setSaveState("dirty");
  };

  const savePiece = useCallback(
    async (snapshot: boolean) => {
      const p = pieceRef.current;
      if (!p) return;
      const d = draftRef.current;
      setSaveState("saving");
      try {
        const updated = await api<Piece>(`/api/pieces/${p.id}`, "PATCH", {
          title: d.title,
          slug: d.slug || undefined,
          type: d.type,
          collection_id: d.collection_id,
          developed_content: d.content,
          excerpt: d.excerpt,
          tags: d.tags,
          status: d.status,
          show_raw: d.show_raw,
          snapshot,
        });
        setPiece(updated);
        if (updated.slug !== d.slug) {
          setDraft((cur) => ({ ...cur, slug: updated.slug }));
        }
        setSaveState("clean");
        setSavedAt(new Date());
        if (snapshot) {
          const v = await api<PieceVersion[]>(
            `/api/pieces/${p.id}/versions`,
            "GET"
          );
          setVersions(v);
        }
      } catch (e) {
        setSaveState("dirty");
        setError(e instanceof Error ? e.message : "save failed");
      }
    },
    []
  );

  // debounced autosave ~10s after the last change
  useEffect(() => {
    if (saveState !== "dirty" || !piece) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void savePiece(false), 10_000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [saveState, draft, piece, savePiece]);

  // Cmd/Ctrl+S → manual save with snapshot
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void savePiece(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [savePiece]);

  /* ------------------------------------------------------------------ */
  /* develop                                                             */
  /* ------------------------------------------------------------------ */

  const develop = async () => {
    setError(null);
    setMeta(null);
    const raw = concatMessages(messages);
    if (!raw.trim()) {
      setError("nothing to develop — rant first.");
      return;
    }
    try {
      // flush any pending message persist first: the rant is sacred
      if (persistTimer.current) clearTimeout(persistTimer.current);
      setDeveloping("saving the rant…");
      await api(`/api/sessions/${session.id}`, "PATCH", { messages });

      // the concatenated rant becomes raw_content — immutable from here
      let p = pieceRef.current;
      if (!p) {
        p = await api<Piece>("/api/pieces", "POST", {
          title: draftRef.current.title || "untitled",
          type: draftRef.current.type,
          raw_content: raw,
          session_id: session.id,
        });
        setPiece(p);
      } else if (p.raw_content === null) {
        p = await api<Piece>(`/api/pieces/${p.id}`, "PATCH", {
          raw_content: raw,
        });
        setPiece(p);
      }

      const chunks = chunkAtParagraphs(raw, CHUNK_WORDS);
      const parts: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        setDeveloping(
          chunks.length === 1
            ? "developing…"
            : `developing ${i + 1}/${chunks.length}…`
        );
        const position: ChunkPosition =
          chunks.length === 1
            ? "only"
            : i === 0
              ? "first"
              : i === chunks.length - 1
                ? "last"
                : "middle";
        const { developed } = await api<{ developed: string }>(
          "/api/develop",
          "POST",
          { chunk: chunks[i], intensity, position }
        );
        parts.push(developed);
      }
      const assembled = parts.join("\n\n");

      const nextDraft = { ...draftRef.current, content: assembled };
      setDraft(nextDraft);
      mirrorDraft(nextDraft);
      const updated = await api<Piece>(`/api/pieces/${p.id}`, "PATCH", {
        developed_content: assembled,
        snapshot: true,
      });
      setPiece(updated);
      setSaveState("clean");
      setSavedAt(new Date());

      setDeveloping("suggesting titles…");
      try {
        await fetchMeta(assembled);
      } catch (e) {
        setError(e instanceof Error ? e.message : "suggestions failed");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "develop failed — your rant is safe, try again"
      );
    } finally {
      setDeveloping(null);
    }
  };

  // meta suggestions: first ~3,000 + last ~1,000 words if huge
  const fetchMeta = useCallback(
    async (text: string) => {
      const words = text.split(/\s+/);
      const metaText =
        words.length > 4000
          ? `${words.slice(0, 3000).join(" ")}\n\n[…]\n\n${words.slice(-1000).join(" ")}`
          : text;
      const m = await api<DevelopMeta>("/api/develop/meta", "POST", {
        text: metaText,
        collections: collections.map((c) => c.name),
      });
      setMeta(m);
      return m;
    },
    [collections]
  );

  // on-demand suggestions for the current draft, anytime
  const suggest = async () => {
    const text = draftRef.current.content;
    if (!text.trim()) {
      setError("nothing to suggest from — develop first.");
      return;
    }
    setSuggesting(true);
    setError(null);
    try {
      await fetchMeta(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "suggestions failed");
    } finally {
      setSuggesting(false);
    }
  };

  // applying a title also refreshes the slug while it's still untitled
  // or untouched — a hand-edited slug is never overwritten
  const applyTitle = (title: string) => {
    const slugIsPlaceholder =
      !draft.slug || /^untitled/.test(draft.slug) || !slugTouched;
    updateDraft({
      title,
      ...(slugIsPlaceholder ? { slug: slugify(title) } : {}),
    });
  };

  const applyAll = () => {
    if (!meta) return;
    const suggested = collections.find(
      (c) => c.name === meta.suggested_collection
    );
    applyTitle(meta.titles[0] ?? draft.title);
    updateDraft({
      tags: Array.from(new Set([...draft.tags, ...meta.tags])),
      excerpt: meta.excerpt || draft.excerpt,
      ...(suggested ? { collection_id: suggested.id } : {}),
    });
  };

  /* ------------------------------------------------------------------ */

  const words = useMemo(() => countWords(draft.content), [draft.content]);
  const rantWords = useMemo(
    () => countWords(concatMessages(messages)),
    [messages]
  );

  const restoreRant = () => {
    if (!rantRestore) return;
    setMessages(rantRestore.messages);
    setInput(rantRestore.pending);
    persistMessages(rantRestore.messages);
    setRantRestore(null);
  };

  const restoreDraft = () => {
    if (!draftRestore) return;
    setDraft(draftRestore);
    mirrorDraft(draftRestore);
    setSaveState("dirty");
    setDraftRestore(null);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/darkroom"
          className="fade font-mono text-[11px] tracking-[0.15em] text-muted hover:text-accent"
        >
          ← DARKROOM
        </Link>
        <span className="font-mono text-[11px] tracking-wider text-muted">
          {piece
            ? `${words.toLocaleString()} WORDS · ${formatRuntime(words)} · ${
                saveState === "saving"
                  ? "SAVING…"
                  : saveState === "dirty"
                    ? "UNSAVED"
                    : savedAt
                      ? `SAVED ${savedAt.toTimeString().slice(0, 5)}`
                      : "SAVED"
              }`
            : `${rantWords.toLocaleString()} WORDS IN THE TANK`}
        </span>
      </header>

      {(rantRestore || draftRestore) && (
        <div className="mb-4 space-y-2">
          {rantRestore && (
            <p className="flex flex-wrap items-center gap-3 border border-accent/40 bg-surface px-4 py-3 font-mono text-[11px] tracking-wider text-text">
              A NEWER LOCAL COPY OF THIS RANT EXISTS.
              <button
                onClick={restoreRant}
                className="fade text-accent hover:opacity-70"
              >
                restore it
              </button>
              <button
                onClick={() => setRantRestore(null)}
                className="fade text-muted hover:text-text"
              >
                keep server version
              </button>
            </p>
          )}
          {draftRestore && (
            <p className="flex flex-wrap items-center gap-3 border border-accent/40 bg-surface px-4 py-3 font-mono text-[11px] tracking-wider text-text">
              A NEWER LOCAL DRAFT EXISTS.
              <button
                onClick={restoreDraft}
                className="fade text-accent hover:opacity-70"
              >
                restore it
              </button>
              <button
                onClick={() => setDraftRestore(null)}
                className="fade text-muted hover:text-text"
              >
                keep server version
              </button>
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mb-4 flex items-center justify-between border border-red-900 bg-surface px-4 py-3 font-serif text-sm italic text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            aria-label="dismiss error"
            className="fade ml-4 font-mono text-muted hover:text-text"
          >
            ×
          </button>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------- rant panel ------------------------- */}
        <section
          aria-label="Rant thread"
          className="flex h-[70vh] flex-col rounded-[2px] border border-hairline bg-surface lg:h-[78vh]"
        >
          <div
            ref={threadRef}
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.length === 0 && (
              <p className="mt-10 text-center font-serif italic text-muted">
                rant. nobody&rsquo;s reading yet.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-bg px-4 py-2.5 font-serif text-base leading-relaxed">
                  {m.text}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-hairline p-3">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                mirrorRant(messages, e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={Math.min(6, Math.max(2, input.split("\n").length))}
              placeholder="say it"
              aria-label="Rant message"
              className="w-full resize-none bg-transparent font-serif text-base leading-relaxed outline-none placeholder:italic placeholder:text-muted"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider">
                <label className="text-muted" htmlFor="intensity">
                  DEVELOP:
                </label>
                <select
                  id="intensity"
                  value={intensity}
                  onChange={(e) =>
                    setIntensity(e.target.value as DevelopIntensity)
                  }
                  className="border border-hairline bg-bg px-2 py-1 text-text outline-none focus:border-accent"
                >
                  <option value="cleanup">cleanup</option>
                  <option value="shape">shape</option>
                  <option value="cut">cut</option>
                </select>
                <button
                  onClick={develop}
                  disabled={Boolean(developing) || messages.length === 0}
                  className="fade border border-accent px-3 py-1 tracking-[0.15em] text-accent hover:bg-accent hover:text-bg disabled:opacity-40"
                >
                  {developing ?? "DEVELOP"}
                </button>
              </div>
              <span className="flex gap-2">
                <button
                  onClick={() =>
                    recState === "recording"
                      ? stopRecording()
                      : recState === "idle"
                        ? void startRecording()
                        : undefined
                  }
                  disabled={recState === "transcribing"}
                  aria-label={
                    recState === "recording"
                      ? "stop recording"
                      : "record a voice rant"
                  }
                  className={`fade border px-3 py-1 font-mono text-[11px] tracking-[0.15em] disabled:opacity-40 ${
                    recState === "recording"
                      ? "border-accent text-accent"
                      : "border-hairline text-muted hover:border-muted hover:text-text"
                  }`}
                >
                  {recState === "recording"
                    ? `■ ${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`
                    : recState === "transcribing"
                      ? "DEVELOPING AUDIO…"
                      : "● REC"}
                </button>
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="fade border border-hairline px-3 py-1 font-mono text-[11px] tracking-[0.15em] text-muted hover:border-muted hover:text-text disabled:opacity-40"
                >
                  SEND
                </button>
              </span>
            </div>
          </div>
        </section>

        {/* ------------------------- draft panel ------------------------ */}
        <section aria-label="Developed draft" className="min-h-[70vh]">
          {!piece ? (
            <div className="flex h-full items-center justify-center rounded-[2px] border border-dashed border-hairline">
              <p className="max-w-xs text-center font-serif italic text-muted">
                not developed yet. rant on the left, then hit DEVELOP.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {meta && (
                <div className="rounded-[2px] border border-hairline bg-surface p-4">
                  <p className="flex items-baseline justify-between font-mono text-[11px] tracking-[0.2em] text-muted">
                    SUGGESTIONS
                    <span className="flex gap-4 tracking-[0.15em]">
                      <button
                        onClick={applyAll}
                        className="fade text-accent hover:opacity-70"
                      >
                        use all
                      </button>
                      <button
                        onClick={() => setMeta(null)}
                        aria-label="dismiss suggestions"
                        className="fade hover:text-text"
                      >
                        ×
                      </button>
                    </span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {meta.titles.map((t) => (
                      <button
                        key={t}
                        onClick={() => applyTitle(t)}
                        className="fade border border-hairline px-3 py-1.5 font-serif text-sm hover:border-accent hover:text-accent"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wider">
                    {meta.tags.map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          !draft.tags.includes(t) &&
                          updateDraft({ tags: [...draft.tags, t] })
                        }
                        className={`fade border px-2 py-1 ${
                          draft.tags.includes(t)
                            ? "border-accent text-accent"
                            : "border-hairline text-muted hover:text-text"
                        }`}
                      >
                        #{t}
                      </button>
                    ))}
                    {meta.suggested_collection && (
                      <button
                        onClick={() => {
                          const c = collections.find(
                            (c) => c.name === meta.suggested_collection
                          );
                          if (c) updateDraft({ collection_id: c.id });
                        }}
                        className="fade border border-hairline px-2 py-1 text-muted hover:border-accent hover:text-accent"
                      >
                        shelf: {meta.suggested_collection}
                      </button>
                    )}
                  </div>
                  {meta.excerpt && (
                    <button
                      onClick={() => updateDraft({ excerpt: meta.excerpt })}
                      className="fade mt-3 block text-left font-serif text-sm italic text-muted hover:text-accent"
                    >
                      &ldquo;{meta.excerpt}&rdquo; — use as excerpt
                    </button>
                  )}
                </div>
              )}

              <input
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                aria-label="Title"
                className="w-full border-b border-hairline bg-transparent pb-2 font-serif text-3xl tracking-tight outline-none focus:border-accent"
              />

              <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.15em]">
                <div className="flex gap-4">
                  <button
                    onClick={() => setPreview(false)}
                    aria-pressed={!preview}
                    className={`fade ${!preview ? "text-accent" : "text-muted hover:text-text"}`}
                  >
                    EDIT
                  </button>
                  <button
                    onClick={() => setPreview(true)}
                    aria-pressed={preview}
                    className={`fade ${preview ? "text-accent" : "text-muted hover:text-text"}`}
                  >
                    PREVIEW
                  </button>
                  <button
                    onClick={() => setShowVersions((v) => !v)}
                    aria-pressed={showVersions}
                    className={`fade ${showVersions ? "text-accent" : "text-muted hover:text-text"}`}
                  >
                    VERSIONS ({versions.length})
                  </button>
                  <button
                    onClick={() => void suggest()}
                    disabled={suggesting || !draft.content.trim()}
                    title="AI-suggested titles, tags, shelf, and excerpt for the current draft"
                    className="fade text-muted hover:text-text disabled:opacity-40"
                  >
                    {suggesting ? "SUGGESTING…" : "SUGGEST"}
                  </button>
                </div>
                <button
                  onClick={() => void savePiece(true)}
                  disabled={saveState === "saving"}
                  className="fade border border-accent px-3 py-1 text-accent hover:bg-accent hover:text-bg disabled:opacity-40"
                >
                  SAVE
                </button>
              </div>

              {showVersions && (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-[2px] border border-hairline bg-surface p-3 font-mono text-[11px] tracking-wider">
                  {versions.length === 0 && (
                    <li className="text-muted">no snapshots yet — SAVE makes one.</li>
                  )}
                  {versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 py-1"
                    >
                      <span className="text-muted">
                        {new Date(v.created_at).toLocaleString()} ·{" "}
                        {countWords(v.developed_content ?? "").toLocaleString()}{" "}
                        words
                      </span>
                      <button
                        onClick={() =>
                          updateDraft({ content: v.developed_content ?? "" })
                        }
                        className="fade text-accent hover:opacity-70"
                      >
                        restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {preview ? (
                <div className="min-h-[40vh] rounded-[2px] border border-hairline bg-bg p-6">
                  <Markdown>{draft.content}</Markdown>
                  <p aria-hidden className="mt-10 text-center text-muted">
                    ■
                  </p>
                </div>
              ) : (
                <textarea
                  value={draft.content}
                  onChange={(e) => updateDraft({ content: e.target.value })}
                  rows={22}
                  aria-label="Developed draft (markdown)"
                  className="w-full resize-y rounded-[2px] border border-hairline bg-surface p-4 font-mono text-sm leading-relaxed outline-none focus:border-accent"
                />
              )}

              {/* publish controls */}
              <div className="grid gap-4 rounded-[2px] border border-hairline bg-surface p-4 font-mono text-[11px] tracking-wider sm:grid-cols-2">
                <label className="block text-muted">
                  STATUS
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      updateDraft({ status: e.target.value as PieceStatus })
                    }
                    className="mt-1 w-full border border-hairline bg-bg px-2 py-1.5 text-text outline-none focus:border-accent"
                  >
                    <option value="draft">draft</option>
                    <option value="unlisted">unlisted</option>
                    <option value="published">published</option>
                  </select>
                </label>
                <label className="block text-muted">
                  SHELF
                  <select
                    value={draft.collection_id ?? ""}
                    onChange={(e) =>
                      updateDraft({ collection_id: e.target.value || null })
                    }
                    className="mt-1 w-full border border-hairline bg-bg px-2 py-1.5 text-text outline-none focus:border-accent"
                  >
                    <option value="">—</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-muted">
                  TYPE
                  <select
                    value={draft.type}
                    onChange={(e) =>
                      updateDraft({ type: e.target.value as PieceType })
                    }
                    className="mt-1 w-full border border-hairline bg-bg px-2 py-1.5 text-text outline-none focus:border-accent"
                  >
                    <option value="essay">essay</option>
                    <option value="story">story</option>
                    <option value="movie">movie / show</option>
                    <option value="misc">misc</option>
                  </select>
                </label>
                <label className="block text-muted">
                  SLUG
                  <input
                    value={draft.slug}
                    onChange={(e) =>
                      updateDraft({ slug: e.target.value }, true)
                    }
                    className="mt-1 w-full border border-hairline bg-bg px-2 py-1.5 text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-muted sm:col-span-2">
                  TAGS (COMMA-SEPARATED)
                  <input
                    value={draft.tags.join(", ")}
                    onChange={(e) =>
                      updateDraft({
                        tags: e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      })
                    }
                    className="mt-1 w-full border border-hairline bg-bg px-2 py-1.5 text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="block text-muted sm:col-span-2">
                  EXCERPT (≤140)
                  <input
                    value={draft.excerpt}
                    maxLength={140}
                    onChange={(e) => updateDraft({ excerpt: e.target.value })}
                    className="mt-1 w-full border border-hairline bg-bg px-2 py-1.5 font-serif text-sm italic text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="flex items-center gap-2 text-muted sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={draft.show_raw}
                    onChange={(e) =>
                      updateDraft({ show_raw: e.target.checked })
                    }
                    className="accent-[#C9915C]"
                  />
                  SHOW RAW — public RAW/DEVELOPED toggle on the piece page
                </label>
                {piece.status !== "draft" && (
                  <p className="text-muted sm:col-span-2">
                    LIVE AT{" "}
                    <a
                      href={`/s/${piece.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="fade text-accent hover:opacity-70"
                    >
                      /s/{piece.slug}
                    </a>
                  </p>
                )}
              </div>
              {draft.type === "movie" && (
                <TmdbSearch
                  pieceId={piece.id}
                  current={piece.tmdb}
                  onAttached={(p) => setPiece(p)}
                />
              )}
              <MediaManager pieceId={piece.id} initialMedia={initialMedia} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
