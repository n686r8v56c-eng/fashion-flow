-- Fashion Flow > COSMETIC 장르 전용 데이터 (기존 Fashion 테이블은 변경하지 않음)
create table if not exists public.fashion_cosmetic_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.fashion_cosmetic_data enable row level security;
revoke all on public.fashion_cosmetic_data from anon;
grant select, insert, update, delete on public.fashion_cosmetic_data to authenticated;
drop policy if exists "fashion_cosmetic_select_own" on public.fashion_cosmetic_data;
drop policy if exists "fashion_cosmetic_insert_own" on public.fashion_cosmetic_data;
drop policy if exists "fashion_cosmetic_update_own" on public.fashion_cosmetic_data;
drop policy if exists "fashion_cosmetic_delete_own" on public.fashion_cosmetic_data;
create policy "fashion_cosmetic_select_own" on public.fashion_cosmetic_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "fashion_cosmetic_insert_own" on public.fashion_cosmetic_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "fashion_cosmetic_update_own" on public.fashion_cosmetic_data
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "fashion_cosmetic_delete_own" on public.fashion_cosmetic_data
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Images and Instagram thumbnails use existing private 'wardrobe' Storage bucket
-- managed by Fashion Flow; execute supabase/schema.sql first if not installed.
