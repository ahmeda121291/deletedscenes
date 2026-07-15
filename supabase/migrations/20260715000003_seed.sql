-- Deleted Scenes — seed data
-- The collections are placeholders; the owner renames them in the Darkroom.

insert into public.collections (name, slug, sort_order) values
  ('Essays',  'essays',  0),
  ('Stories', 'stories', 1),
  ('Movies',  'movies',  2),
  ('Etc.',    'etc',     3);

insert into public.site_settings (id, epigraph, about_md) values
  (1, 'the parts that didn''t make the cut.', 'One person wrote everything here.');
