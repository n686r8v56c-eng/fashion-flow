-- Run once in the existing Fashion Flow Supabase project's SQL Editor.
-- Preserves wardrobe_items, outfits, and inspiration_looks.
create table if not exists public.fashion_learning_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{"skills":[],"videos":[],"notes":[]}'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.fashion_learning_data enable row level security;
drop policy if exists "fashion learning select own" on public.fashion_learning_data;
drop policy if exists "fashion learning insert own" on public.fashion_learning_data;
drop policy if exists "fashion learning update own" on public.fashion_learning_data;
create policy "fashion learning select own" on public.fashion_learning_data for select to authenticated using (auth.uid()=user_id);
create policy "fashion learning insert own" on public.fashion_learning_data for insert to authenticated with check (auth.uid()=user_id);
create policy "fashion learning update own" on public.fashion_learning_data for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
