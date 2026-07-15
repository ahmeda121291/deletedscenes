# Deleted Scenes

A pseudonymous personal writing archive at [deletedscenes.blog](https://deletedscenes.blog).
One person owns it and writes on it. Anyone can read it; nobody knows who writes it.

Two halves:

- **The public archive** — essays, stories, and movie posts organized into
  collections ("shelves"), styled like a late-night video store that only
  stocks one person's life. No comments, no likes, no social anything.
- **The Darkroom** — a private, auth-gated writing room at `/darkroom` where
  the owner rants into a chat-style interface and an AI copy editor
  ("Develop") turns the raw text into a publishable piece without changing
  the writer's voice. The original rant is stored verbatim and is never
  overwritten — by anything.

Stack: Next.js (App Router) · Tailwind · Supabase (Postgres/Auth/Storage) ·
Anthropic API · TMDB · Vercel.

---

## Setup — manual steps, in order

### 1. Create the Supabase project

Create a project at [supabase.com](https://supabase.com). Note the project
URL, the anon key, and the service-role key (Project Settings → API).

### 2. Run the migrations

Either link the repo and push:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

…or paste each file from `supabase/migrations/` (in filename order) into the
SQL editor in the dashboard and run them.

The migrations create every table with **Row Level Security enabled**
(anonymous visitors can read published/unlisted pieces and nothing else;
only the authenticated owner can write), the `increment_view` and
`is_owner()` functions, a database trigger that makes `raw_content`
immutable once set, the storage buckets, and the seed collections
(Essays / Stories / Movies / Etc. — rename them in Darkroom settings).

### 3. Create the single auth user

Dashboard → Authentication → Users → **Add user**. Create one user with
email + password. This is the owner — the only account that will ever exist.

### 4. Disable public signups

Dashboard → Authentication → Sign In / Up → turn **off** "Allow new users
to sign up". There is deliberately no signup UI anywhere in the app.

### 5. Verify the storage buckets

The migrations create two buckets:

- `media` — public read; finished, EXIF-stripped files
- `media-staging` — **private**; raw uploads before the sharp pipeline

Check both exist under Storage in the dashboard (create them with those
exact names and visibilities if your migration path skipped storage).

### 6. Get a TMDB API key

Free at [themoviedb.org](https://www.themoviedb.org/settings/api) — the v3
API key. Used only from server routes; never reaches the browser.

### 7. Set environment variables in Vercel

Copy `.env.example` and fill everything in (Project → Settings →
Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only
ANTHROPIC_API_KEY=                  # server-only
DEVELOP_MODEL=claude-sonnet-4-6     # server-only
TMDB_API_KEY=                       # server-only
NEXT_PUBLIC_SITE_URL=https://deletedscenes.blog
NEXT_PUBLIC_DARKROOM_CODEWORD=rewind
```

`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and `TMDB_API_KEY` are
server-side only and must never be prefixed `NEXT_PUBLIC_`.

If the Anthropic API rejects the model string, check current model IDs at
<https://docs.claude.com> and update `DEVELOP_MODEL` — no deploy needed
beyond the env var change.

The codeword is **theater, not security**: it ships in the client bundle by
design. Real security is Supabase Auth + RLS + the middleware.

### 8. Deploy

Push to the repo connected to Vercel (or `vercel deploy`). The build needs
no secrets beyond the env vars above.

### 9. Attach the domain

Vercel → Project → Domains → add `deletedscenes.blog` and follow the DNS
instructions at your registrar.

### 10. Verify WHOIS privacy

At the registrar, confirm WHOIS/RDAP privacy is **on** for the domain.
The site is pseudonymous; the domain record shouldn't undo that.

---

## Using it

- **Enter the Darkroom**: type the codeword anywhere on the homepage (or go
  to `/darkroom` directly) and sign in.
- **Write**: New scene → rant message by message → **Develop** (cleanup /
  shape / cut) → tweak the draft → publish. The rant mirrors to
  localStorage on every keystroke, saves to the server debounced, and every
  manual save snapshots a version (last 50 kept). Losing words is the one
  failure this project exists to prevent.
- **Statuses**: `draft` (owner only) · `unlisted` (reachable only by URL,
  noindexed, absent from shelves/search/RSS/sitemap) · `published`.
- **Images** are re-encoded server-side (max 2000px, WebP) which strips all
  EXIF/GPS — that's the anonymity layer. Videos are stored as-is: export
  clips fresh; screen recordings carry no location data.
- **Export** (Darkroom → EXPORT) downloads a zip with every piece as
  markdown + frontmatter, every verbatim rant as `.txt`, and a
  `media-manifest.json` with 7-day signed URLs for all media. Your writing
  is never hostage to this stack.

## Development

```bash
npm install
cp .env.example .env.local   # fill in
npm run dev
```
