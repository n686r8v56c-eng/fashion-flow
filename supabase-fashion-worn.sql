-- Fashion Flow independent worn-outfit records; realization images are referenced directly.
create table if not exists public.fashion_worn_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{"looks":[]}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.fashion_worn_data enable row level security;
drop policy if exists "worn select own" on public.fashion_worn_data;
drop policy if exists "worn insert own" on public.fashion_worn_data;
drop policy if exists "worn update own" on public.fashion_worn_data;
create policy "worn select own" on public.fashion_worn_data for select to authenticated using (auth.uid()=user_id);
create policy "worn insert own" on public.fashion_worn_data for insert to authenticated with check(auth.uid()=user_id);
create policy "worn update own" on public.fashion_worn_data for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
