-- HabitLife — Supabase schema (Auth + DB + RLS + Leaderboard + Sleep)
-- Run in Supabase SQL Editor (Project → SQL → New query)

-- Extensions
create extension if not exists pgcrypto;

-- Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
--  Core tables
-- =========================

-- Profiles (public username for leaderboard)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 24),
  public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Habits
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('toggle','minutes','hours','count')),
  target_daily numeric null,
  year_goal numeric null,
  sort int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user_sort_idx on public.habits(user_id, sort);
create index if not exists habits_user_enabled_idx on public.habits(user_id, enabled);

drop trigger if exists habits_updated_at on public.habits;
create trigger habits_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

-- Entries (daily values per habit)
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  value_num numeric null,
  value_bool boolean null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, habit_id, date)
);

create index if not exists entries_user_date_idx on public.entries(user_id, date);
create index if not exists entries_habit_date_idx on public.entries(habit_id, date);

drop trigger if exists entries_updated_at on public.entries;
create trigger entries_updated_at
before update on public.entries
for each row execute function public.set_updated_at();

-- Daily notes
create table if not exists public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  gratitude text not null default '',
  improve text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists notes_user_date_idx on public.daily_notes(user_id, date);

drop trigger if exists daily_notes_updated_at on public.daily_notes;
create trigger daily_notes_updated_at
before update on public.daily_notes
for each row execute function public.set_updated_at();

-- Settings (modules)
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nutrition_enabled boolean not null default false,
  sleep_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists settings_updated_at on public.settings;
create trigger settings_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

-- Sleep logs (module)
create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  bed_time text null,     -- HH:MM
  wake_time text null,    -- HH:MM
  sleep_hours numeric null,
  screen_before_bed boolean null,
  screen_after_wake boolean null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists sleep_user_date_idx on public.sleep_logs(user_id, date);

drop trigger if exists sleep_logs_updated_at on public.sleep_logs;
create trigger sleep_logs_updated_at
before update on public.sleep_logs
for each row execute function public.set_updated_at();

