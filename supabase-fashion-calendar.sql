-- Fashion Flow calendar: independent planning data; existing outfit tables unchanged
create table if not exists public.fashion_calendar_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{"plans":[]}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.fashion_calendar_data enable row level security;
drop policy if exists "fashion calendar select own" on public.fashion_calendar_data;
drop policy if exists "fashion calendar insert own" on public.fashion_calendar_data;
drop policy if exists "fashion calendar update own" on public.fashion_calendar_data;
create policy "fashion calendar select own" on public.fashion_calendar_data for select to authenticated using(auth.uid()=user_id);
create policy "fashion calendar insert own" on public.fashion_calendar_data for insert to authenticated with check(auth.uid()=user_id);
create policy "fashion calendar update own" on public.fashion_calendar_data for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
