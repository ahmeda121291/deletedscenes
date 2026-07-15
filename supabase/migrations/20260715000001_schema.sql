-- Deleted Scenes — schema
-- Tables, functions, triggers, indexes. RLS lives in the next migration.

-- ---------------------------------------------------------------------------
-- collections (the shelves)
-- ---------------------------------------------------------------------------
create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pieces
-- ---------------------------------------------------------------------------
create table public.pieces (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text unique not null,
  type              text not null check (type in ('essay','story','movie','misc')),
  collection_id     uuid references public.collections(id) on delete set null,
  raw_content       text,
  developed_content text,
  excerpt           text,
  tags              text[] not null default '{}',
  status            text not null default 'draft' check (status in ('draft','unlisted','published')),
  show_raw          boolean not null default false,
  word_count        int not null default 0,
  view_count        int not null default 0,
  tmdb              jsonb,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  search            tsvector generated always as (
                      to_tsvector('english', title || ' ' || coalesce(developed_content, ''))
                    ) stored
);

create index pieces_search_idx on public.pieces using gin (search);
create index pieces_tags_idx on public.pieces using gin (tags);
create index pieces_status_published_at_idx on public.pieces (status, published_at desc);
create index pieces_collection_idx on public.pieces (collection_id);

-- ---------------------------------------------------------------------------
-- piece_versions — snapshot on every manual save; most recent 50 kept
-- (trimmed in the save route)
-- ---------------------------------------------------------------------------
create table public.piece_versions (
  id                uuid primary key default gen_random_uuid(),
  piece_id          uuid not null references public.pieces(id) on delete cascade,
  developed_content text,
  created_at        timestamptz not null default now()
);

create index piece_versions_piece_idx on public.piece_versions (piece_id, created_at desc);

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------
create table public.media (
  id           uuid primary key default gen_random_uuid(),
  piece_id     uuid references public.pieces(id) on delete cascade,
  storage_path text not null,
  type         text not null check (type in ('image','video')),
  caption      text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index media_piece_idx on public.media (piece_id, sort_order);

-- ---------------------------------------------------------------------------
-- darkroom_sessions — the rant thread
-- messages: array of {role:'writer', text, ts}
-- ---------------------------------------------------------------------------
create table public.darkroom_sessions (
  id         uuid primary key default gen_random_uuid(),
  piece_id   uuid references public.pieces(id) on delete set null,
  messages   jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- site_settings — single row, editable from the Darkroom
-- ---------------------------------------------------------------------------
create table public.site_settings (
  id       int primary key default 1 check (id = 1),
  epigraph text,
  about_md text
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pieces_set_updated_at
  before update on public.pieces
  for each row execute function public.set_updated_at();

create trigger darkroom_sessions_set_updated_at
  before update on public.darkroom_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- raw_content is sacred: once set it can never be changed, by anything.
-- Enforced at the database so no app bug can violate it.
-- ---------------------------------------------------------------------------
create or replace function public.protect_raw_content()
returns trigger
language plpgsql
as $$
begin
  if old.raw_content is not null
     and new.raw_content is distinct from old.raw_content then
    raise exception 'raw_content is immutable once set';
  end if;
  return new;
end;
$$;

create trigger pieces_protect_raw_content
  before update on public.pieces
  for each row execute function public.protect_raw_content();

-- ---------------------------------------------------------------------------
-- is_owner() — "owner" = the sole auth user (signups are disabled; the single
-- user is created by hand in the Supabase dashboard). security definer so it
-- can read auth.users from RLS policies.
-- ---------------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and auth.uid() = (select id from auth.users order by created_at asc limit 1);
$$;

-- ---------------------------------------------------------------------------
-- increment_view — called only from the server /api/view route.
-- security definer so the anon role can bump the counter without having
-- update rights on pieces.
-- ---------------------------------------------------------------------------
create or replace function public.increment_view(piece_slug text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.pieces
     set view_count = view_count + 1
   where slug = piece_slug
     and status in ('published','unlisted');
$$;
