-- Run in the Supabase SQL Editor once. Uses authenticated user RLS.
create extension if not exists pgcrypto;
create table if not exists public.wardrobe_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, category text not null, subcategory text default '', color text default '', season text default '사계절',
 style text default '', brand text default '', notes text default '', image_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.outfits (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default '새 코디', occasion text default '', season text default '사계절', notes text default '',
 favorite boolean not null default false, elements jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists wardrobe_user_idx on public.wardrobe_items(user_id);
create index if not exists outfits_user_idx on public.outfits(user_id);
alter table public.wardrobe_items enable row level security;
alter table public.outfits enable row level security;
drop policy if exists "Own wardrobe" on public.wardrobe_items;
create policy "Own wardrobe" on public.wardrobe_items for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Own outfits" on public.outfits;
create policy "Own outfits" on public.outfits for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('wardrobe','wardrobe',false,10485760,array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Users upload own wardrobe photos" on storage.objects;
create policy "Users upload own wardrobe photos" on storage.objects for insert to authenticated with check(bucket_id='wardrobe' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users read own wardrobe photos" on storage.objects;
create policy "Users read own wardrobe photos" on storage.objects for select to authenticated using(bucket_id='wardrobe' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users remove own wardrobe photos" on storage.objects;
create policy "Users remove own wardrobe photos" on storage.objects for delete to authenticated using(bucket_id='wardrobe' and (storage.foldername(name))[1]=(select auth.uid())::text);
