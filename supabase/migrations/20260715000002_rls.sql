-- Deleted Scenes — Row Level Security + storage
-- Anonymous visitors: read published/unlisted content, nothing else.
-- The authenticated owner: everything.

alter table public.collections       enable row level security;
alter table public.pieces            enable row level security;
alter table public.piece_versions    enable row level security;
alter table public.media             enable row level security;
alter table public.darkroom_sessions enable row level security;
alter table public.site_settings     enable row level security;

-- ---------------------------------------------------------------------------
-- collections: public read, owner write
-- ---------------------------------------------------------------------------
create policy "collections public read"
  on public.collections for select
  using (true);

create policy "collections owner insert"
  on public.collections for insert
  with check ((select public.is_owner()));

create policy "collections owner update"
  on public.collections for update
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "collections owner delete"
  on public.collections for delete
  using ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- pieces: public read only when published/unlisted (listing queries in the
-- app only ever request status = 'published'; unlisted is reachable purely
-- by knowing the slug). Owner: full access including drafts.
-- ---------------------------------------------------------------------------
create policy "pieces public read published"
  on public.pieces for select
  using (status in ('published','unlisted') or (select public.is_owner()));

create policy "pieces owner insert"
  on public.pieces for insert
  with check ((select public.is_owner()));

create policy "pieces owner update"
  on public.pieces for update
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "pieces owner delete"
  on public.pieces for delete
  using ((select public.is_owner()));

-- view_count is private (Darkroom-only). RLS is row-level, so hide the
-- column from the anon role with column-level grants: anon can select every
-- column except view_count. Public queries in the app name their columns
-- explicitly for this reason.
revoke select on public.pieces from anon;
grant select (
  id, title, slug, type, collection_id, raw_content, developed_content,
  excerpt, tags, status, show_raw, word_count, tmdb,
  published_at, created_at, updated_at, search
) on public.pieces to anon;

-- ---------------------------------------------------------------------------
-- piece_versions: owner only
-- ---------------------------------------------------------------------------
create policy "piece_versions owner all"
  on public.piece_versions for all
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- media: public read, owner write
-- ---------------------------------------------------------------------------
create policy "media public read"
  on public.media for select
  using (true);

create policy "media owner insert"
  on public.media for insert
  with check ((select public.is_owner()));

create policy "media owner update"
  on public.media for update
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create policy "media owner delete"
  on public.media for delete
  using ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- darkroom_sessions: owner only
-- ---------------------------------------------------------------------------
create policy "darkroom_sessions owner all"
  on public.darkroom_sessions for all
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- site_settings: public read, owner write
-- ---------------------------------------------------------------------------
create policy "site_settings public read"
  on public.site_settings for select
  using (true);

create policy "site_settings owner insert"
  on public.site_settings for insert
  with check ((select public.is_owner()));

create policy "site_settings owner update"
  on public.site_settings for update
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

-- ---------------------------------------------------------------------------
-- storage
--   media          public bucket  — finished, EXIF-stripped files
--   media-staging  private bucket — raw uploads before the sharp pipeline;
--                  private so original EXIF/GPS is never publicly reachable,
--                  even for a moment
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('media-staging', 'media-staging', false)
on conflict (id) do nothing;

create policy "media public read"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media owner insert"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('media', 'media-staging') and (select public.is_owner()));

create policy "media owner update"
  on storage.objects for update to authenticated
  using (bucket_id in ('media', 'media-staging') and (select public.is_owner()))
  with check (bucket_id in ('media', 'media-staging') and (select public.is_owner()));

create policy "media owner delete"
  on storage.objects for delete to authenticated
  using (bucket_id in ('media', 'media-staging') and (select public.is_owner()));

create policy "staging owner read"
  on storage.objects for select to authenticated
  using (bucket_id = 'media-staging' and (select public.is_owner()));
