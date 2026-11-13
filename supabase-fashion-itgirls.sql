-- Fashion Flow: it-girl creator bookmarks
create table if not exists public.fashion_itgirl_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('스타','인플','팔이','하꼬','인플루언서','유튜버','일반인','쇼핑몰')),
  url text not null,
  created_at timestamptz not null default now()
);
create index if not exists fashion_itgirl_bookmarks_user_id_idx on public.fashion_itgirl_bookmarks(user_id,created_at desc);
alter table public.fashion_itgirl_bookmarks enable row level security;
drop policy if exists "fashion itgirls select own" on public.fashion_itgirl_bookmarks;
drop policy if exists "fashion itgirls insert own" on public.fashion_itgirl_bookmarks;
drop policy if exists "fashion itgirls update own" on public.fashion_itgirl_bookmarks;
drop policy if exists "fashion itgirls delete own" on public.fashion_itgirl_bookmarks;
create policy "fashion itgirls select own" on public.fashion_itgirl_bookmarks for select to authenticated using (auth.uid()=user_id);
create policy "fashion itgirls insert own" on public.fashion_itgirl_bookmarks for insert to authenticated with check (auth.uid()=user_id);
create policy "fashion itgirls update own" on public.fashion_itgirl_bookmarks for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "fashion itgirls delete own" on public.fashion_itgirl_bookmarks for delete to authenticated using (auth.uid()=user_id);

-- Existing installations: expand the old check constraint without deleting or rewriting bookmarks.
-- Run this block once in the Fashion Flow project's Supabase SQL Editor.
alter table public.fashion_itgirl_bookmarks
  drop constraint if exists fashion_itgirl_bookmarks_category_check;
alter table public.fashion_itgirl_bookmarks
  add constraint fashion_itgirl_bookmarks_category_check
  check (category in ('스타','인플','팔이','하꼬','인플루언서','유튜버','일반인','쇼핑몰'));
