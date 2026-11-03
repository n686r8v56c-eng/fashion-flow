-- Fashion Flow Realization (run in Supabase SQL Editor)
-- Existing wardrobe, outfits and fashion learning tables are unchanged.
create table if not exists public.fashion_realization_data(
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{"looks":[]}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.fashion_realization_data enable row level security;
drop policy if exists "realization select own" on public.fashion_realization_data;
drop policy if exists "realization insert own" on public.fashion_realization_data;
drop policy if exists "realization update own" on public.fashion_realization_data;
create policy "realization select own" on public.fashion_realization_data for select to authenticated using(auth.uid()=user_id);
create policy "realization insert own" on public.fashion_realization_data for insert to authenticated with check(auth.uid()=user_id);
create policy "realization update own" on public.fashion_realization_data for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
