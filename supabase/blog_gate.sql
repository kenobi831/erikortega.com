-- ── Blog gate (migration blog_gate, 2026-11-16) ────────────────────────────
-- The blog is no longer public. Entries live here; visitors get in only by
-- answering two riddles (one about Erik, one random) through the blog-gate
-- edge function. The owner reads directly when signed in.
-- Gate tables have RLS on and no policies: only the edge function (service role) touches them.

create table if not exists public.blog_entries (
  id          text primary key,
  date        date not null,
  lang        text not null default 'es',
  moment      text,
  title       text,
  alt         text,
  photo_path  text,                 -- object path in the private 'blog' storage bucket
  paragraphs  jsonb not null default '[]'::jsonb,
  en          jsonb,
  es          jsonb,
  created_at  timestamptz not null default now()
);
alter table public.blog_entries enable row level security;
drop policy if exists owner_all on public.blog_entries;
create policy owner_all on public.blog_entries for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
revoke all on public.blog_entries from anon;
grant select, insert, update, delete on public.blog_entries to authenticated;

create table if not exists public.blog_riddles (
  id       serial primary key,
  bank     text not null check (bank in ('me', 'random')),
  q_es     text not null,
  q_en     text not null,
  answers  text[] not null,         -- accepted answers, any language; normalized by the function
  active   boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.blog_riddles enable row level security;
drop policy if exists owner_all on public.blog_riddles;
create policy owner_all on public.blog_riddles for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
revoke all on public.blog_riddles from anon;
grant select, insert, update, delete on public.blog_riddles to authenticated;
grant usage on sequence public.blog_riddles_id_seq to authenticated;

create table if not exists public.blog_gate_challenges (
  id          uuid primary key default gen_random_uuid(),
  riddle_ids  int[] not null,
  device      text not null,
  ip_hash     text not null,
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  ok          boolean
);
create index if not exists blog_gate_challenges_device on public.blog_gate_challenges (device, created_at desc);
create index if not exists blog_gate_challenges_ip on public.blog_gate_challenges (ip_hash, created_at desc);

create table if not exists public.blog_gate_sessions (
  token_hash  text primary key,
  device      text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.blog_gate_challenges enable row level security;
alter table public.blog_gate_sessions   enable row level security;
revoke all on public.blog_gate_challenges, public.blog_gate_sessions from anon, authenticated;

-- Private bucket for blog photos; the function hands out short-lived signed URLs.
insert into storage.buckets (id, name, public) values ('blog', 'blog', false)
  on conflict (id) do update set public = false;
drop policy if exists blog_owner_read on storage.objects;
drop policy if exists blog_owner_write on storage.objects;
create policy blog_owner_read  on storage.objects for select using (bucket_id = 'blog' and public.is_owner());
create policy blog_owner_write on storage.objects for insert with check (bucket_id = 'blog' and public.is_owner());
alter table public.blog_riddles add column if not exists parts jsonb;  -- multi-part riddles: [{es,en,type:'date'|'contains'|text,answers}]
