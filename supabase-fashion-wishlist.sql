-- Run once in the Fashion Flow Supabase SQL Editor.
create table if not exists public.fashion_wishlist (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null,
 category text not null default '상의',
 price numeric(12,0) not null default 0 check(price >= 0),
 actual_price numeric(12,0) check(actual_price >= 0),
 priority text not null default '보통',
 planned_month text,
 url text,
 image_path text,
 notes text not null default '',
 purchased boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists fashion_wishlist_user_created_idx on public.fashion_wishlist(user_id,created_at desc);
alter table public.fashion_wishlist enable row level security;
drop policy if exists "wishlist owner select" on public.fashion_wishlist;
drop policy if exists "wishlist owner insert" on public.fashion_wishlist;
drop policy if exists "wishlist owner update" on public.fashion_wishlist;
drop policy if exists "wishlist owner delete" on public.fashion_wishlist;
create policy "wishlist owner select" on public.fashion_wishlist for select to authenticated using (auth.uid() = user_id);
create policy "wishlist owner insert" on public.fashion_wishlist for insert to authenticated with check (auth.uid() = user_id);
create policy "wishlist owner update" on public.fashion_wishlist for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wishlist owner delete" on public.fashion_wishlist for delete to authenticated using (auth.uid() = user_id);
grant select,insert,update,delete on public.fashion_wishlist to authenticated;
