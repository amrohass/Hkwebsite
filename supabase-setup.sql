-- ============================================================
--  HK Technologies CMS — Supabase table setup
--  Run this ONCE in your Supabase project:
--  Supabase Dashboard → SQL Editor → New query → paste → Run.
--  (The website content is filled in automatically by the app
--   on its first start — you only create the empty tables here.)
-- ============================================================

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);

create table if not exists products (
  id       bigint generated always as identity primary key,
  name     text,
  tag      text,
  descr    text,
  features jsonb default '[]'::jsonb,
  href     text,
  cta      text,
  image    text,
  sort     integer default 0
);

create table if not exists services (
  id    bigint generated always as identity primary key,
  title text,
  descr text,
  icon  text,
  sort  integer default 0
);

create table if not exists testimonials (
  id     bigint generated always as identity primary key,
  quote  text,
  author text,
  role   text,
  sort   integer default 0
);

-- The server uses the SERVICE-ROLE key, which bypasses Row Level
-- Security, so no RLS policies are required. The public never
-- talks to Supabase directly — only your Node server does.