-- Scores (XP + streak) — computed server-side
create table if not exists public.scores (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  xp int not null default 0,
  level int not null default 1,
  rank text not null default 'Bronze',
  streak int not null default 0,
  best_streak int not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists scores_updated_at on public.scores;
create trigger scores_updated_at
before update on public.scores
for each row execute function public.set_updated_at();

-- Public leaderboard view
create or replace view public.leaderboard_public as
select
  s.user_id,
  p.username,
  s.xp,
  s.level,
  s.rank,
  s.streak
from public.scores s
join public.profiles p on p.id = s.user_id
where p.public = true;

-- =========================
--  RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.entries enable row level security;
alter table public.daily_notes enable row level security;
alter table public.settings enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.scores enable row level security;

-- Profiles
drop policy if exists profiles_select_own_or_public on public.profiles;
create policy profiles_select_own_or_public
on public.profiles
for select
using (public = true or id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- Habits
drop policy if exists habits_select_own on public.habits;
create policy habits_select_own
on public.habits for select
using (user_id = auth.uid());

drop policy if exists habits_insert_own on public.habits;
create policy habits_insert_own
on public.habits for insert
with check (user_id = auth.uid());

drop policy if exists habits_update_own on public.habits;
create policy habits_update_own
on public.habits for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists habits_delete_own on public.habits;
create policy habits_delete_own
on public.habits for delete
using (user_id = auth.uid());

-- Entries
drop policy if exists entries_select_own on public.entries;
create policy entries_select_own
on public.entries for select
using (user_id = auth.uid());

drop policy if exists entries_insert_own on public.entries;
create policy entries_insert_own
on public.entries for insert
with check (user_id = auth.uid());

drop policy if exists entries_update_own on public.entries;
create policy entries_update_own
on public.entries for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists entries_delete_own on public.entries;
create policy entries_delete_own
on public.entries for delete
using (user_id = auth.uid());

-- Daily notes
drop policy if exists notes_select_own on public.daily_notes;
create policy notes_select_own
on public.daily_notes for select
using (user_id = auth.uid());

drop policy if exists notes_insert_own on public.daily_notes;
create policy notes_insert_own
on public.daily_notes for insert
with check (user_id = auth.uid());

drop policy if exists notes_update_own on public.daily_notes;
create policy notes_update_own
on public.daily_notes for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notes_delete_own on public.daily_notes;
create policy notes_delete_own
on public.daily_notes for delete
using (user_id = auth.uid());

-- Settings
drop policy if exists settings_select_own on public.settings;
create policy settings_select_own
on public.settings for select
using (user_id = auth.uid());

drop policy if exists settings_insert_own on public.settings;
create policy settings_insert_own
on public.settings for insert
with check (user_id = auth.uid());

drop policy if exists settings_update_own on public.settings;
create policy settings_update_own
on public.settings for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists settings_delete_own on public.settings;
create policy settings_delete_own
on public.settings for delete
using (user_id = auth.uid());

-- Sleep logs
drop policy if exists sleep_select_own on public.sleep_logs;
create policy sleep_select_own
on public.sleep_logs for select
using (user_id = auth.uid());

drop policy if exists sleep_insert_own on public.sleep_logs;
create policy sleep_insert_own
on public.sleep_logs for insert
with check (user_id = auth.uid());

drop policy if exists sleep_update_own on public.sleep_logs;
create policy sleep_update_own
on public.sleep_logs for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists sleep_delete_own on public.sleep_logs;
create policy sleep_delete_own
on public.sleep_logs for delete
using (user_id = auth.uid());

-- Scores:
-- Users can read leaderboard (via view) but cannot directly edit scores.
drop policy if exists scores_select_all on public.scores;
create policy scores_select_all
on public.scores for select
using (true);

-- No insert/update/delete policies -> denied (only SECURITY DEFINER function updates)
revoke all on public.scores from anon, authenticated;

-- Allow selecting scores and view
grant select on public.scores to authenticated, anon;
grant select on public.leaderboard_public to authenticated, anon;

-- =========================
--  Anti-cheat XP + streak recalculation
-- =========================
create or replace function public.recalc_my_score()
returns public.scores
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  xp_i int := 0;
  lvl int := 1;
  r text := 'Bronze';
  s int := 0;
  best int := 0;
  total_tog int := 0;
  done_tog int := 0;
  d date := current_date;
  day date;
  qualifies boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.scores(user_id) values (uid)
  on conflict (user_id) do nothing;

  -- XP: entries (toggle true = 10, numeric > 0 = 5) + reflection (+5/+5) + sleep (+5)
  select coalesce(sum(
    case
      when h.type = 'toggle' and e.value_bool is true then 10
      when h.type <> 'toggle' and coalesce(e.value_num, 0) > 0 then 5
      else 0
    end
  ),0)
  into xp_i
  from public.entries e
  join public.habits h on h.id = e.habit_id
  where e.user_id = uid
    and e.created_at <= (e.date + interval '36 hours');

  select xp_i +
    coalesce(sum(
      (case when length(trim(n.gratitude)) > 0 then 5 else 0 end) +
      (case when length(trim(n.improve)) > 0 then 5 else 0 end)
    ),0)
  into xp_i
  from public.daily_notes n
  where n.user_id = uid
    and n.created_at <= (n.date + interval '36 hours');

  select xp_i +
    coalesce(sum(case when sl.sleep_hours is not null then 5 else 0 end), 0)
  into xp_i
  from public.sleep_logs sl
  where sl.user_id = uid
    and sl.created_at <= (sl.date + interval '36 hours');

  -- Level formula: 1 + floor(sqrt(xp/80))
  lvl := 1 + floor(sqrt(xp_i / 80.0));

  if lvl >= 18 then r := 'Diamond';
  elsif lvl >= 10 then r := 'Gold';
  elsif lvl >= 5 then r := 'Silver';
  else r := 'Bronze';
  end if;

  -- Streak: consecutive days (ending today) where toggle completion >= 60%
  s := 0;
  loop
    day := d - s;

    select count(*) into total_tog
    from public.habits
    where user_id = uid and enabled = true and type = 'toggle' and name not like 'Nutrition •%';

    if total_tog = 0 then
      select exists(
        select 1 from public.entries e
        where e.user_id = uid and e.date = day
          and e.created_at <= (day + interval '36 hours')
        union all
        select 1 from public.daily_notes n
        where n.user_id = uid and n.date = day
          and n.created_at <= (day + interval '36 hours')
          and (length(trim(n.gratitude)) > 0 or length(trim(n.improve)) > 0)
        union all
        select 1 from public.sleep_logs sl
        where sl.user_id = uid and sl.date = day
          and sl.created_at <= (day + interval '36 hours')
          and sl.sleep_hours is not null
      ) into qualifies;
    else
      select count(*) into done_tog
      from public.entries e
      join public.habits h on h.id = e.habit_id
      where e.user_id = uid and e.date = day
        and h.type = 'toggle' and h.enabled = true and h.name not like 'Nutrition •%'
        and e.value_bool is true
        and e.created_at <= (day + interval '36 hours');

      qualifies := (done_tog::float / total_tog) >= 0.6;
    end if;

    if qualifies then
      s := s + 1;
    else
      exit;
    end if;

    exit when s > 5000;
  end loop;

  select coalesce(best_streak, 0) into best from public.scores where user_id = uid;
  if s > best then best := s; end if;

  update public.scores
  set xp = xp_i, level = lvl, rank = r, streak = s, best_streak = best, updated_at = now()
  where user_id = uid;

  return (select * from public.scores where user_id = uid);
end;
$$;

grant execute on function public.recalc_my_score() to authenticated;
