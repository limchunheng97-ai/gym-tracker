-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run

create table public.exercises (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  unit text not null,
  rep_low integer not null,
  rep_high integer not null,
  increment numeric not null,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  slot text not null,
  type text not null,
  template text,
  entries jsonb not null default '[]'::jsonb,
  duration_min integer,
  distance_km numeric,
  notes text default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index sessions_user_date_idx on public.sessions (user_id, date);

alter table public.exercises enable row level security;
alter table public.sessions enable row level security;

create policy "exercises_select_own" on public.exercises for select using (auth.uid() = user_id);
create policy "exercises_insert_own" on public.exercises for insert with check (auth.uid() = user_id);
create policy "exercises_update_own" on public.exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete_own" on public.exercises for delete using (auth.uid() = user_id);

create policy "sessions_select_own" on public.sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on public.sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_delete_own" on public.sessions for delete using (auth.uid() = user_id);
