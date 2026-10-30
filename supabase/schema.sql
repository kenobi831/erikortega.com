-- erikortega.com — Supabase schema
-- Applied to project dthvmmjzlazsgybgzmtb on 2026-10-23 (migration journal_schema).
--
-- Journal: dollar amounts are private (only the owner, logged in, can read or write them).
-- The public sees only percentages through the journal_public view.

-- Owner check: the only account allowed to read/write private data.
create or replace function public.is_owner() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'erik@erikortega.com'
$$;

-- ── Tables ────────────────────────────────────────────────────────────────
create table if not exists public.journal_settings (
  key   text primary key,
  value text not null
);

create table if not exists public.journal_entries (
  date       date primary key,
  opening    numeric,               -- override; null = prior official close
  closing    numeric,               -- official brokerage Net Worth at close
  notes      text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_trades (
  id         bigserial primary key,
  date       date not null references public.journal_entries(date) on delete cascade on update cascade,
  position   int not null default 0,
  symbol     text not null default '',
  asset_type text not null default 'option',
  side       text not null default '',
  buy        numeric not null default 0,
  sell       numeric not null default 0,
  quantity   numeric not null default 1,
  multiplier numeric not null default 100,
  fees       numeric not null default 0,
  entry_time text,                   -- e.g. 06:33 PT
  exit_time  text,
  setup      text,                   -- why you took it
  brief_call text,                   -- GREEN / RED / NO EDGE that morning
  followed_brief boolean,
  planned_stop numeric               -- premium price you'd exit at
);

create table if not exists public.journal_attachments (
  id         uuid primary key default gen_random_uuid(),
  date       date not null references public.journal_entries(date) on delete cascade on update cascade,
  path       text not null,          -- object path in the private "journal" storage bucket
  created_at timestamptz not null default now()
);

-- ── Row level security: owner only ────────────────────────────────────────
alter table public.journal_settings    enable row level security;
alter table public.journal_entries     enable row level security;
alter table public.journal_trades      enable row level security;
alter table public.journal_attachments enable row level security;

drop policy if exists owner_all on public.journal_settings;
drop policy if exists owner_all on public.journal_entries;
drop policy if exists owner_all on public.journal_trades;
drop policy if exists owner_all on public.journal_attachments;
create policy owner_all on public.journal_settings    for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.journal_entries     for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.journal_trades      for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy owner_all on public.journal_attachments for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- ── Public view: percentages only, no dollar amounts ──────────────────────
-- Runs with the view owner's rights on purpose (Supabase flags this as 'security definer view'):
-- it is the only window anon has, and it exposes percentages only.
create or replace view public.journal_public as
with s as (
  select (select value::numeric from public.journal_settings where key = 'start_balance') as start_balance
), e as (
  select date, closing,
         coalesce(opening, lag(closing) over (order by date), (select start_balance from s)) as open_eff
  from public.journal_entries
), t as (
  select date,
         count(*)                                  as trades,
         count(*) filter (where sell > buy)        as wins,
         count(*) filter (where sell < buy)        as losses,
         string_agg(distinct side, '/')            as sides,
         round(avg((sell - buy) / nullif(buy, 0)) * 100, 1) as trade_return_pct,
         bool_and(followed_brief)                  as followed_brief
  from public.journal_trades group by date
)
select e.date,
       round((e.closing / nullif(e.open_eff, 0) - 1) * 100, 2) as return_pct,
       coalesce(t.trades, 0) as trades, coalesce(t.wins, 0) as wins, coalesce(t.losses, 0) as losses,
       t.sides, t.trade_return_pct, t.followed_brief
from e left join t using (date)
where e.closing is not null
order by e.date;

create or replace view public.journal_public_settings as
select key, value from public.journal_settings where key in ('start_date', 'daily_rate');

revoke all on public.journal_settings, public.journal_entries, public.journal_trades, public.journal_attachments from anon;
revoke all on public.journal_public, public.journal_public_settings from anon, authenticated;
grant select on public.journal_public, public.journal_public_settings to anon, authenticated;

-- ── Private storage for screenshots ───────────────────────────────────────
insert into storage.buckets (id, name, public) values ('journal', 'journal', false)
on conflict (id) do nothing;

drop policy if exists journal_owner_read   on storage.objects;
drop policy if exists journal_owner_write  on storage.objects;
drop policy if exists journal_owner_update on storage.objects;
drop policy if exists journal_owner_delete on storage.objects;
create policy journal_owner_read   on storage.objects for select using (bucket_id = 'journal' and public.is_owner());
create policy journal_owner_write  on storage.objects for insert with check (bucket_id = 'journal' and public.is_owner());
create policy journal_owner_update on storage.objects for update using (bucket_id = 'journal' and public.is_owner());
create policy journal_owner_delete on storage.objects for delete using (bucket_id = 'journal' and public.is_owner());

-- ── Private blog entries (migration blog_private, 2026-10-30) ─────────────
-- Owner-only. Public entries stay in site/data/diary/index.json.
create table if not exists public.blog_private (
  id          text primary key,
  date        date not null,
  lang        text not null default 'es',
  moment      text,
  title       text,
  paragraphs  jsonb not null default '[]'::jsonb,
  en          jsonb,
  es          jsonb,
  created_at  timestamptz not null default now()
);
alter table public.blog_private enable row level security;
drop policy if exists owner_all on public.blog_private;
create policy owner_all on public.blog_private for all to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
revoke all on public.blog_private from anon;
grant select, insert, update, delete on public.blog_private to authenticated;
