-- ============================================================
--  HK Technologies CMS — Row Level Security for public reads
--  Run this ONCE in Supabase SQL Editor AFTER supabase-setup.sql.
--
--  This enables the website on GitHub Pages to read content
--  directly from Supabase using the public anon key.
--  The admin password row in settings is excluded.
-- ============================================================

alter table settings     enable row level security;
alter table products     enable row level security;
alter table services     enable row level security;
alter table testimonials enable row level security;

-- Public (anon) can read everything except the admin password
create policy "anon_read_settings"
  on settings for select
  using (key != 'admin');

create policy "anon_read_products"
  on products for select
  using (true);

create policy "anon_read_services"
  on services for select
  using (true);

create policy "anon_read_testimonials"
  on testimonials for select
  using (true);

-- The CMS server uses the service_role key, which bypasses RLS,
-- so admin operations (create, update, delete) still work as before.
